'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import c from './camera.module.css';

/** Barcodes products carry (EAN / UPC on retail goods, Code 128 / 39 on labels) and QR codes. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];
/**
 * The camera sees a code in every frame while it is held there: it counts again only once it has
 * been out of sight this long (take the item away and show it again to add another).
 */
const GONE_MS = 1200;

type State = 'starting' | 'on' | 'denied' | 'unavailable' | 'error';

interface NativeDetector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type NativeDetectorClass = {
  new (opts: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/**
 * The phone's (or laptop's) camera as a barcode scanner: starts when shown, stops when hidden or
 * paused. Uses the browser's own BarcodeDetector where there is one (Chrome on Android) and
 * ZXing elsewhere (iPhone Safari, Firefox). Needs https (or localhost) and the person's OK.
 */
export function CameraScanner({
  onDetect,
  paused = false,
}: {
  /** A code was read; called once per code (again after a pause or a different code). */
  onDetect: (code: string) => void;
  /** Keep the camera off (e.g. while showing what was found). */
  paused?: boolean;
}) {
  const t = useTranslations('common.scanner');
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onDetect);
  cb.current = onDetect;
  const [state, setState] = useState<State>('starting');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (paused) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let zxingStop: (() => void) | undefined;
    let shown: HTMLVideoElement | null = null;
    let last = { code: '', seen: 0 };

    const hit = (code: string) => {
      const now = Date.now();
      if (!code) return;
      const again = code === last.code && now - last.seen < GONE_MS;
      last = { code, seen: now };
      if (again) return;
      navigator.vibrate?.(60);
      setFlash(true);
      setTimeout(() => setFlash(false), 250);
      cb.current(code);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e) {
        const name = (e as DOMException)?.name;
        return setState(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'denied'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'unavailable'
              : 'error',
        );
      }
      if (stopped || !video.current) return stream.getTracks().forEach((tr) => tr.stop());
      const v = video.current;
      shown = v;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      setState('on');

      const Native = (window as unknown as { BarcodeDetector?: NativeDetectorClass })
        .BarcodeDetector;
      const supported = Native ? await Native.getSupportedFormats?.().catch(() => []) : [];
      const formats = FORMATS.filter((f) => supported?.includes(f));
      if (Native && formats.length) {
        const detector = new Native({ formats });
        const tick = async () => {
          if (stopped) return;
          if (v.readyState >= 2) {
            const found = await detector.detect(v).catch(() => []);
            if (found[0]) hit(found[0].rawValue);
          }
          timer = setTimeout(() => void tick(), 120);
        };
        void tick();
        return;
      }
      // No built-in detector: ZXing reads the same video (loaded only when needed).
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (stopped) return;
      const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120 });
      const controls = await reader.decodeFromVideoElement(v, (result) => {
        if (result) hit(result.getText());
      });
      zxingStop = () => controls.stop();
      if (stopped) zxingStop();
    })().catch(() => !stopped && setState('error'));

    return () => {
      stopped = true;
      clearTimeout(timer);
      zxingStop?.();
      stream?.getTracks().forEach((tr) => tr.stop());
      if (shown) shown.srcObject = null;
    };
  }, [paused]);

  if (paused) return null;
  if (state === 'denied' || state === 'unavailable' || state === 'error')
    return (
      <div className={c.off} role="status">
        <strong>{t(`${state}Title`)}</strong>
        <span>{t(`${state}Body`)}</span>
      </div>
    );
  return (
    <div className={c.cam} data-state={state}>
      <video ref={video} className={c.video} muted playsInline aria-label={t('label')} />
      <div className={`${c.frame} ${flash ? c.hit : ''}`} aria-hidden="true">
        <i />
      </div>
      <span className={c.tip}>{state === 'starting' ? t('starting') : t('tip')}</span>
    </div>
  );
}
