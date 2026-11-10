create or replace function public.mark_loan_paid(p_loan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  loan_row public.loans%rowtype;
  late_days integer;
  payment_date date;
  penalty numeric(14,2);
  amount_due numeric(14,2);
  already_paid numeric(14,2);
  remaining numeric(14,2);
  final_rating numeric(2,1);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='lender' and p.suspended_at is null
  ) then raise exception 'Only active lenders can mark payments as received'; end if;

  select * into loan_row
  from public.loans
  where id=p_loan_id and lender_id=auth.uid()
  for update;

  if not found then raise exception 'Loan not found in your lender account'; end if;
  if loan_row.status in ('completed','cancelled','disputed') then
    raise exception 'This loan is already completed or cannot accept payment';
  end if;

  payment_date := (now() at time zone 'Asia/Manila')::date;
  late_days := greatest(payment_date-loan_row.due_date,0);
  penalty := late_days*loan_row.penalty_per_day;
  amount_due := loan_row.total_due+penalty;

  select coalesce(sum(amount),0) into already_paid
  from public.payments where loan_id=p_loan_id;

  remaining := greatest(amount_due-already_paid,0);
  if remaining > 0 then
    insert into public.payments(loan_id,lender_id,amount,reference_note)
    values(p_loan_id,auth.uid(),remaining,'Full payment marked received by lender');
  end if;

  final_rating := greatest(0,5-late_days);
  update public.loans
  set balance_remaining=0,
      penalty_total=penalty,
      status='completed',
      days_late_at_completion=late_days,
      rating=final_rating,
      completed_at=now()
  where id=p_loan_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'payment_marked_received','loan',p_loan_id,
    jsonb_build_object('amount_recorded',remaining,'days_late',late_days,'rating',final_rating));

  return jsonb_build_object(
    'completed',true,
    'amount_recorded',remaining,
    'days_late',late_days,
    'rating',final_rating,
    'penalty_total',penalty,
    'payment_date',payment_date
  );
end;
$$;
revoke all on function public.mark_loan_paid(uuid) from public, anon;
grant execute on function public.mark_loan_paid(uuid) to authenticated;