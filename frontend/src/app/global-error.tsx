'use client';

import { useEffect } from 'react';

import { feedbackButton, StatusView } from '@/components/feedback';

import './globals.css';

/**
 * Last resort: the root or locale layout itself failed, so there are no providers and no
 * messages. Both languages, a reload, and the error reference for support.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
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
            kind="error"
            title="Something went wrong · មានបញ្ហាកើតឡើង"
            body="VirtualBiz could not load. Try again in a moment. · VirtualBiz មិនអាចផ្ទុកបានទេ។ សូមសាកម្ដងទៀត។"
            actions={
              <>
                <button type="button" className={feedbackButton(true)} onClick={reset}>
                  Try again · សាកម្ដងទៀត
                </button>
                {/* A full page load on purpose: the app itself failed. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a className={feedbackButton()} href="/">
                  Home · ទំព័រដើម
                </a>
              </>
            }
            footnote={error.digest ? `Reference: ${error.digest}` : undefined}
          />
        </main>
      </body>
    </html>
  );
}
