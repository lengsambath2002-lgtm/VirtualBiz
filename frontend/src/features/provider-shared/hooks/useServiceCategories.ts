import { useData } from '../store';

/**
 * The shop's service categories in its own order, then any category a service uses that the
 * list doesn't have yet (nothing ever disappears from the services page).
 */
export function useServiceCategories(): string[] {
  const d = useData();
  const list = d.business.serviceCategories;
  const extra = [...new Set(d.services.map((s) => s.category))].filter(
    (c) => !list.some((x) => x.toLowerCase() === c.toLowerCase()),
  );
  return [...list, ...extra];
}
