drop policy if exists lender_borrowers_add_lender on public.lender_borrowers;
create or replace function public.add_borrower_to_lender(p_borrower_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.has_profile_role('lender') then raise exception 'Active lender access required'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_borrower_id and 'borrower'=any(p.roles) and p.suspended_at is null) then raise exception 'Borrower account not found or inactive'; end if;
  insert into public.lender_borrowers(lender_id,borrower_id) values(auth.uid(),p_borrower_id) on conflict(lender_id,borrower_id) do nothing;
  return true;
end;
$$;
revoke all on function public.add_borrower_to_lender(uuid) from public,anon;
grant execute on function public.add_borrower_to_lender(uuid) to authenticated;

create or replace function public.request_borrower_document_approval(p_borrower_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare request_id uuid;
begin
  if auth.uid() is null or not public.has_profile_role('lender') then raise exception 'Active lender access required'; end if;
  if not exists(select 1 from public.lender_borrowers lb where lb.lender_id=auth.uid() and lb.borrower_id=p_borrower_id) then raise exception 'Add this borrower to your borrower list first'; end if;
  insert into public.credential_requests(lender_id,borrower_id,reason,requested_fields,status)
  values(auth.uid(),p_borrower_id,'Please review and approve document access for this connected borrower.',array['borrower_documents'],'pending')
  returning id into request_id;
  return request_id;
end;
$$;
revoke all on function public.request_borrower_document_approval(uuid) from public,anon;
grant execute on function public.request_borrower_document_approval(uuid) to authenticated;
