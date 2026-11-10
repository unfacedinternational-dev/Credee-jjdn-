update public.credential_requests
set status='released'
where status='approved' and ceo_decided_at is not null;

drop policy if exists credential_requests_borrower_consent on public.credential_requests;
