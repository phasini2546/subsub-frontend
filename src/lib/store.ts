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

/* รหัสเชิญ 8 ตัว รูปแบบ XXXX-XXXX (ตัดตัวที่สับสนง่าย 0/O/1/I) — สุ่มด้วย crypto + กันซ้ำ */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genInviteCode(taken: (code: string) => boolean): string {
  for (let i = 0; i < 50; i++) {
    const buf = new Uint32Array(8);
    globalThis.crypto.getRandomValues(buf);
    const s = Array.from(buf, n => CODE_CHARS[n % CODE_CHARS.length]).join('');
    const code = s.slice(0, 4) + '-' + s.slice(4);
    if (!taken(code)) return code;
  }
  return 'SUB-' + Date.now().toString(36).toUpperCase().slice(-4);
}
