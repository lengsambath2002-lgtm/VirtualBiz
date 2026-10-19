'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { ShopPhotos } from '@/components/media';
import { PayoutsPanel, VerificationPanel } from '@/features/business-status';
import { cx, s, SwitchRow, useDb, useSellerStore, useUi } from '@/features/seller-shared';
import { round2 } from '@/lib/money';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';

type Toggle = 'online' | 'autoAccept' | 'pickup' | 'cod';

export function SettingsPage() {
  const t = useTranslations('seller.settings');
  const tc = useTranslations('common');
  const db = useDb();
  const shop = db.shop;
  const update = useSellerStore((st) => st.saveShop);
  const toast = useUi((u) => u.showToast);
  const [name, setName] = useState(shop.name);
  const [about, setAbout] = useState(shop.about);
  const [phone, setPhone] = useState(formatPhone(shop.phone));
  const [addr, setAddr] = useState(shop.addr);
  const [errs, setErrs] = useState<{ sn?: string; sp?: string }>({});
  const [zones, setZones] = useState(shop.zones.map((z) => String(z.fee)));
  const [freeOver, setFreeOver] = useState(String(shop.freeDeliveryOver));
  const [khqr, setKhqr] = useState(shop.bakongId);

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
      addr: addr.trim(),
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
              <div className={s.field}>
                <label htmlFor="st-addr">{t('pickupAddr')}</label>
                <input id="st-addr" value={addr} onChange={(e) => setAddr(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className={cx(s.btn, s.btnPrimary)}>
                {t('saveShop')}
              </button>
            </div>
          </div>
        </form>
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
                  {[10, 20, 30, 60].map((v) => (
                    <option key={v} value={v}>
                      {t('minutes', { n: v })}
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.field}>
                <label htmlFor="st-low">{t('lowDefault')}</label>
                <select
                  id="st-low"
                  value={shop.lowStockDefault}
                  onChange={(e) => {
                    void update({ lowStockDefault: +e.target.value }).then(
                      (ok) => ok && toast(t('saved')),
                    );
                  }}
                >
                  {[2, 3, 5, 10].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>
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
            <div className={s.tblWrap}>
              <table style={{ minWidth: 420 }}>
                <thead>
                  <tr>
                    <th>{t('zone')}</th>
                    <th className={s.r}>{t('fee')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shop.zones.map((z, i) => (
                    <tr key={z.label}>
                      <td>{z.label}</td>
                      <td className={s.r}>
                        <div className={s.prefix} style={{ width: 100, marginLeft: 'auto' }}>
                          <span>$</span>
                          <input
                            value={zones[i] ?? ''}
                            inputMode="decimal"
                            aria-label={t('feeFor', { zone: z.label })}
                            style={{
                              width: '100%',
                              height: 34,
                              border: '1px solid var(--line)',
                              padding: '0 8px',
                              textAlign: 'right',
                            }}
                            onChange={(e) =>
                              setZones((x) => x.map((y, j) => (j === i ? e.target.value : y)))
                            }
                            onBlur={() => {
                              const v = parseFloat(zones[i] ?? '');
                              if (!(v >= 0)) {
                                setZones((x) => x.map((y, j) => (j === i ? String(z.fee) : y)));
                                toast(t('errFee'));
                                return;
                              }
                              if (round2(v) === z.fee) return;
                              void update({
                                zones: shop.zones.map((zz, j) =>
                                  j === i ? { ...zz, fee: round2(v) } : zz,
                                ),
                              }).then((ok) => ok && toast(t('feeSaved')));
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                placeholder="name@bank"
                style={{ fontFamily: 'var(--f-mono)' }}
                onChange={(e) => setKhqr(e.target.value)}
                onBlur={() => {
                  if (khqr.trim() === shop.bakongId) return;
                  void update({ bakongId: khqr.trim() }).then((ok) => ok && toast(t('saved')));
                }}
              />
              <span className={s.hint}>{t('khqrHint')}</span>
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
    </>
  );
}
