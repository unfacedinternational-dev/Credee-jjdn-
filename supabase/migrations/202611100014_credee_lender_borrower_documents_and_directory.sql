create table if not exists public.lender_borrowers (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.profiles(id) on delete cascade,
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lender_id, borrower_id),
  check (lender_id <> borrower_id)
);
alter table public.lender_borrowers enable row level security;
create policy lender_borrowers_read_participants on public.lender_borrowers
for select to authenticated using (lender_id = auth.uid() or borrower_id = auth.uid());
create policy lender_borrowers_add_lender on public.lender_borrowers
for insert to authenticated with check (
  lender_id = auth.uid() and public.has_profile_role('lender')
  and exists(select 1 from public.profiles p where p.id=borrower_id and 'borrower'=any(p.roles) and p.suspended_at is null)
);
create policy lender_borrowers_remove_lender on public.lender_borrowers
for delete to authenticated using (lender_id = auth.uid() and public.has_profile_role('lender'));
grant select,insert,delete on public.lender_borrowers to authenticated;

create table if not exists public.borrower_documents (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null,
  borrower_id uuid not null,
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now(),
  foreign key (lender_id, borrower_id) references public.lender_borrowers(lender_id, borrower_id) on delete cascade,
  check (file_size > 0 and file_size <= 10485760),
  check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp'))
);
alter table public.borrower_documents enable row level security;
create policy borrower_documents_read_participants on public.borrower_documents
for select to authenticated using (
  lender_id = auth.uid()
  or (borrower_id = auth.uid() and exists (
    select 1 from public.credential_requests cr
    where cr.lender_id=borrower_documents.lender_id
      and cr.borrower_id=borrower_documents.borrower_id
      and cr.status='released'
  ))
);
create policy borrower_documents_add_lender on public.borrower_documents
for insert to authenticated with check (
  lender_id = auth.uid() and public.has_profile_role('lender')
  and exists(select 1 from public.lender_borrowers lb where lb.lender_id=auth.uid() and lb.borrower_id=borrower_documents.borrower_id)
);
create policy borrower_documents_remove_lender on public.borrower_documents
for delete to authenticated using (lender_id = auth.uid() and public.has_profile_role('lender'));
grant select,insert,delete on public.borrower_documents to authenticated;

create or replace function public.search_borrowers_for_lender(p_query text)
returns table(borrower_id uuid, display_name text)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.has_profile_role('lender') then
    raise exception 'Active lender access required';
  end if;
  if length(trim(coalesce(p_query,''))) < 2 then return; end if;
  return query
    select p.id, coalesce(p.display_name,'Unnamed borrower')
    from public.profiles p
    where 'borrower'=any(p.roles) and p.suspended_at is null
      and p.display_name ilike '%' || trim(p_query) || '%'
    order by p.display_name limit 25;
end;
$$;
revoke all on function public.search_borrowers_for_lender(text) from public,anon;
grant execute on function public.search_borrowers_for_lender(text) to authenticated;

create or replace function public.get_lender_borrowers()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.has_profile_role('lender') then raise exception 'Active lender access required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'borrower_id',p.id,'display_name',p.display_name,'full_address',p.full_address,
    'current_status',coalesce(s.current_status,'Added · no loan recorded'),
    'loan_count',coalesce(s.loan_count,0)
  ) order by p.display_name),'[]'::jsonb)
  into result
  from public.lender_borrowers lb join public.profiles p on p.id=lb.borrower_id
  left join lateral (
    select case when bool_or(l.status='overdue') then 'Overdue' when bool_or(l.status='active') then 'Active' when bool_or(l.status='completed') then 'Completed' else null end current_status,
      count(*)::integer loan_count
    from public.loans l where l.lender_id=auth.uid() and l.borrower_id=p.id
  ) s on true
  where lb.lender_id=auth.uid() and p.suspended_at is null;
  return result;
end;
$$;
revoke all on function public.get_lender_borrowers() from public,anon;
grant execute on function public.get_lender_borrowers() to authenticated;

create or replace function public.get_shared_account_directory()
returns jsonb language plpgsql security definer set search_path='public'
as $function$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not(public.has_profile_role('lender') or public.has_profile_role('borrower')) then raise exception 'Directory access is limited to active lender and borrower accounts'; end if;
 select jsonb_build_object(
  'lenders',coalesce((select jsonb_agg(jsonb_build_object('display_name',p.display_name,'created_at',p.created_at,'full_address',p.full_address,'facebook_url',p.facebook_url) order by p.display_name) from public.profiles p where 'lender'=any(p.roles) and p.lender_directory_consent=true and p.suspended_at is null),'[]'::jsonb),
  'borrowers',coalesce((select jsonb_agg(jsonb_build_object('borrower_id',p.id,'display_name',p.display_name) order by p.display_name) from public.profiles p where 'borrower'=any(p.roles) and p.directory_consent=true and p.suspended_at is null),'[]'::jsonb)
 ) into result;
 return result;
end;
$function$;
revoke all on function public.get_shared_account_directory() from public,anon;
grant execute on function public.get_shared_account_directory() to authenticated;

drop policy if exists credential_requests_update_ceo on public.credential_requests;
create policy credential_requests_update_ceo on public.credential_requests
for update to authenticated using (public.has_profile_role('ceo'))
with check (public.has_profile_role('ceo') and ceo_decided_by=auth.uid() and ceo_decided_at is not null and status in ('approved','rejected','released'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('credee-private','credee-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create policy "CREDEE lender upload borrower documents" on storage.objects for insert to authenticated with check (
 bucket_id='credee-private' and exists(select 1 from public.borrower_documents d where d.file_path=name and d.lender_id=auth.uid())
);
create policy "CREDEE participants view approved borrower documents" on storage.objects for select to authenticated using (
 bucket_id='credee-private' and exists(select 1 from public.borrower_documents d where d.file_path=name and (
  d.lender_id=auth.uid() or (d.borrower_id=auth.uid() and exists(select 1 from public.credential_requests cr where cr.lender_id=d.lender_id and cr.borrower_id=d.borrower_id and cr.status='released'))
 ))
);
create policy "CREDEE lender delete own borrower documents" on storage.objects for delete to authenticated using (
 bucket_id='credee-private' and exists(select 1 from public.borrower_documents d where d.file_path=name and d.lender_id=auth.uid())
);
