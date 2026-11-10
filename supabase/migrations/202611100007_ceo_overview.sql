-- CEO-only overview. This function exposes account directory fields only to the provisioned CEO.
create or replace function public.get_ceo_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ceo' and p.suspended_at is null
  ) then
    raise exception 'CEO access required';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'lenders', (select count(*) from public.profiles where role = 'lender'),
      'borrowers', (select count(*) from public.profiles where role = 'borrower'),
      'loans', (select count(*) from public.loans),
      'active_loans', (select count(*) from public.loans where status in ('active','overdue'))
    ),
    'lenders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'email', u.email,
        'created_at', p.created_at,
        'suspended', p.suspended_at is not null
      ) order by p.created_at desc)
      from public.profiles p
      left join auth.users u on u.id = p.id
      where p.role = 'lender'
    ), '[]'::jsonb),
    'borrowers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'email', u.email,
        'created_at', p.created_at,
        'directory_consent', p.directory_consent,
        'suspended', p.suspended_at is not null
      ) order by p.created_at desc)
      from public.profiles p
      left join auth.users u on u.id = p.id
      where p.role = 'borrower'
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_ceo_overview() from public, anon;
grant execute on function public.get_ceo_overview() to authenticated;
