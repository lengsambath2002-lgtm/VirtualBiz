import type { Metadata } from 'next';
import Link from 'next/link';

import { feedbackButton, StatusView } from '@/components/feedback';

import './globals.css';

export const metadata: Metadata = { title: 'Page not found — VirtualBiz' };

/**
 * A path outside every locale that the middleware did not redirect. The root layout has no
 * <html> (it lives in app/[locale]/layout.tsx), so this page brings its own; the text is in both
 * languages because no locale is known here.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: '100dvh',
            display: 'grid',
            alignContent: 'center',
            background: 'var(--wall), var(--bg)',
          }}
        >
          <StatusView
            kind="notFound"
            code="404"
            title="Page not found · រកមិនឃើញទំព័រ"
            body="The link may be broken, or the page was moved. · តំណអាចខូច ឬទំព័រត្រូវបានផ្លាស់ទី។"
            actions={
              <>
                <Link className={feedbackButton(true)} href="/en">
                  Go to VirtualBiz
                </Link>
                <Link className={feedbackButton()} href="/kh">
                  ទៅ VirtualBiz
                </Link>
              </>
            }
          />
        </main>
      </body>
    </html>
  );
}
