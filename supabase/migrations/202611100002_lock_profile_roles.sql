-- Prevent self-service privilege escalation: users may edit profile details and consent only.
revoke update on public.profiles from authenticated;
grant update(display_name, phone, directory_consent) on public.profiles to authenticated;

drop policy if exists "profiles_update_self_limited" on public.profiles;
create policy "profiles_update_self_limited" on public.profiles
for update to authenticated using (id=(select auth.uid()))
with check (id=(select auth.uid()));

drop policy if exists "links_insert_lender" on public.lender_borrowers;
create policy "links_insert_lender" on public.lender_borrowers
for insert to authenticated with check (
  lender_id=(select auth.uid()) and
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='lender') and
  exists(select 1 from public.profiles p where p.id=borrower_id and p.role='borrower')
);

drop policy if exists "loans_insert_lender" on public.loans;
create policy "loans_insert_lender" on public.loans
for insert to authenticated with check (
  lender_id=(select auth.uid()) and
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='lender') and
  exists(select 1 from public.profiles p where p.id=borrower_id and p.role='borrower')
);

drop policy if exists "loans_update_lender" on public.loans;
create policy "loans_update_lender" on public.loans
for update to authenticated using (
  lender_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='lender')
) with check (
  lender_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='lender')
);

drop policy if exists "payments_insert_own_lender" on public.payments;
create policy "payments_insert_own_lender" on public.payments
for insert to authenticated with check (
  lender_id=(select auth.uid()) and
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='lender') and
  exists(select 1 from public.loans l where l.id=loan_id and l.lender_id=(select auth.uid()))
);
