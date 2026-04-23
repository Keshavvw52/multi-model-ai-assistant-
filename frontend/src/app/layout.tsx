import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DM_Mono, DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Multi-Modal AI Assistant',
  description: 'AI assistant that sees, reads, watches, and understands media',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${dmSans.variable} ${dmMono.variable} h-full bg-gray-50 font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}