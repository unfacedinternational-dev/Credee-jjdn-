import Link from "next/link";
import { ShieldCheck, Users, TrendingUp, CalendarClock, ArrowRight, WalletCards, Flower2, Sprout, HandCoins, HeartHandshake } from "lucide-react";

const features = [
  { icon: WalletCards, title: "Lending workspace", text: "Keep each loan, payment, balance and due date organized in one private workspace." },
  { icon: CalendarClock, title: "Clear repayment tracking", text: "Review agreed terms, due dates and payment history with greater clarity." },
  { icon: TrendingUp, title: "A fair borrower record", text: "See repayment records, build a history over time, and raise a dispute if information is incorrect." },
  { icon: ShieldCheck, title: "Privacy by design", text: "Private records stay restricted. Directory participation and sensitive-data sharing require consent." },
];

export default function Home() {
  return (
    <main>
      <header className="container flex items-center justify-between py-6">
        <Link href="/" aria-label="Credee home" className="text-2xl font-black tracking-[0.12em] text-[#a65e73] no-underline">
          CREDEE<span className="ml-2 align-middle text-xs tracking-[.25em] text-[#b99a62]">✿</span>
        </Link>
        <nav className="hidden gap-7 md:flex">
          <a className="navlink" href="#how">How it works</a>
          <a className="navlink" href="#features">Features</a>
          <a className="navlink" href="#privacy">Privacy</a>
        </nav>
        <Link className="btn btn-outline" href="/auth">Sign in <ArrowRight size={16} className="ml-2" /></Link>
      </header>

      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="eyebrow mb-5 flex items-center justify-center gap-2">
            <Flower2 size={15} /> A lending community built on trust
          </div>
          <h1 className="text-5xl font-semibold leading-[1.08] md:text-7xl">
            <span className="gradient">A clearer lending experience for everyone.</span>
          </h1>
          <p className="muted mx-auto mt-6 max-w-2xl text-lg leading-8">
            Whether you are offering a loan or looking for one, Credee helps lenders and borrowers keep agreements, payments and records clear.
          </p>
          <div className="mt-7 flex items-center justify-center gap-2 text-sm font-semibold text-[#98717c]">
            <ShieldCheck size={18} /> Two sides. One community. Built on clarity and trust.
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="glass rounded-[2rem] p-7 md:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3e3e7] text-[#a65e73]">
              <HandCoins size={27} />
            </div>
            <div className="eyebrow mt-6">For lenders</div>
            <h2 className="mt-2 text-3xl font-semibold">Lend with more clarity and confidence.</h2>
            <p className="muted mt-4 leading-7">
              Organize the people you lend to, record agreements, track balances and due dates, and keep payment histories in one private place.
            </p>
            <Link className="btn btn-primary mt-7 w-full justify-center" href="/auth?role=lender">
              Register as a lender <ArrowRight size={16} className="ml-2" />
            </Link>
          </article>

          <article className="glass rounded-[2rem] p-7 md:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eee9dc] text-[#a58a53]">
              <HeartHandshake size={27} />
            </div>
            <div className="eyebrow mt-6">For borrowers</div>
            <h2 className="mt-2 text-3xl font-semibold">Take a clearer step toward financial support.</h2>
            <p className="muted mt-4 leading-7">
              Connect with the lending community, review your loan details, follow balances and due dates, and keep track of your repayment record.
            </p>
            <Link className="btn btn-outline mt-7 w-full justify-center" href="/auth?role=borrower">
              Register as a borrower <ArrowRight size={16} className="ml-2" />
            </Link>
          </article>
        </div>

        <p className="mt-7 text-center text-sm text-[#98717c]">
          Already a member? <Link className="font-semibold underline underline-offset-4" href="/auth">Sign in here</Link>
        </p>
        <div className="mt-8 flex justify-center">
          <a className="navlink inline-flex items-center gap-2 text-sm" href="#how">Click here to proceed <ArrowRight size={15} /></a>
        </div>
      </section>

      <section id="features" className="section border-y border-[#eadde0] bg-[#fffdfa]/65">
        <div className="container">
          <div className="eyebrow">One platform, two perspectives</div>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Useful tools for both sides of a loan.</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <div className="card" key={title}>
                <Icon className="text-[#b77b89]" size={25} />
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="muted mt-2 leading-7">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <div className="container grid gap-12 md:grid-cols-2">
          <div>
            <div className="eyebrow">For lenders</div>
            <h2 className="mt-3 text-3xl font-semibold">Manage lending records in one place.</h2>
            <p className="muted mt-4 leading-7">Manage your own borrowers, agreements, payment schedules and documents. Your private records are not visible to other lenders.</p>
          </div>
          <div>
            <div className="eyebrow">For borrowers</div>
            <h2 className="mt-3 text-3xl font-semibold">Understand your loan and your records.</h2>
            <p className="muted mt-4 leading-7">View your own repayment history, check balances and due dates, manage directory consent, and raise a dispute if something is incorrect.</p>
          </div>
        </div>
      </section>

      <section id="privacy" className="section border-t border-[#eadde0] bg-[#fffdfa]/65">
        <div className="container max-w-4xl text-center">
          <Sprout className="mx-auto text-[#b77b89]" size={34} />
          <h2 className="mt-4 text-3xl font-semibold">Your information deserves protection.</h2>
          <p className="muted mt-4 leading-7">Credee is designed around restricted access, explicit consent, correction and dispute processes, and audit trails. Government IDs, selfies, addresses and private agreements are never part of a public searchable directory.</p>
          <p className="muted mt-3 text-sm">The platform must be configured and reviewed for applicable privacy and credit-reporting requirements before real personal or financial data is entered.</p>
        </div>
      </section>

      <footer className="container flex flex-col justify-between gap-4 py-8 text-sm text-[#8b7d80] md:flex-row">
        <span>© {new Date().getFullYear()} Credee. Built for clearer lending relationships.</span>
        <div className="flex gap-5">
          <a className="navlink" href="#privacy">Privacy</a>
          <a className="navlink" href="#how">About</a>
          <Link className="navlink" href="/auth">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}
