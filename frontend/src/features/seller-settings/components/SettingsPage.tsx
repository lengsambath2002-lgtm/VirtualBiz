'use client';

import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { ShopPhotos } from '@/components/media';
import { PayoutsPanel, VerificationPanel } from '@/features/business-status';
import { cx, s, SwitchRow, useDb, useSellerStore, useUi } from '@/features/seller-shared';
import { usePlatformSettings } from '@/lib/platform';
import { useMyRole, useWorkspaceBusiness } from '@/features/account-switcher';
import { patchBusinessApi } from '@/features/seller-shared/api';
import {
  DeliveryZonesPanel,
  HoursPanel,
  LocationPanel,
  PolicyPanel,
  ReturnWindow,
  type SaveBusiness,
} from '@/features/shop-settings';
import type { Business } from '@/lib/domain';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';

type Toggle = 'online' | 'autoAccept' | 'pickup' | 'cod';

export function SettingsPage() {
  const t = useTranslations('seller.settings');
  const platform = usePlatformSettings();
  const tc = useTranslations('common');
  const db = useDb();
  const shop = db.shop;
  const update = useSellerStore((st) => st.saveShop);
  const toast = useUi((u) => u.showToast);
  const [name, setName] = useState(shop.name);
  const [about, setAbout] = useState(shop.about);
  const [phone, setPhone] = useState(formatPhone(shop.phone));
  const [errs, setErrs] = useState<{ sn?: string; sp?: string }>({});
  const [freeOver, setFreeOver] = useState(String(shop.freeDeliveryOver));
  const [low, setLow] = useState(String(shop.lowStockDefault));
  const [khqr, setKhqr] = useState(shop.bakongId);
  // What this member's role may change (docs/api/phase10-shop-team.md); the API enforces it.
  const role = useMyRole(shop.id);
  // Location, hours, zones, returns and policy save straight to the API; the cached business
  // then refreshes the workspace (useSellerBootstrap applies it).
  const { business } = useWorkspaceBusiness('PRODUCT');
  const qc = useQueryClient();
  const saveBusiness: SaveBusiness = async (patch) => {
    try {
      const b = (await patchBusinessApi(shop.id, patch)) as Business;
      qc.setQueryData(['business', shop.id], b);
      return true;
    } catch {
      return false;
    }
  };
  const tt = useTranslations('team');

  const saveShop = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const e2 = {
      sn: n.length < 2 ? t('errName') : '',
      sp: isValidPhone(phone) ? '' : t('errPhone'),
    };
    setErrs(e2);
    if (e2.sn || e2.sp) return;
    void update({
      name: n,
      about: about.trim(),
      phone: normalizePhone(phone),
    }).then((ok) => ok && toast(t('shopSaved')));
  };
  const toggle = (k: Toggle) => (v: boolean) => {
    void update({ [k]: v }).then((ok) => ok && toast(t('saved')));
  };

  return (
    <>
      <div className={s.phH}>
        <h1>{t('title')}</h1>
      </div>
      {role === 'STAFF' && <p className={cx(s.small, s.muted)}>{tt('readOnlySettings')}</p>}
      <fieldset
        disabled={role === 'STAFF'}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'contents' }}
      >
        <div style={{ display: 'grid', gap: 16, maxWidth: 780 }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{tc('image.shopPhotos')}</h2>
            </div>
            <div className={s.panelB}>
              <ShopPhotos
                name={shop.name}
                logoUrl={shop.logoUrl}
                coverUrl={shop.coverUrl}
                onSave={update}
                onToast={toast}
                btn={cx(s.btn, s.btnPrimary, s.btnSm)}
                btnGhost={cx(s.btn, s.btnGhost, s.btnSm)}
              />
              <span className={s.hint}>{tc('image.shopHint')}</span>
            </div>
          </section>
          <form className={s.panel} noValidate onSubmit={saveShop}>
            <div className={s.panelH}>
              <h2>{t('shop')}</h2>
            </div>
            <div className={s.panelB}>
              <SwitchRow
                title={t('online')}
                hint={t('onlineHint')}
                checked={shop.online}
                onChange={toggle('online')}
              />
              <div className={cx(s.field, errs.sn && s.bad)}>
                <label htmlFor="st-name">{t('name')}</label>
                <input id="st-name" value={name} onChange={(e) => setName(e.target.value)} />
                <div className={s.err}>{errs.sn}</div>
              </div>
              <div className={s.field}>
                <label htmlFor="st-about">{t('about')}</label>
                <textarea
                  id="st-about"
                  maxLength={300}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                />
              </div>
              <div className={s.g2}>
                <div className={cx(s.field, errs.sp && s.bad)}>
                  <label htmlFor="st-phone">{t('phone')}</label>
                  <input
                    id="st-phone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <div className={s.err}>{errs.sp}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className={cx(s.btn, s.btnPrimary)}>
                  {t('saveShop')}
                </button>
              </div>
            </div>
          </form>
          {business && (
            <>
              <LocationPanel business={business} save={saveBusiness} canEdit={role !== 'STAFF'} />
              <HoursPanel business={business} save={saveBusiness} canEdit={role !== 'STAFF'} />
            </>
          )}
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('orders')}</h2>
            </div>
            <div className={s.panelB}>
              <SwitchRow
                title={t('autoAccept')}
                hint={t('autoAcceptHint')}
                checked={shop.autoAccept}
                onChange={toggle('autoAccept')}
              />
              <div className={s.g2}>
                <div className={s.field}>
                  <label htmlFor="st-prep">{t('prep')}</label>
                  <select
                    id="st-prep"
                    value={shop.prepMinutes}
                    onChange={(e) => {
                      void update({ prepMinutes: +e.target.value }).then(
                        (ok) => ok && toast(t('saved')),
                      );
                    }}
                  >
                    {[...new Set([5, 10, 15, 20, 30, 45, 60, 90, 120, shop.prepMinutes])]
                      .sort((a, b) => a - b)
                      .map((v) => (
                        <option key={v} value={v}>
                          {t('minutes', { n: v })}
                        </option>
                      ))}
                  </select>
                </div>
                <div className={s.field}>
                  <label htmlFor="st-low">{t('lowDefault')}</label>
                  <input
                    id="st-low"
                    type="number"
                    min={0}
                    max={100000}
                    value={low}
                    onChange={(e) => setLow(e.target.value)}
                    onBlur={() => {
                      const v = Math.round(Number(low));
                      if (!(v >= 0) || v === shop.lowStockDefault)
                        return setLow(String(shop.lowStockDefault));
                      void update({ lowStockDefault: v }).then((ok) => ok && toast(t('saved')));
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
          {business?.type === 'PRODUCT' && (
            <ReturnWindow business={business} save={saveBusiness} canEdit={role !== 'STAFF'} />
          )}
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('delivery')}</h2>
            </div>
            <div className={s.panelB}>
              <SwitchRow
                title={t('pickup')}
                hint={t('pickupHint')}
                checked={shop.pickup}
                onChange={toggle('pickup')}
              />
              <div className={s.field}>
                <label htmlFor="st-free">{t('freeOver')}</label>
                <div className={s.prefix} style={{ maxWidth: 160 }}>
                  <span>$</span>
                  <input
                    id="st-free"
                    value={freeOver}
                    inputMode="decimal"
                    onChange={(e) => setFreeOver(e.target.value)}
                    onBlur={() => {
                      const v = parseFloat(freeOver);
                      if (v >= 0 && v !== shop.freeDeliveryOver) {
                        void update({ freeDeliveryOver: v }).then((ok) => ok && toast(t('saved')));
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
          <VerificationPanel
            businessId={shop.id}
            bakongId={shop.bakongId}
            panel={s.panel}
            head={s.panelH}
            body={s.panelB}
            btn={cx(s.btn, s.btnGhost, s.btnSm)}
            onToast={toast}
          />
          {business?.type === 'PRODUCT' && (
            <DeliveryZonesPanel
              business={business}
              save={saveBusiness}
              canEdit={role !== 'STAFF'}
            />
          )}
          {business && (
            <PolicyPanel business={business} save={saveBusiness} canEdit={role !== 'STAFF'} />
          )}
          <PayoutsPanel businessId={shop.id} panel={s.panel} head={s.panelH} body={s.panelB} />
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('payments')}</h2>
            </div>
            <div className={s.panelB}>
              <div className={s.field}>
                <label htmlFor="st-khqr">{t('khqr')}</label>
                <input
                  id="st-khqr"
                  value={khqr}
                  disabled={!!role && role !== 'OWNER'}
                  placeholder="name@bank"
                  style={{ fontFamily: 'var(--f-mono)' }}
                  onChange={(e) => setKhqr(e.target.value)}
                  onBlur={() => {
                    if (khqr.trim() === shop.bakongId) return;
                    void update({ bakongId: khqr.trim() }).then((ok) => ok && toast(t('saved')));
                  }}
                />
                <span className={s.hint}>
                  {role && role !== 'OWNER'
                    ? tt('ownerOnlyPayout')
                    : t('khqrHint', { days: platform.payoutDelayDays })}
                </span>
              </div>
              <SwitchRow
                title={t('cod')}
                hint={t('codHint')}
                checked={shop.cod}
                onChange={toggle('cod')}
              />
            </div>
          </section>
        </div>
      </fieldset>
    </>
  );
}
