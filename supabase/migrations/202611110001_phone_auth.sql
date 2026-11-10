-- Enable phone-number profiles for password-based member authentication.
alter table public.profiles add column if not exists phone text;
-- Existing email-created accounts keep their current auth identity; only new phone signups
-- automatically populate profiles.phone through the auth trigger.

create unique index if not exists profiles_phone_unique
  on public.profiles(phone)
  where phone is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  member_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'borrower');
  if requested_role not in ('lender', 'borrower') then
    requested_role := 'borrower';
  end if;

  member_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.phone, ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'CREDEE member'
  );

  insert into public.profiles(id, display_name, role, phone)
  values(new.id, member_name, requested_role, nullif(new.phone, ''))
  on conflict (id) do update
    set phone = coalesce(public.profiles.phone, excluded.phone);

  return new;
end;
$$;
