# CreditTrust

A Next.js + Supabase starter for a consent-aware lending and repayment records platform.

## Stack
- Next.js 15 App Router + TypeScript
- Tailwind CSS
- Supabase Auth (cookie-based SSR) and Postgres with Row Level Security
- Vercel deployment-ready

## Run locally
1. Install Node.js 20.9+.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project and add its Project URL and publishable key to `.env.local`.
4. In Supabase SQL Editor, run `supabase/migrations/202611100001_initial_schema.sql`.
5. Enable email authentication in Supabase Auth. Configure the site URL and redirect URLs for localhost and your deployed domain.
6. Run `npm install`, then `npm run dev`.

## Supabase setup
The SQL migration creates profiles, lender/borrower links, loans, payments, credential requests, disputes, audit logs, RLS policies, and a private documents bucket.

New public registrations can only become lenders or borrowers. CEO is not a public registration option. Provision the CEO account manually after creating its Auth user, then set the profile role from the SQL Editor using an administrator connection. Never expose a service-role or secret key in the browser.

The app expects:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Current implementation status
- Public marketing landing page and lender/borrower registration/sign-in UI are implemented.
- Supabase cookie-based client setup is implemented.
- Authenticated dashboard shell and recent loan list are implemented.
- Initial database schema and RLS policies are included.

Still required before production use:
- Add full lender CRUD screens for borrowers, loan creation/editing, payment recording, receipts and private file uploads.
- Implement server-side loan balance/penalty accrual and completion-rating calculation with immutable audit history.
- Add consent-driven borrower directory search and the full CEO credential-request review/release workflow.
- Add borrower dispute workflows, CEO admin console, MFA, suspension handling, rate limiting, monitoring, backups and tests.
- Review all data flows and policies with a Philippine privacy/credit-reporting compliance professional before collecting or sharing real borrower data.

## Important security notes
- Never put Supabase service-role/secret keys in `NEXT_PUBLIC_*` variables or client-side code.
- CEO access must be provisioned outside public registration and protected by strong authentication/MFA. A hidden click sequence is not authentication.
- Do not publish government IDs, selfies, addresses, signed agreements or other private credentials in a searchable directory.
- RLS is a baseline, not a complete security certification. Test every role and cross-account boundary before production.

## Deploy
Import this GitHub repository into Vercel, add the two Supabase environment variables, and deploy. Connect future deployments to the `main` branch.
