-- Safe, purpose-limited directory projection. It intentionally excludes phone,
-- email, addresses, government IDs, agreements and private documents.
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
group by p.id,p.display_name;

revoke all on public.borrower_directory from anon, public;
grant select on public.borrower_directory to authenticated;

-- Create a loan only through this checked transaction. Public users cannot set
-- lender_id, status, penalty, balance or a rating directly through this function.
create or replace function public.create_loan(
  p_borrower_id uuid,
  p_principal numeric,
  p_interest_rate numeric,
  p_due_date date
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare new_loan_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='lender' and p.suspended_at is null) then
    raise exception 'Only active lenders can create loans';
  end if;
  if p_principal <= 0 or p_interest_rate < 0 or p_interest_rate > 100 then
    raise exception 'Invalid principal or interest rate';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_borrower_id and p.role='borrower' and p.suspended_at is null) then
    raise exception 'Borrower account not found or unavailable';
  end if;
  insert into public.lender_borrowers(lender_id,borrower_id)
  values(auth.uid(),p_borrower_id) on conflict(lender_id,borrower_id) do nothing;
  insert into public.loans(lender_id,borrower_id,principal_amount,interest_rate,due_date,balance_remaining)
  values(auth.uid(),p_borrower_id,p_principal,p_interest_rate,p_due_date,round(p_principal*(1+p_interest_rate/100),2))
  returning id into new_loan_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
  values(auth.uid(),'loan_created','loan',new_loan_id);
  return new_loan_id;
end;
$$;
revoke all on function public.create_loan(uuid,numeric,numeric,date) from public, anon;
grant execute on function public.create_loan(uuid,numeric,numeric,date) to authenticated;

-- Payment recording is atomic, lender-owned, and calculates the final rating
-- only when the full amount due (including the current late penalty) is settled.
create or replace function public.record_payment(
  p_loan_id uuid,
  p_amount numeric,
  p_reference_note text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare loan_row public.loans%rowtype;
declare late_days integer;
declare penalty numeric(14,2);
declare due_now numeric(14,2);
declare already_paid numeric(14,2);
declare new_balance numeric(14,2);
declare new_rating numeric(2,1);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount <= 0 then raise exception 'Payment must be greater than zero'; end if;
  select * into loan_row from public.loans where id=p_loan_id and lender_id=auth.uid() for update;
  if not found then raise exception 'Loan not found in your workspace'; end if;
  if loan_row.status in ('completed','cancelled','disputed') then raise exception 'This loan cannot accept a payment'; end if;
  late_days := greatest(current_date-loan_row.due_date,0);
  penalty := late_days * loan_row.penalty_per_day;
  due_now := loan_row.total_due + penalty;
  select coalesce(sum(amount),0) into already_paid from public.payments where loan_id=p_loan_id;
  new_balance := greatest(due_now-already_paid-p_amount,0);
  if p_amount > due_now-already_paid then raise exception 'Payment exceeds remaining balance'; end if;
  insert into public.payments(loan_id,lender_id,amount,reference_note)
  values(p_loan_id,auth.uid(),p_amount,p_reference_note);
  if new_balance=0 then
    new_rating := greatest(0,5-late_days);
    update public.loans set balance_remaining=0, penalty_total=penalty, status='completed',
      days_late_at_completion=late_days, rating=new_rating, completed_at=now()
    where id=p_loan_id;
  else
    update public.loans set balance_remaining=new_balance, penalty_total=penalty,
      status=case when current_date>due_date then 'overdue' else 'active' end
    where id=p_loan_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'payment_recorded','loan',p_loan_id,jsonb_build_object('amount',p_amount,'remaining_balance',new_balance));
  return jsonb_build_object('remaining_balance',new_balance,'penalty_total',penalty,'days_late',late_days,'rating',new_rating,'completed',new_balance=0);
end;
$$;
revoke all on function public.record_payment(uuid,numeric,text) from public, anon;
grant execute on function public.record_payment(uuid,numeric,text) to authenticated;

-- Payment history is append-only from the application role.
drop policy if exists "payments_update_lender" on public.payments;
drop policy if exists "payments_delete_lender" on public.payments;
revoke update, delete on public.payments from authenticated;
