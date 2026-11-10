-- Financial records must be changed through the checked database functions,
-- not by direct client-side table writes.
revoke insert, update, delete on public.loans from authenticated;
grant select on public.loans to authenticated;

revoke insert, update, delete on public.payments from authenticated;
grant select on public.payments to authenticated;

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
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='lender' and p.suspended_at is null) then
    raise exception 'Only active lenders can record payments';
  end if;
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
