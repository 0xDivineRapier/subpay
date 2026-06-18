import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SubPay Dashboard',
  description: 'Recurring USDC payments on Solana',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text-primary antialiased">{children}</body>
    </html>
  );
}
