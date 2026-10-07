/* =====================================================================
   SubSub · ที่เก็บข้อมูลชั่วคราว (localStorage) · lib/store.ts
   ---------------------------------------------------------------------
   แยกออกจาก db.ts เพื่อให้ทั้ง db.ts (ของจริง) และ dev/devDb.ts (ข้อมูลสาธิต)
   ใช้ร่วมกันได้ โดยไม่ต้อง export ไส้ใน db.ts ออกไป
   ตอนต่อ backend จริง: ไฟล์นี้จะถูกแทนด้วย HTTP client
   ===================================================================== */

/* localStorage keys = ชื่อตาราง */
export const K = {
  user:    'subsub_user',
  group:   'subsub_group',
  member:  'subsub_group_member',
  payment: 'subsub_payment',
  cycle:   'subsub_billing_cycle',       // [M2]
  subscription: 'subsub_subscription',   // รายจ่ายส่วนตัว (ทาง B)
} as const;
export type TableKey = keyof typeof K;

export function read<T>(t: TableKey): T[] {
  try { return JSON.parse(localStorage.getItem(K[t]) || '[]') as T[]; }
  catch { return []; }
}

export function write<T>(t: TableKey, rows: T[]): void {
  try { localStorage.setItem(K[t], JSON.stringify(rows)); }
  catch { /* localStorage เต็ม/ถูกบล็อก — best-effort */ }
}

export const uuid = (): string =>
  (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

/* รหัสเชิญ 6 ตัว ตัวอักษร+ตัวเลขผสมกัน กลุ่มเดียว (ตัดตัวที่สับสนง่าย 0/O/1/I) — การันตีมีทั้งตัวอักษรและตัวเลข สุ่มด้วย crypto + กันซ้ำ */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_DIGITS = '23456789';
export function genInviteCode(taken: (code: string) => boolean): string {
  const pick = (set: string, n: number) => set[n % set.length];
  for (let i = 0; i < 50; i++) {
    const buf = new Uint32Array(6);
    globalThis.crypto.getRandomValues(buf);
    const code = Array.from(buf, n => pick(CODE_CHARS, n)).join('');
    if (/[A-Z]/.test(code) && /[0-9]/.test(code) && !taken(code)) return code;
  }
  // fallback: ประกอบให้มีทั้งตัวอักษรและตัวเลขแน่นอน
  const b = new Uint32Array(6);
  globalThis.crypto.getRandomValues(b);
  const chars = [CODE_LETTERS[b[0] % CODE_LETTERS.length], CODE_DIGITS[b[1] % CODE_DIGITS.length]];
  for (let j = 2; j < 6; j++) chars.push(CODE_CHARS[b[j] % CODE_CHARS.length]);
  return chars.join('');
}
