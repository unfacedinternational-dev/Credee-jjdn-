drop policy if exists "profiles_read_ceo" on public.profiles;
create or replace function public.is_active_ceo()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='ceo' and p.suspended_at is null);
$$;
revoke all on function public.is_active_ceo() from public, anon;
grant execute on function public.is_active_ceo() to authenticated;
create policy "profiles_read_ceo" on public.profiles for select to authenticated using (public.is_active_ceo());