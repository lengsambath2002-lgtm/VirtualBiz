import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// RFC 6238 codes for the e2e tests (the backend accepts ±1 time step, and never the same step
// twice per account). The last step used per key is kept in a temp file, so a code is never
// replayed across test files, workers or runs.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
// Outside test-results/, which Playwright empties at the start of every run.
const STATE = path.join(tmpdir(), 'vbiz-e2e-totp-steps.json');

function unbase32(s: string): Buffer {
  let bits = 0;
  let buf = 0;
  const out: number[] = [];
  for (const ch of s.replace(/[\s=]/g, '').toUpperCase()) {
    buf = (buf << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((buf >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1]! & 0x0f;
  const bin = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 1_000_000).padStart(6, '0');
}

function load(): Record<string, number> {
  try {
    return existsSync(STATE)
      ? (JSON.parse(readFileSync(STATE, 'utf8')) as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

/** A code for a step this key hasn't used yet (waits when the next one isn't valid yet). */
export async function freshTotp(secret: string): Promise<string> {
  const key = secret.replace(/\s/g, '');
  for (;;) {
    const now = Math.floor(Date.now() / 1000 / 30);
    const state = load();
    const step = Math.max(now, (state[key] ?? -Infinity) + 1);
    if (step <= now + 1) {
      state[key] = step;
      mkdirSync(path.dirname(STATE), { recursive: true });
      writeFileSync(STATE, JSON.stringify(state));
      return totpAt(key, step);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Two-step keys of the local demo staff (backend LocalStaffMfaSeed). */
export const DEMO_TOTP: Record<string, string> = {
  'admin@virtualbiz.com': 'VBIZADMINLOCALDEMOSECRETKEYZZZZZ',
  'support@virtualbiz.com': 'VBIZSUPPORTLOCALDEMOSECRETKEYZZZ',
};
