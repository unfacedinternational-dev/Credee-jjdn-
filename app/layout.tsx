import type { Metadata } from "next";
import "./globals.css";
import CustomerServiceButton from "@/components/customer-service-button";

export const metadata: Metadata = {
  title: "Credee - Multi-Lender & Borrower Reputation Platform",
  description:
    "Connect lenders and borrowers through a transparent lending and repayment reputation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <CustomerServiceButton />
      </body>
    </html>
  );
}
