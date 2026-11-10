create table if not exists public.support_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 subject text not null default 'Customer Service',
 status text not null default 'open' check(status in ('open','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_message_at timestamptz not null default now()
);
create table if not exists public.support_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.support_conversations(id) on delete restrict,
 sender_id uuid not null references public.profiles(id) on delete restrict,
 sender_role text not null check(sender_role in ('lender','borrower','ceo')),
 body text not null check(char_length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index if not exists support_conversations_user_recent_idx on public.support_conversations(user_id,last_message_at desc);
create index if not exists support_messages_conversation_recent_idx on public.support_messages(conversation_id,created_at asc);
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
create policy "support_conversations_read_owner_or_ceo" on public.support_conversations for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='ceo' and p.suspended_at is null)
);
create policy "support_conversations_create_user" on public.support_conversations for insert to authenticated with check (
 user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('lender','borrower') and p.suspended_at is null)
);
create policy "support_conversations_update_ceo" on public.support_conversations for update to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='ceo' and p.suspended_at is null)
) with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='ceo' and p.suspended_at is null)
);
create policy "support_messages_read_owner_or_ceo" on public.support_messages for select to authenticated using (
 exists(select 1 from public.support_conversations c where c.id=conversation_id and (
 c.user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='ceo' and p.suspended_at is null)))
);
create policy "support_messages_insert_sender" on public.support_messages for insert to authenticated with check (
 sender_id=(select auth.uid()) and exists(
 select 1 from public.profiles p join public.support_conversations c on c.id=conversation_id
 where p.id=(select auth.uid()) and p.suspended_at is null and (
 (p.role in ('lender','borrower') and sender_role=p.role and c.user_id=p.id)
 or (p.role='ceo' and sender_role='ceo')
 ))
);
create or replace function public.touch_support_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.support_conversations set updated_at=now(),last_message_at=new.created_at where id=new.conversation_id; return new; end; $$;
create trigger support_message_touch_conversation after insert on public.support_messages for each row execute function public.touch_support_conversation();
grant select,insert on public.support_conversations to authenticated;
grant update(status) on public.support_conversations to authenticated;
grant select,insert on public.support_messages to authenticated;
revoke delete on public.support_conversations,public.support_messages from anon,authenticated;
