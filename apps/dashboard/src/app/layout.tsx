import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Complii - AUSTRAC Compliance Dashboard',
  description: 'End-to-end AML/CTF compliance platform for Australian businesses',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
