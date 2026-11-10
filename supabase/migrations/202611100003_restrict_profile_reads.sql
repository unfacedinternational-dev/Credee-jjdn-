-- Do not expose full profile rows through a consent flag. A safe, purpose-limited
-- directory projection must be implemented separately before directory search is enabled.
drop policy if exists "profiles_read_self_or_consented_borrower" on public.profiles;
create policy "profiles_read_self" on public.profiles
for select to authenticated using (id=(select auth.uid()));
