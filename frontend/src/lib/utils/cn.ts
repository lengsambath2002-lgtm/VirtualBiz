import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge the custom theme keys so it doesn't treat them as conflicting with
// colour / shadow utilities (e.g. `bg-primary-sheen` is an image, not a colour).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-image': ['bg-wall', 'bg-primary-sheen', 'bg-accent-sheen'],
      rounded: ['rounded-capsule', 'rounded-tile'],
    },
  },
});

/** Merge class names, letting later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
