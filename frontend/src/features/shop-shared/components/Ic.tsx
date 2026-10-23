import type { ReactNode, SVGProps } from 'react';

// The Customer prototype's icon set (24×24, stroke 1.8). Kept local because several shapes
// differ from the shared icon set (cart, home, user, star, tag…).
const IC = {
  cup: (
    <>
      <path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 9h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  shirt: <path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z" />,
  basket: (
    <>
      <path d="M3 10h18l-2 10H5z" />
      <path d="M8 10l4-6 4 6M9 14v3M15 14v3M12 14v3" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15" />
      <path d="M5 19l7-7" />
    </>
  ),
  brush: (
    <>
      <path d="M14 4l6 6-8 8H6v-6z" />
      <path d="M4 21h5" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.5 7.5 20 18M8.5 16.5 20 6" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z" />
      <path d="M14.5 6.5 17 4l3 3-2.5 2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  cart: (
    <>
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 21h4" />
    </>
  ),
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  home: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  left: <path d="m15 6-6 6 6 6" />,
  share: <path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" />
    </>
  ),
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  star: <path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  truck: (
    <>
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  store: (
    <>
      <path d="M3 9 4.5 4h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M3 9h18M9 20v-6h6v6" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  filter: <path d="M3 5h18M6 12h12M10 19h4" />,
  logout: <path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" />,
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IcName = keyof typeof IC;
export const isIcName = (v: string): v is IcName => Object.prototype.hasOwnProperty.call(IC, v);

export interface IcProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IcName;
  size?: number;
}

/** Prototype icon: `<Ic name="cart" size={18} />`. */
export function Ic({ name, size = 20, ...rest }: IcProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {IC[name]}
    </svg>
  );
}
