-- CreditTrust initial schema. Apply in Supabase SQL Editor or via Supabase CLI.
-- Public registration may only create lender/borrower profiles. CEO must be provisioned manually.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('lender','borrower','ceo')),
  phone text,
  directory_consent boolean not null default false,
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role','borrower');
  if requested_role not in ('lender','borrower') then requested_role := 'borrower'; end if;
  insert into public.profiles(id,display_name,role)
  values(new.id,coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''),split_part(new.email,'@',1)),requested_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_credittrust on auth.users;
create trigger on_auth_user_created_credittrust after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.lender_borrowers (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.profiles(id),
  borrower_id uuid not null references public.profiles(id),
  private_notes text,
  created_at timestamptz not null default now(),
  unique(lender_id,borrower_id),
  check (lender_id <> borrower_id)
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.profiles(id),
  borrower_id uuid not null references public.profiles(id),
  principal_amount numeric(14,2) not null check (principal_amount > 0),
  interest_rate numeric(7,4) not null default 10 check (interest_rate >= 0),
  interest_type text not null default 'one_time' check (interest_type in ('one_time')),
  interest_amount numeric(14,2) generated always as (round(principal_amount * interest_rate / 100,2)) stored,
  total_due numeric(14,2) generated always as (round(principal_amount * (1 + interest_rate / 100),2)) stored,
  due_date date not null,
  penalty_per_day numeric(12,2) not null default 50 check (penalty_per_day >= 0),
  penalty_total numeric(14,2) not null default 0 check (penalty_total >= 0),
  balance_remaining numeric(14,2) not null,
  status text not null default 'active' check (status in ('active','overdue','completed','disputed','cancelled')),
  days_late_at_completion integer,
  rating numeric(2,1) check (rating between 0 and 5),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (balance_remaining >= 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  lender_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  reference_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.credential_requests (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.profiles(id),
  borrower_id uuid not null references public.profiles(id),
  reason text not null,
  requested_fields text[] not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','released','cancelled')),
  ceo_decided_by uuid references public.profiles(id),
  ceo_decided_at timestamptz,
  borrower_consented_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.profiles(id),
  loan_id uuid references public.loans(id),
  description text not null,
  status text not null default 'open' check (status in ('open','under_review','resolved','rejected')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists loans_lender_idx on public.loans(lender_id,created_at desc);
create index if not exists loans_borrower_idx on public.loans(borrower_id,created_at desc);
create index if not exists payments_loan_idx on public.payments(loan_id,paid_at desc);
create index if not exists credential_requests_status_idx on public.credential_requests(status,created_at desc);

alter table public.profiles enable row level security;
alter table public.lender_borrowers enable row level security;
alter table public.loans enable row level security;
alter table public.payments enable row level security;
alter table public.credential_requests enable row level security;
alter table public.disputes enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: a user can read their own profile; borrowers may opt in to directory visibility.
create policy "profiles_read_self_or_consented_borrower" on public.profiles
for select to authenticated using (
  id = (select auth.uid()) or (role = 'borrower' and directory_consent = true)
);
create policy "profiles_update_self_limited" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role <> 'ceo');

-- A lender sees only their own borrower links; a borrower sees links that refer to them.
create policy "links_read_participants" on public.lender_borrowers
for select to authenticated using (lender_id = (select auth.uid()) or borrower_id = (select auth.uid()));
create policy "links_insert_lender" on public.lender_borrowers
for insert to authenticated with check (
  lender_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id=borrower_id and p.role='borrower')
);
create policy "links_update_lender" on public.lender_borrowers
for update to authenticated using (lender_id = (select auth.uid())) with check (lender_id = (select auth.uid()));
create policy "links_delete_lender" on public.lender_borrowers
for delete to authenticated using (lender_id = (select auth.uid()));

create policy "loans_read_participants" on public.loans
for select to authenticated using (lender_id = (select auth.uid()) or borrower_id = (select auth.uid()));
create policy "loans_insert_lender" on public.loans
for insert to authenticated with check (
  lender_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id=borrower_id and p.role='borrower')
);
create policy "loans_update_lender" on public.loans
for update to authenticated using (lender_id = (select auth.uid())) with check (lender_id = (select auth.uid()));
create policy "loans_delete_lender" on public.loans
for delete to authenticated using (lender_id = (select auth.uid()));

create policy "payments_read_loan_participants" on public.payments
for select to authenticated using (
  lender_id = (select auth.uid()) or exists(select 1 from public.loans l where l.id=loan_id and l.borrower_id=(select auth.uid()))
);
create policy "payments_insert_own_lender" on public.payments
for insert to authenticated with check (
  lender_id = (select auth.uid()) and exists(select 1 from public.loans l where l.id=loan_id and l.lender_id=(select auth.uid()))
);
create policy "payments_update_lender" on public.payments
for update to authenticated using (lender_id = (select auth.uid())) with check (lender_id = (select auth.uid()));
create policy "payments_delete_lender" on public.payments
for delete to authenticated using (lender_id = (select auth.uid()));

create policy "credential_requests_read_participants" on public.credential_requests
for select to authenticated using (lender_id=(select auth.uid()) or borrower_id=(select auth.uid()));
create policy "credential_requests_insert_lender" on public.credential_requests
for insert to authenticated with check (lender_id=(select auth.uid()) and status='pending' and ceo_decided_by is null);
create policy "credential_requests_borrower_consent" on public.credential_requests
for update to authenticated using (borrower_id=(select auth.uid()) and status='approved')
with check (borrower_id=(select auth.uid()) and status in ('approved','released') and borrower_consented_at is not null);

create policy "disputes_read_borrower_or_lender" on public.disputes
for select to authenticated using (borrower_id=(select auth.uid()) or exists(select 1 from public.loans l where l.id=loan_id and l.lender_id=(select auth.uid())));
create policy "disputes_insert_borrower" on public.disputes
for insert to authenticated with check (borrower_id=(select auth.uid()) and status='open');

create policy "audit_read_actor" on public.audit_logs
for select to authenticated using (actor_id=(select auth.uid()));

-- Private documents bucket. Store objects at: <lender_user_id>/<borrower_user_id>/<filename>
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('credittrust-private','credittrust-private',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

create policy "private_docs_read_participants" on storage.objects
for select to authenticated using (
  bucket_id='credittrust-private' and (
    (storage.foldername(name))[1]=(select auth.uid())::text or
    (storage.foldername(name))[2]=(select auth.uid())::text
  )
);
create policy "private_docs_upload_lender" on storage.objects
for insert to authenticated with check (
  bucket_id='credittrust-private' and (storage.foldername(name))[1]=(select auth.uid())::text and
  exists(select 1 from public.lender_borrowers lb where lb.lender_id=(select auth.uid()) and lb.borrower_id=((storage.foldername(name))[2])::uuid)
);
