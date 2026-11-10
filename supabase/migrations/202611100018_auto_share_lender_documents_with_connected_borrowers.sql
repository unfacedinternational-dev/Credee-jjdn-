drop policy if exists borrower_documents_read_participants on public.borrower_documents;
create policy borrower_documents_read_assigned_participants on public.borrower_documents
for select to authenticated using (
  lender_id = auth.uid()
  or exists (
    select 1 from public.lender_borrowers lb
    where lb.lender_id = borrower_documents.lender_id
      and lb.borrower_id = auth.uid()
  )
);

drop policy if exists "CREDEE participants view approved borrower documents" on storage.objects;
create policy "CREDEE assigned lender and borrower view documents" on storage.objects
for select to authenticated using (
  bucket_id='credee-private' and exists (
    select 1 from public.borrower_documents d
    where d.file_path=objects.name and (
      d.lender_id=auth.uid()
      or exists (
        select 1 from public.lender_borrowers lb
        where lb.lender_id=d.lender_id and lb.borrower_id=auth.uid()
      )
    )
  )
);
