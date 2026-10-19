import type { Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils/cn';

/**
 * Locale flags as inline SVG. Emoji flags don't render on Windows, so these are drawn.
 * en → United Kingdom, kh → Cambodia (Angkor Wat simplified for small sizes).
 */
export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      aria-hidden="true"
      className={cn(
        'h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,.12)]',
        className,
      )}
    >
      {locale === 'kh' ? <Cambodia /> : <UnitedKingdom />}
    </svg>
  );
}

function Cambodia() {
  return (
    <>
      <rect width="30" height="20" fill="#032EA1" />
      <rect y="5" width="30" height="10" fill="#E00025" />
      <path
        fill="#fff"
        d="M8 14h14v-1h-1v-2h-1v-1h-1V8.5h-.5V7.4L18 6l-.5 1.4v1.1H17V10h-1V8l-.4-1.1V6L15 4.6 14.4 6v.9L14 8v2h-1V8.5h-.5V7.4L12 6l-.5 1.4v1.1H11V10h-1v1H9v2H8z"
      />
    </>
  );
}

function UnitedKingdom() {
  return (
    <>
      <clipPath id="flag-uk-t">
        <path d="M15 10h15v10zv10H0zH0V0zV0h15z" />
      </clipPath>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path
        d="M0 0l30 20M30 0L0 20"
        clipPath="url(#flag-uk-t)"
        stroke="#C8102E"
        strokeWidth="2.4"
      />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.6" />
    </>
  );
}
