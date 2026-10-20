#!/usr/bin/env node
/**
 * Fail when any i18n key exists in one locale but not all supported ones, when a value is
 * empty, or when kh.json still holds an untranslated copy of the English text.
 * Run via `pnpm i18n:lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// SSOT: read SUPPORTED_LOCALES from src/lib/i18n/config.ts so this guard can't drift.
const CONFIG_PATH = resolve(import.meta.dirname, '..', 'src', 'lib', 'i18n', 'config.ts');
const localeMatch = readFileSync(CONFIG_PATH, 'utf8').match(/SUPPORTED_LOCALES\s*=\s*\[([^\]]*)\]/);
if (!localeMatch) {
  console.error('Could not read SUPPORTED_LOCALES from', CONFIG_PATH);
  process.exit(1);
}
const LOCALES = localeMatch[1]
  .split(',')
  .map((s) => s.trim().replace(/['"]/g, ''))
  .filter(Boolean);

const ROOT = resolve(import.meta.dirname, '..', 'messages');

// messages/<locale>/<namespace>.json — one folder per locale, one file per namespace.
const present = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
const unexpected = present.filter((l) => !LOCALES.includes(l));
const absent = LOCALES.filter((l) => !present.includes(l));
if (unexpected.length || absent.length) {
  console.error('i18n locale-file set does not match SUPPORTED_LOCALES:');
  if (unexpected.length) console.error('  unexpected message files: ' + unexpected.join(', '));
  if (absent.length) console.error('  missing message files: ' + absent.join(', '));
  process.exit(1);
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const composed = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, composed));
    } else {
      out[composed] = value;
    }
  }
  return out;
}

function loadLocale(l) {
  const dir = resolve(ROOT, l);
  const merged = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')))
    merged[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
  return flatten(merged);
}
const namespaceSets = LOCALES.map((l) =>
  readdirSync(resolve(ROOT, l))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .join(','),
);
if (new Set(namespaceSets).size > 1) {
  console.error('i18n namespace files differ between locales:');
  LOCALES.forEach((l, i) => console.error(`  ${l}: ${namespaceSets[i]}`));
  process.exit(1);
}

const dicts = Object.fromEntries(LOCALES.map((l) => [l, loadLocale(l)]));

const problems = [];
const all = new Set(Object.values(dicts).flatMap((d) => Object.keys(d)));
for (const key of all) {
  for (const l of LOCALES) {
    if (!(key in dicts[l])) problems.push(`[${l}] missing ${key}`);
    else if (typeof dicts[l][key] !== 'string' || dicts[l][key].trim() === '')
      problems.push(`[${l}] empty ${key}`);
  }
}

// Untranslated guard: a kh value with Latin letters but no Khmer script, identical to en, is a
// copy-paste leak. Brand/proper nouns that are legitimately the same go in SAME_OK.
const SAME_OK = new Set([
  'common.appName',
  'common.payments.khqr',
  'common.payments.visa',
  'common.payments.mastercard',
  'common.payments.abaPay',
  'common.payments.wing',
  'common.payments.acleda',
  'marketing.mock.iphone',
  'marketing.mock.airpods',
  'auth.email.placeholder',
  'auth.google.emailPlaceholder',
  'auth.phonename.emailPlaceholder',
  'shop.account.methods.GOOGLE',
  'admin.payment.method.KHQR',
  'admin.signIn.GOOGLE',
  'seller.manual.source.FACEBOOK',
  'seller.manual.source.TELEGRAM',
]);
const KHMER = /[ក-៿]/;
if (dicts.kh && dicts.en) {
  for (const [key, v] of Object.entries(dicts.kh)) {
    if (SAME_OK.has(key) || typeof v !== 'string') continue;
    if (v === dicts.en[key] && /[A-Za-z]/.test(v) && !KHMER.test(v))
      problems.push(`[kh] untranslated ${key} = ${JSON.stringify(v)}`);
  }
}

if (problems.length) {
  console.error('i18n check FAILED:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`i18n parity OK — ${all.size} keys × ${LOCALES.length} locales.`);
