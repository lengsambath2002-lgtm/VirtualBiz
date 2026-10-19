import { JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

// The sign-in prototype sets its 6-digit code boxes and the code toast in JetBrains Mono 500.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-jbmono',
  display: 'swap',
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className={mono.variable}>{children}</div>;
}
