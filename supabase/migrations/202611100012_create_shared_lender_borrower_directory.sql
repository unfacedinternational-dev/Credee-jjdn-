create or replace function public.get_shared_account_directory()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('lender','borrower')
      and p.suspended_at is null
  ) then
    raise exception 'Directory access is limited to active lender and borrower accounts';
  end if;

  select jsonb_build_object(
    'lenders',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'display_name', p.display_name,
        'created_at', p.created_at
      ) order by p.display_name)
      from public.profiles p
      where p.role = 'lender' and p.suspended_at is null
    ), '[]'::jsonb),
    'borrowers',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'borrower_id', p.id,
        'display_name', p.display_name,
        'completed_loans', coalesce(stats.completed_loans, 0),
        'average_rating', coalesce(stats.average_rating, 0),
        'five_star_loans', coalesce(stats.five_star_loans, 0),
        'late_loans', coalesce(stats.late_loans, 0),
        'contributing_lenders', coalesce(stats.contributing_lenders, 0)
      ) order by stats.average_rating desc nulls last, p.display_name)
      from public.profiles p
      left join lateral (
        select
          count(*)::integer as completed_loans,
          round(avg(l.rating), 2) as average_rating,
          count(*) filter (where l.rating = 5)::integer as five_star_loans,
          count(*) filter (where coalesce(l.days_late_at_completion, 0) > 0)::integer as late_loans,
          count(distinct l.lender_id)::integer as contributing_lenders
        from public.loans l
        where l.borrower_id = p.id
          and l.status = 'completed'
          and l.rating is not null
      ) stats on true
      where p.role = 'borrower'
        and p.directory_consent = true
        and p.suspended_at is null
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_shared_account_directory() from public, anon;
grant execute on function public.get_shared_account_directory() to authenticated;