import Link from "next/link";
import { ArrowRight, Flower2, HandCoins, HeartHandshake, ShieldCheck, WalletCards, CalendarCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="container flex items-center justify-between py-4">
        <Link href="/" aria-label="Credee home" className="text-2xl font-black tracking-[0.12em] text-[#a65e73] no-underline">
          CREDEE<span className="ml-2 align-middle text-xs text-[#b99a62]">✿</span>
        </Link>
        <Link className="btn btn-outline !px-4 !py-2" href="/auth">Sign in <ArrowRight size={15} className="ml-2" /></Link>
      </header>

      <section className="container pb-8 pt-5 md:pb-12 md:pt-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow mb-3 flex items-center justify-center gap-2"><Flower2 size={15} /> A lending community built on trust</div>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            <span className="gradient">Borrow with confidence. Lend with clarity.</span>
          </h1>
          <p className="muted mx-auto mt-3 max-w-xl text-base leading-7 md:text-lg">
            A simpler way for borrowers and lenders to keep loan agreements, payments and records organized.
          </p>
        </div>

        <div className="mx-auto mt-7 grid max-w-5xl gap-4 md:grid-cols-2">
          <article className="relative overflow-hidden rounded-[1.7rem] border-2 border-[#d99aaa] bg-gradient-to-br from-[#fff0f4] via-[#fbe4eb] to-[#f2d6df] p-6 shadow-[0_14px_35px_rgba(166,94,115,0.18)] md:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a65e73] text-white"><HeartHandshake size={24} /></div>
              <div><div className="eyebrow">Start here</div><h2 className="text-2xl font-bold text-[#754657]">For borrowers</h2></div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#795966]">Looking for financial support? Keep your loan details, payment schedule and repayment history clear in one place.</p>
            <Link className="btn btn-primary mt-5 w-full justify-center ring-2 ring-[#d8b56e] ring-offset-2 ring-offset-[#fbe4eb]" href="/auth?role=borrower">
              Register as a borrower <ArrowRight size={16} className="ml-2" />
            </Link>
          </article>

          <article className="glass rounded-[1.7rem] p-6 md:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3e3e7] text-[#a65e73]"><HandCoins size={24} /></div>
              <div><div className="eyebrow">Join the community</div><h2 className="text-2xl font-bold">For lenders</h2></div>
            </div>
            <p className="muted mt-4 text-sm leading-6">Organize borrowers, record loan agreements, track balances and due dates, and keep payment histories together.</p>
            <Link className="btn btn-outline mt-5 w-full justify-center" href="/auth?role=lender">
              Register as a lender <ArrowRight size={16} className="ml-2" />
            </Link>
          </article>
        </div>

        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-[#8f6e79] md:text-sm">
          <span className="inline-flex items-center gap-2"><WalletCards size={15} /> Organized loan records</span>
          <span className="inline-flex items-center gap-2"><CalendarCheck size={15} /> Clear payment tracking</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15} /> Privacy-conscious access</span>
        </div>
        <p className="mt-5 text-center text-sm text-[#98717c]">Already a member? <Link className="font-bold underline underline-offset-4" href="/auth">Sign in here</Link></p>
      </section>

      <footer className="container border-t border-[#eadde0] py-4 text-center text-xs text-[#8b7d80]">
        © {new Date().getFullYear()} Credee. Built for clearer lending relationships.
      </footer>
    </main>
  );
}
