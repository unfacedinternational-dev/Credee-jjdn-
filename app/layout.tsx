import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CreditTrust | Lending with accountability", description: "A smarter way to lend. A better way to build trust." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
