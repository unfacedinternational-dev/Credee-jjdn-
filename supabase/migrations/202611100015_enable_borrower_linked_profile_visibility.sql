update public.profiles set directory_consent=true,address_sharing_consent=true where 'borrower'=any(roles) and suspended_at is null;
alter table public.borrower_documents add column if not exists document_category text not null default 'Supporting document' check (length(document_category) between 1 and 80);
