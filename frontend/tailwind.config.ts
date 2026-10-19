import type { Config } from 'tailwindcss';

/**
 * Tokens come from the prototypes' shared "Liquid Glass" layer (`<style id="glass">` plus the
 * base `:root` it overrides). Every colour resolves to a CSS variable defined in
 * src/app/globals.css, so light/dark (prefers-color-scheme or [data-theme]) and the
 * reduced-transparency fallback switch automatically — no `dark:` variants needed.
 * Do not hard-code hex values in components; use these utilities.
 */
const tint = (n: number) => ({
  a: `var(--t${n}a)`,
  b: `var(--t${n}b)`,
  ink: `var(--t${n}i)`,
});

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        sunk: 'var(--sunk)',
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)' },
        muted: 'var(--muted)',
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-h)' },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          on: 'var(--on-primary)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
          on: '#141A2B',
        },
        danger: { DEFAULT: 'var(--sale)', soft: 'var(--sale-soft)' },
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
        focus: 'var(--focus)',
        glass: {
          DEFAULT: 'var(--g-fill)',
          strong: 'var(--g-fill-strong)',
          border: 'var(--g-brd)',
          edge: 'var(--g-edge)',
        },
        t1: tint(1),
        t2: tint(2),
        t3: tint(3),
        t4: tint(4),
        t5: tint(5),
        t6: tint(6),
      },
      fontFamily: {
        sans: ['var(--f-body)'],
        mono: ['var(--f-mono)'],
      },
      borderRadius: {
        // Glass radii: 12 / 20 / 28. Buttons and chips are capsules (rounded-capsule).
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        tile: '16px',
        capsule: '999px',
      },
      boxShadow: {
        glass: 'var(--g-hi), var(--g-shadow)',
        'glass-float': 'var(--g-hi), var(--g-shadow-float)',
        'glass-hi': 'var(--g-hi)',
        button: 'inset 0 1px 0 rgba(255,255,255,.28), 0 4px 14px rgba(20,26,43,.18)',
      },
      backgroundImage: {
        wall: 'var(--wall)',
        'primary-sheen': 'linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0))',
        'accent-sheen': 'linear-gradient(180deg, rgba(255,255,255,.25), rgba(255,255,255,0))',
      },
      transitionTimingFunction: {
        glass: 'cubic-bezier(.2,.8,.2,1)',
        spring: 'cubic-bezier(.2,.9,.25,1.15)',
      },
      keyframes: {
        pop: { from: { transform: 'scale(.94)', opacity: '0' } },
        up: { from: { transform: 'translateY(40px)', opacity: '.4' } },
        fade: { from: { opacity: '0' } },
      },
      animation: {
        pop: 'pop .28s cubic-bezier(.2,.9,.25,1.15)',
        up: 'up .32s cubic-bezier(.2,.9,.25,1)',
        fade: 'fade .15s',
      },
    },
  },
  plugins: [],
};

export default config;
