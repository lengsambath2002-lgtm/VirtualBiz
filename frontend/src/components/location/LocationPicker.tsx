'use client';

import 'leaflet/dist/leaflet.css';

import type { Map as LeafletMap } from 'leaflet';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import {
  currentPosition,
  DISTRICT_CENTER,
  PHNOM_PENH,
  reverseGeocode,
  searchPlaces,
  type LatLng,
  type Place,
} from '@/lib/geo';
import { cn } from '@/lib/utils/cn';

import { Icon } from '../ui/Icon';
import s from './LocationPicker.module.css';

type Status =
  | { k: 'idle' }
  | { k: 'locating' }
  | { k: 'looking' }
  | { k: 'pinned'; place: Place }
  | { k: 'error'; msg: 'denied' | 'unavailable' };

/**
 * Pick a location three ways: "Use my current location" (GPS), move the map under a fixed
 * pin (or search a place), or leave it and type the address by hand in the parent form.
 * Every pick calls `onPick` with the point and the street/district read from it, so the
 * parent can fill its fields; the parent's fields stay editable.
 */
export function LocationPicker({
  value,
  district,
  onPick,
  className,
}: {
  /** Saved point, if any. */
  value: LatLng | null;
  /** District chosen in the form; recentres the map while nothing is pinned yet. */
  district?: string;
  onPick: (place: Place) => void;
  className?: string;
}) {
  const t = useTranslations('common.location');
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const quiet = useRef(false);
  const pinned = useRef(!!value);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [status, setStatus] = useState<Status>({ k: 'idle' });
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);

  // Reverse-geocode the map centre after the user stops moving it.
  const lookup = useRef<{ timer?: ReturnType<typeof setTimeout>; ctl?: AbortController }>({});
  const readCentre = (p: LatLng) => {
    clearTimeout(lookup.current.timer);
    lookup.current.ctl?.abort();
    setStatus({ k: 'looking' });
    lookup.current.timer = setTimeout(async () => {
      const ctl = new AbortController();
      lookup.current.ctl = ctl;
      try {
        const place = await reverseGeocode(p, locale, ctl.signal);
        pinned.current = true;
        setStatus({ k: 'pinned', place });
        onPickRef.current(place);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        // Offline or rate-limited: keep the point, the user types the address.
        const place: Place = { ...p, line: '', district: null, label: '' };
        pinned.current = true;
        setStatus({ k: 'pinned', place });
        onPickRef.current(place);
      }
    }, 600);
  };
  const readCentreRef = useRef(readCentre);
  readCentreRef.current = readCentre;

  useEffect(() => {
    let cancelled = false;
    let sizeTimer: ReturnType<typeof setTimeout> | undefined;
    const pending = lookup.current;
    void import('leaflet').then((L) => {
      if (cancelled || !box.current || map.current) return;
      const start = value ?? (district ? DISTRICT_CENTER[district] : undefined) ?? PHNOM_PENH;
      const m = L.map(box.current, {
        center: [start.lat, start.lng],
        zoom: value ? 17 : 15,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(m);
      m.on('moveend', () => {
        if (quiet.current) {
          quiet.current = false;
          return;
        }
        const c = m.getCenter();
        readCentreRef.current({ lat: c.lat, lng: c.lng });
      });
      map.current = m;
      // Inside a sheet the box may size after mount.
      sizeTimer = setTimeout(() => {
        if (map.current === m) m.invalidateSize({ animate: false });
      }, 250);
    });
    return () => {
      cancelled = true;
      clearTimeout(sizeTimer);
      clearTimeout(pending.timer);
      pending.ctl?.abort();
      const m = map.current;
      map.current = null;
      if (m) {
        // Stop pan/zoom animations first: removing mid-animation throws (_leaflet_pos).
        m.off();
        m.stop();
        m.remove();
      }
    };
    // Mount once; later changes move the map below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A district picked by hand moves the map while nothing is pinned yet.
  useEffect(() => {
    const c = district && DISTRICT_CENTER[district];
    if (!c || pinned.current || !map.current) return;
    quiet.current = true;
    map.current.setView([c.lat, c.lng], 15);
  }, [district]);

  const moveTo = (p: LatLng, zoom = 17) => {
    if (!map.current) return;
    map.current.setView([p.lat, p.lng], zoom);
  };

  const locateMe = async () => {
    setStatus({ k: 'locating' });
    try {
      moveTo(await currentPosition());
    } catch (e) {
      setStatus({ k: 'error', msg: (e as Error).message === 'DENIED' ? 'denied' : 'unavailable' });
    }
  };

  // Search: debounce, Phnom Penh only.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults(null);
      return;
    }
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      try {
        setResults(await searchPlaces(term, locale, ctl.signal));
      } catch {
        if (!ctl.signal.aborted) setResults([]);
      }
    }, 500);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, locale]);

  const choose = (p: Place) => {
    setResults(null);
    setQ('');
    quiet.current = true;
    moveTo(p);
    pinned.current = true;
    setStatus({ k: 'pinned', place: p });
    onPickRef.current(p);
  };

  const zoom = (d: 1 | -1) => map.current?.setZoom(map.current.getZoom() + d);

  const line =
    status.k === 'pinned'
      ? [status.place.line, status.place.district].filter(Boolean).join(', ') ||
        `${status.place.lat.toFixed(5)}, ${status.place.lng.toFixed(5)}`
      : '';

  return (
    <div className={cn(s.root, className)}>
      <div className={s.searchRow}>
        <div className={s.search}>
          <Icon name="search" size={16} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search')}
            aria-label={t('searchLabel')}
            autoComplete="off"
          />
          {results && (
            <ul className={s.results} role="listbox" aria-label={t('searchLabel')}>
              {results.length ? (
                results.map((r, i) => (
                  <li key={i} role="option" aria-selected={false}>
                    <button type="button" onClick={() => choose(r)}>
                      <Icon name="mapPin" size={16} />
                      <span>{r.label}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className={s.none}>{t('noResults')}</li>
              )}
            </ul>
          )}
        </div>
      </div>
      <div className={s.mapWrap}>
        <div ref={box} className={s.map} role="application" aria-label={t('mapLabel')} />
        <span className={s.pin} aria-hidden="true">
          <svg width="34" height="44" viewBox="0 0 34 44">
            <path
              d="M17 43C17 43 32 27.5 32 16.5C32 8 25.3 1.5 17 1.5S2 8 2 16.5C2 27.5 17 43 17 43Z"
              fill="var(--sale)"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle cx="17" cy="16.5" r="5.5" fill="#fff" />
          </svg>
        </span>
        <div className={s.zoom}>
          <button type="button" aria-label={t('zoomIn')} onClick={() => zoom(1)}>
            <Icon name="plus" size={16} />
          </button>
          <button type="button" aria-label={t('zoomOut')} onClick={() => zoom(-1)}>
            <span aria-hidden="true">−</span>
          </button>
        </div>
        <button
          type="button"
          className={s.mine}
          onClick={() => void locateMe()}
          disabled={status.k === 'locating'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {status.k === 'locating' ? t('locating') : t('useMine')}
        </button>
      </div>
      <p
        className={cn(s.status, status.k === 'error' && s.bad)}
        role={status.k === 'error' ? 'alert' : 'status'}
      >
        {status.k === 'pinned' ? (
          <>
            <Icon name="mapPin" size={14} />
            {t('pinned', { place: line })}
            {!status.place.district && status.place.label && (
              <span className={s.warn}> {t('outside')}</span>
            )}
          </>
        ) : status.k === 'looking' ? (
          t('looking')
        ) : status.k === 'error' ? (
          t(status.msg)
        ) : (
          t('hint')
        )}
      </p>
    </div>
  );
}
