import type { ReactNode } from 'react';

// Minimal root layout. The real <html>/<body>, fonts and providers live in
// app/[locale]/layout.tsx so `lang` follows the active locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
