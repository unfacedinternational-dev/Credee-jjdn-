create or replace view public.borrower_directory
with (security_barrier=true) as
select
  p.id as borrower_id,
  p.display_name,
  count(l.id)::integer as completed_loans,
  coalesce(round(avg(l.rating)::numeric,2),0) as average_rating,
  count(l.id) filter (where l.rating=5)::integer as five_star_loans,
  count(l.id) filter (where l.days_late_at_completion>0)::integer as late_loans,
  count(distinct l.lender_id)::integer as contributing_lenders
from public.profiles p
left join public.loans l on l.borrower_id=p.id and l.status='completed' and l.rating is not null
where p.role='borrower' and p.directory_consent=true and p.suspended_at is null
  and exists(select 1 from public.profiles requester where requester.id=auth.uid() and requester.role='lender' and requester.suspended_at is null)
group by p.id,p.display_name;
revoke all on public.borrower_directory from anon, public;
grant select on public.borrower_directory to authenticated;
