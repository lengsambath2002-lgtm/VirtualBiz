import type { SVGProps } from 'react';

// Stroke icons ported from the prototypes' inline SVG set (24×24, 1.8 stroke by default).
// Circles and rects from the originals are written as path segments so every icon is one path.
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  pin: 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  // Marketplace category icons (CATEGORIES[].icon) and the landing page set.
  cup: 'M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2',
  phone: 'M9 2.5h6a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18h2',
  shirt: 'M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z',
  basket: 'M3 10h18l-2 10H5zM8 10l4-6 4 6M9 14v3M15 14v3M12 14v3',
  leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7',
  brush: 'M14 4l6 6-8 8H6v-6zM4 21h5',
  scissors:
    'M3 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0M3 18a3 3 0 1 0 6 0 3 3 0 1 0-6 0M8.5 7.5 20 18M8.5 16.5 20 6',
  wrench: 'M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3zM14.5 6.5 17 4l3 3-2.5 2.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevronDown: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  scan: 'M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 8v8M10 8v8M13 8v8M16 8v8',
  cash: 'M4.5 6h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0',
  box: 'M3 7 12 3l9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
  truck:
    'M3 6h11v10H3zM14 10h4l3 3v3h-7M5.2 18a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M15.2 18a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0',
  calendar:
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  users:
    'M5.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.2 2.6 3.7 5.5',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3z',
  store: 'M3 9 4.5 4h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6',
  // Staff only: the super-admin console.
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4',
  mapPin:
    'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM9.5 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0',
} as const;

export type IconName = keyof typeof PATHS;

/** Narrow a data-driven icon string (e.g. `Category.icon`) to a known icon. */
export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(PATHS, value);
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
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
      <path d={PATHS[name]} />
    </svg>
  );
}
