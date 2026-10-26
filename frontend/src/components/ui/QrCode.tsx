'use client';

import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** An authenticator QR code for an `otpauth://` URI (SVG, crisp at any size). */
export function QrCode({ text, label }: { text: string; label: string }) {
  const qr = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text, 'Byte');
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${qr.n} ${qr.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={qr.d} fill="#000" />
    </svg>
  );
}
