/* =====================================================================
   SubSub · Data Access Layer · db.ts
   =====================================================================
   • เก็บใน localStorage แยก key ตามตารางจริง (ชั่วคราว)
   • ทุกเมธอด = 1 endpoint ที่ backend (NestJS + Prisma) จะทำ

   field ที่ schema ยังไม่มี — ต้องเพิ่มใน ER diagram/เอกสาร:
     [M2] Billing_Cycle (ตารางรอบบิล)   [M3] Group.billing_cycle
     [M4] Group_Member.leave_requested_at [M5] Payment.reject_reason
     [M6] Group.deposit (เงินประกัน)
     [B1] Group_Member.left_date   — วันที่ออกจากกลุ่ม (ทาง B)
     [B2] Subscription.end_date    — วันที่ลบรายจ่ายส่วนตัว (ทาง B)
   ===================================================================== */

import type {
  User, Group, Member, Payment, BillingCycle,
  GroupRow, GroupDetail, MemberWithDetail, BillingInfo, CreateGroupInput,
  Subscription, DashboardData, Category,
} from './types';

/* แถวกลุ่มฝั่งสมาชิก (แท็บ MEMBER) */
export interface MemberQuote {
  share: number;         // ราคาหารต่อหัวเต็มเดือน
  deposit: number;       // เงินประกัน (= share เต็ม)
  firstAmount: number;   // ค่าบริการเดือนแรก (อาจถูกคิดตามสัดส่วนวัน)
  totalDue: number;      // ยอดรวมที่ต้องชำระแรกเข้า
  fullPrice: number;     // ราคาเต็มทั้งกลุ่ม
  slots: number;         // จำนวนช่องที่หาร
  prorated: boolean;     // true = เข้ากลางรอบ คิดตามสัดส่วนวัน
  usedDays: number;      // จำนวนวันที่คิดค่าบริการเดือนแรก
  daysInMonth: number;   // จำนวนวันในเดือนนั้น
}

export interface MemberGroupRow {
  group_id: string;
  service_name: string;
  category: Category;
  fullPrice: number;     // ราคาเต็มทั้งกลุ่ม/เดือน
  slots: number;         // จำนวนช่องที่คิดราคาหาร
  share: number;         // ราคาหารต่อหัว
  memberCount: number;   // สมาชิก active ปัจจุบัน
  max_slots: number;     // จำนวนช่องสูงสุด
  status: 'Active' | 'Inactive' | 'Pending';  // สถานะสมาชิกของฉัน
  paid: boolean;         // จ่ายรอบล่าสุดแล้ว (Verified)
  state: MemberCardState;// สถานะการ์ด (pending/rejected/joined/leaving)
  dueLabel: string;      // (คงไว้เพื่อความเข้ากันได้) 'วันนี้' หรือ 'd/สิ้นเดือน'
  daysUntil: number;     // จำนวนวันถึงกำหนดชำระ
  nearDue: boolean;      // เหลือ ≤3 วัน
  dueText: string;       // ข้อความมาตรฐาน เช่น 'ครบกำหนด อีก 29 วัน'
  dueUrgent: boolean;    // ≤3 วัน/เลยกำหนด → แสดงแดงเข้ม
}

/* สถานะการ์ดกลุ่มฝั่งสมาชิก */
export type MemberCardState = 'pending' | 'rejected' | 'joined' | 'leaving';

/* localStorage keys = ชื่อตาราง */
const K = {
  user:    'subsub_user',
  group:   'subsub_group',
  member:  'subsub_group_member',
  payment: 'subsub_payment',
  cycle:   'subsub_billing_cycle',       // [M2]
  subscription: 'subsub_subscription',   // รายจ่ายส่วนตัว (ทาง B)
} as const;
type TableKey = keyof typeof K;

/* ผู้ใช้ที่ล็อกอินอยู่ (ของจริงมาจาก LINE LIFF profile) */
let ME: User = { user_id: 'u-me', line_uid: 'Ume000000', display_name: 'ฉัน', pic_user: '' };

/* ---------- helper อ่าน/เขียน localStorage ---------- */
function read<T>(t: TableKey): T[] {
  try { return JSON.parse(localStorage.getItem(K[t]) || '[]') as T[]; }
  catch { return []; }
}
function write<T>(t: TableKey, rows: T[]): void {
  try { localStorage.setItem(K[t], JSON.stringify(rows)); }
  catch { /* localStorage เต็ม/ถูกบล็อก — best-effort */ }
}

/* ปล่อยสมาชิกที่กำลังจะออก เมื่อถึง/เลยวันมีผล → ใส่ left_date (slot ว่างอย่างเป็นทางการ) */
function reconcileLeaves(): void {
  const rows = JSON.parse(localStorage.getItem(K.member) || '[]') as Member[];
  const t = new Date().toISOString().slice(0, 10);
  let changed = false;
  for (const m of rows) {
    if (m.leaving && !m.left_date && m._leave_effective && m._leave_effective <= t) {
      m.left_date = t; m.leaving = false; delete m._leave_effective; changed = true;
    }
  }
  if (changed) { try { localStorage.setItem(K.member, JSON.stringify(rows)); } catch { /* best-effort */ } }
}

/* seed ผู้ใช้ครั้งแรก */
if (!localStorage.getItem(K.user)) write<User>('user', [ME]);

/* ---------- gen ค่าที่ backend ปกติสร้างให้ ---------- */
const uuid = (): string =>
  (crypto?.randomUUID ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

function genInviteCode(): string {
  const s = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return 'SUB-' + s.padEnd(4, 'X');
}
const today = (): string => new Date().toISOString().slice(0, 10);

/* หมวดหมู่ (อังกฤษใน DB) → label ไทย สำหรับ Dashboard */
export const CATEGORY_LABEL: Record<Category, string> = {
  Entertainment: 'บันเทิง',
  Music: 'เพลง',
  Productivity: 'ทำงาน',
  Other: 'อื่น ๆ',
};
const CATEGORY_ORDER: Category[] = ['Entertainment', 'Music', 'Productivity', 'Other'];

/* แยก bankDT ("<ธนาคาร> <เลขบัญชี> <ชื่อบัญชี>") กลับเป็น 3 ช่อง สำหรับหน้าแก้ไข
   best-effort: เลขบัญชี = token แรกที่เป็นตัวเลข/ขีดล้วน — แยกไม่ได้ก็ยัดทั้งก้อนไว้ช่องธนาคาร */
export function splitBankDT(s: string): { bank: string; account: string; holder: string } {
  const parts = (s || '').trim().split(/\s+/).filter(Boolean);
  const idx = parts.findIndex(p => /\d/.test(p) && /^[\d-]+$/.test(p));
  if (idx === -1) return { bank: s || '', account: '', holder: '' };
  return {
    bank: parts.slice(0, idx).join(' '),
    account: parts[idx],
    holder: parts.slice(idx + 1).join(' '),
  };
}

/* =====================================================================
   คำนวณรอบบิลจาก billing_date  [M2]
   ===================================================================== */
const daysInMonth = (y: number, m0: number): number => new Date(y, m0 + 1, 0).getDate();
const clampDay = (y: number, m0: number, day: number): number => Math.min(day, daysInMonth(y, m0));

export function cycleMonths(cycle?: string): number {
  const c = (cycle || 'monthly').toLowerCase();
  if (c.includes('year') || c.includes('annual')) return 12;
  if (c.includes('quarter')) return 3;
  if (c.includes('half') || c === '6') return 6;
  const n = parseInt(c, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function addMonthsClamped(d: Date, months: number): Date {
  const m = d.getMonth() + months;
  const ty = d.getFullYear() + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  return new Date(ty, tm, clampDay(ty, tm, d.getDate()));
}
/* วันครบกำหนดถัดไป: อ้างอิงวัน/เดือน/ปีเต็มของ billing_date แล้วเลื่อนทีละ cm เดือนจนถึง/เลยวันนี้
   → รองรับรอบรายปี/รอบเกิน 1 เดือน (ไม่ตัดเช็คแค่รายเดือน) */
export function nextDueDate(billingDate: string, from: Date = new Date(), cm: number = 1): Date {
  const anchor = new Date(billingDate);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let due = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const step = Math.max(1, cm);
  let guard = 0;
  while (due < base && guard++ < 1200) due = addMonthsClamped(due, step);
  return due;
}

export function daysUntilDue(billingDate: string, from: Date = new Date(), cm: number = 1): number {
  const due = nextDueDate(billingDate, from, cm);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((due.getTime() - base.getTime()) / 86400000);
}

export function reminderState(billingDate: string, from: Date = new Date(), cm: number = 1): BillingInfo['reminder'] {
  const d = daysUntilDue(billingDate, from, cm);
  if (d === 0) return 'due_today';
  if (d === 3) return 'due_in_3days';
  if (d < 0)   return 'overdue';
  return null;
}

/* รูปแบบข้อความ "ครบกำหนดชำระ" มาตรฐานเดียว ใช้ร่วมทั้ง Member และ Service
   - เหลือ > 3 วัน → 'ครบกำหนด อีก N วัน' (สีปกติ)
   - เหลือ ≤ 3 วัน / วันนี้ / เลยกำหนด → urgent = true (แสดงสีแดงเข้ม) */
export function dueCountdown(billingDate: string, from: Date = new Date(), cm: number = 1): { text: string; urgent: boolean; days: number } {
  const days = daysUntilDue(billingDate, from, cm);
  if (days < 0) return { days, urgent: true, text: `เลยกำหนดชำระ ${Math.abs(days)} วัน` };
  if (days === 0) return { days, urgent: true, text: 'ครบกำหนดชำระวันนี้' };
  if (days < 30) return { days, urgent: days <= 3, text: `ครบกำหนด อีก ${days} วัน` };
  const mo = Math.floor(days / 30); const rem = days % 30;
  return { days, urgent: false, text: rem > 0 ? `ครบกำหนด อีก ${mo} เดือน ${rem} วัน` : `ครบกำหนด อีก ${mo} เดือน` };
}

/* =====================================================================
   คำนวณจำนวนเดือนที่ active ในปีปฏิทินที่กำหนด  (หัวใจของทาง B)
   นับจากเดือนเริ่ม → เดือนจบ(หรือเดือนปัจจุบัน) ตัดตามขอบปี
   ===================================================================== */
export function activeMonthsInYear(
  startISO: string, endISO: string | null | undefined, year: number, now: Date = new Date()
): number {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : now;
  const startIdx = start.getFullYear() * 12 + start.getMonth();
  const endIdx   = end.getFullYear() * 12 + end.getMonth();
  const yearLo   = year * 12 + 0;
  const yearHi   = year * 12 + 11;
  const lo = Math.max(startIdx, yearLo);
  const hi = Math.min(endIdx, yearHi);
  if (hi < lo) return 0;
  return hi - lo + 1;
}

/* =====================================================================
   ประวัติราคา/จำนวนช่อง (ทาง B: ราคา/ช่องแก้แล้วมีผล "เดือนถัดไป" ไม่ย้อนหลัง)
   _pricing_history: [{ from:'YYYY-MM', price, max_slots }] เรียงตามเวลา
   ===================================================================== */
const monthKey     = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nextMonthKey = (from: Date = new Date()): string => monthKey(new Date(from.getFullYear(), from.getMonth() + 1, 1));
const monthKeyToIdx = (key: string): number => { const [y, m] = key.split('-').map(Number); return y * 12 + (m - 1); };

/* ราคา/ช่องที่มีผลในเดือน monthIdx (= year*12 + month0) */
function pricingForMonth(g: Group, monthIdx: number): { price: number; slots: number } {
  const hist = g._pricing_history;
  if (hist && hist.length) {
    let chosen = hist[0];
    for (const h of hist) if (monthKeyToIdx(h.from) <= monthIdx) chosen = h;   // hist เรียงตามเวลา → ตัวท้ายสุดที่ยัง ≤ เดือนนี้
    return { price: Number(chosen.price), slots: chosen.max_slots };
  }
  return { price: Number(g.total_price), slots: g.max_slots };   // legacy: ไม่มีประวัติ = ใช้ค่าปัจจุบัน
}

/* ราคา/ช่องที่มีผล ณ ตอนนี้ (ใช้ตอนสร้าง payment/เงินประกัน) */
const pricingNow = (g: Group, now: Date = new Date()) =>
  pricingForMonth(g, now.getFullYear() * 12 + now.getMonth());

/* ข้อมูลราคาสำหรับ UI: ราคาที่ใช้อยู่ตอนนี้ + ราคาที่จะมีผลเดือนหน้า (ถ้ามีการตั้งไว้) */
export function priceInfo(
  g: Group, now: Date = new Date()
): { now: number; slotsNow: number; upcoming: { from: string; price: number; slots: number } | null } {
  const cur = pricingNow(g, now);
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const future = (g._pricing_history ?? [])
    .filter(h => monthKeyToIdx(h.from) > nowIdx)
    .sort((a, b) => monthKeyToIdx(a.from) - monthKeyToIdx(b.from))[0];
  return {
    now: cur.price, slotsNow: cur.slots,
    upcoming: future ? { from: future.from, price: Number(future.price), slots: future.max_slots } : null,
  };
}

/* =====================================================================
   DB — data access layer
   ===================================================================== */
export const DB = {
  me: (): User => ME,
  setMe: (u: User): void => { ME = u; write<User>('user', [u, ...read<User>('user').filter(x => x.user_id !== u.user_id)]); },

  async getMyGroups(): Promise<GroupRow[]> {
    reconcileLeaves();
    const groups  = read<Group>('group');
    const members = read<Member>('member');
    const rows: GroupRow[] = [];
    for (const g of groups) {
      const mine = members.find(m => m.group_id === g.group_id && m.user_id === ME.user_id && !m.left_date);
      if (!mine) continue;
      const active = members.filter(m => m.group_id === g.group_id && m.status === 'Active' && !m.left_date);
      rows.push({ ...g, role: mine.role, memberCount: active.length });
    }
    return rows;
  },

  async createGroup(payload: CreateGroupInput): Promise<Group> {
    const groups  = read<Group>('group');
    const members = read<Member>('member');
    const group: Group = {
      group_id: uuid(),
      user_id: ME.user_id,
      service_name: payload.service_name,
      total_price: payload.total_price,
      max_slots: payload.max_slots,
      billing_date: payload.billing_date,
      invite_code: genInviteCode(),
      category: payload.category,
      bankDT: payload.bankDT,
      _billing_cycle: payload.billing_cycle,
      _deposit: payload.total_price,
      _pricing_history: [{ from: monthKey(new Date()), price: payload.total_price, max_slots: payload.max_slots }],  // [M7]
    };
    groups.push(group);
    write<Group>('group', groups);
    members.push({
      member_id: uuid(), group_id: group.group_id, user_id: ME.user_id,
      joined_date: today(), role: 'Host', status: 'Active', left_date: null,
    });
    write<Member>('member', members);
    const cycles = read<BillingCycle>('cycle');
    cycles.push({ cycle_id: uuid(), group_id: group.group_id, period: 1,
      started_at: new Date().toISOString(), price: group.total_price });
    write<BillingCycle>('cycle', cycles);
    return group;
  },

  /* แก้ไขข้อมูลกลุ่ม (ไม่แตะ invite_code / _deposit / group_id / user_id) */
  async updateGroup(id: string, payload: CreateGroupInput): Promise<Group | null> {
    const groups = read<Group>('group');
    const g = groups.find(x => x.group_id === id);
    if (!g) return null;

    const oldPrice = g.total_price;
    const oldSlots = g.max_slots;
    const priceChanged = Number(oldPrice) !== Number(payload.total_price);
    const slotsChanged = oldSlots !== payload.max_slots;

    g.service_name   = payload.service_name;
    g.total_price    = payload.total_price;
    g.max_slots      = payload.max_slots;
    g.billing_date   = payload.billing_date;   // (มีผลกับแถบเตือนรอบหน้าเท่านั้น)
    g.category       = payload.category;
    g.bankDT         = payload.bankDT;
    g._billing_cycle = payload.billing_cycle;   // [M3]

    // ราคา/ช่องแก้แล้ว → มีผล "เดือนถัดไป" ไม่ย้อนหลัง (บันทึกลงประวัติ) [M7]
    if (priceChanged || slotsChanged) {
      const hist = g._pricing_history ? [...g._pricing_history] : [];
      if (hist.length === 0) {
        // กลุ่มเก่าที่ยังไม่มีประวัติ → backfill ราคาเดิมให้ครอบทุกเดือนก่อนหน้า
        hist.push({ from: '1970-01', price: Number(oldPrice).toFixed(2), max_slots: oldSlots });
      }
      const from = nextMonthKey();
      const entry = { from, price: Number(payload.total_price).toFixed(2), max_slots: payload.max_slots };
      const i = hist.findIndex(h => h.from === from);
      if (i >= 0) hist[i] = entry; else hist.push(entry);   // แก้ซ้ำในเดือนเดียว = ทับรายการเดิม
      hist.sort((a, b) => monthKeyToIdx(a.from) - monthKeyToIdx(b.from));
      g._pricing_history = hist;
    }

    write<Group>('group', groups);
    return g;
  },

  async getGroup(id: string): Promise<GroupDetail | null> {
    reconcileLeaves();
    const g = read<Group>('group').find(x => x.group_id === id);
    if (!g) return null;
    const users    = read<User>('user');
    const payments = read<Payment>('payment');
    const userOf = (uid: string): User =>
      users.find(u => u.user_id === uid) ?? { user_id: uid, line_uid: '', display_name: 'ผู้ใช้', pic_user: '' };
    const lastPay = (uid: string): Payment | null =>
      payments.filter(p => p.group_id === id && p.user_id === uid && !p._archived)
        .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0] ?? null;
    const all = read<Member>('member').filter(m => m.group_id === id && !m.left_date);
    const members: MemberWithDetail[] = all.filter(m => m.status !== 'Pending')
      .map(m => ({ ...m, user: userOf(m.user_id), currentPayment: lastPay(m.user_id) }));
    const requests: MemberWithDetail[] = all.filter(m => m.status === 'Pending')
      .map(m => ({ ...m, user: userOf(m.user_id), currentPayment: lastPay(m.user_id) }));
    return { ...g, members, requests };
  },

  async createJoinRequest(groupId: string, name: string): Promise<boolean> {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return false;
    const users = read<User>('user'), members = read<Member>('member'), payments = read<Payment>('payment');
    const uid = uuid();
    users.push({ user_id: uid, line_uid: 'U' + uid.slice(0, 8), display_name: name, pic_user: '' });
    write<User>('user', users);
    members.push({ member_id: uuid(), group_id: groupId, user_id: uid,
      joined_date: today(), role: 'Member', status: 'Pending', left_date: null });
    write<Member>('member', members);
    const amt = (pricingNow(g).price * 2).toFixed(2);   // ราคาที่มีผลตอนนี้ × 2 (ค่าบริการ + เงินประกัน)
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: uid,
      amount: amt, slip_url: '/slips/demo.jpg', status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return true;
  },

  /* POST /api/join — [MEMBER] เข้าร่วมกลุ่มด้วยรหัสเชิญ
     หา group จาก invite_code แล้วเพิ่ม "ฉัน" เป็นสมาชิกสถานะ Pending
     + สร้าง payment รอตรวจ (ค่าบริการ + เงินประกัน) เพื่อให้ Host อนุมัติ */
  async joinByCode(code: string): Promise<'ok' | 'notfound' | 'full' | 'already'> {
    const norm = code.trim().replace(/^#/, '').toUpperCase();
    const g = read<Group>('group').find(x => x.invite_code.toUpperCase() === norm);
    if (!g) return 'notfound';

    const members = read<Member>('member');
    if (members.some(m => m.group_id === g.group_id && m.user_id === ME.user_id && !m.left_date)) return 'already';

    const active = members.filter(m => m.group_id === g.group_id && m.status === 'Active');
    if (active.length >= g.max_slots) return 'full';

    members.push({
      member_id: uuid(), group_id: g.group_id, user_id: ME.user_id,
      joined_date: today(), role: 'Member', status: 'Pending',
    });
    write<Member>('member', members);

    const payments = read<Payment>('payment');
    const amt = (Number(g.total_price) * 2).toFixed(2);   // ค่าบริการ + เงินประกัน [M6]
    payments.push({
      payment_id: uuid(), group_id: g.group_id, user_id: ME.user_id,
      amount: amt, slip_url: '/slips/demo.jpg', status: 'Waiting', paid_at: new Date().toISOString(),
    });
    write<Payment>('payment', payments);
    return 'ok';
  },

  /* =====================================================================
     [MEMBER] ตัวช่วยฝั่งสมาชิก (ขับหน้า Member ทั้งหมด ผ่าน DB จริง)
     ===================================================================== */

  /* หา group จาก id (อ่านอย่างเดียว) */
  findGroupById(id: string): Group | null {
    return read<Group>('group').find(x => x.group_id === id) ?? null;
  },

  /* หา group จากรหัสเชิญ (ไม่แก้ข้อมูล) — ใช้ตอนกรอกรหัสเข้าร่วม */
  findGroupByCode(code: string): Group | null {
    const norm = code.trim().replace(/^#/, '').replace(/\s/g, '').toUpperCase();
    return read<Group>('group').find(x => x.invite_code.replace(/-/g, '').toUpperCase() === norm.replace(/-/g, '')) ?? null;
  },

  /* เช็คสถานะก่อนเข้าร่วม (อ่านอย่างเดียว) */
  memberJoinStatus(groupId: string): 'ok' | 'full' | 'already' {
    const members = read<Member>('member');
    if (members.some(m => m.group_id === groupId && m.user_id === ME.user_id && !m.left_date)) return 'already';
    const g = read<Group>('group').find(x => x.group_id === groupId);
    const active = members.filter(m => m.group_id === groupId && m.status === 'Active' && !m.left_date);
    if (g && active.length >= g.max_slots) return 'full';
    return 'ok';
  },

  /* ราคาต่อหัว + ยอดแรกเข้า (ค่าบริการเดือนแรก + เงินประกัน) ต่อ 1 สมาชิก
     - เข้าวันตัดรอบบิล → คิดค่าบริการเดือนแรกเต็มส่วนแบ่ง (share)
     - เข้ากลางรอบบิล  → คิดตามสัดส่วนวันใช้งานจริง (share/วันในเดือน × วันคงเหลือ)
     ทุกกรณี + เงินประกัน = 1 ส่วนแบ่งเต็ม */
  memberQuote(groupId: string, now: Date = new Date()): MemberQuote | null {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return null;
    const info = priceInfo(g);
    const slots = Math.max(1, info.slotsNow);
    const share = info.now / slots;
    const dim = daysInMonth(now.getFullYear(), now.getMonth());
    const remaining = daysUntilDue(g.billing_date, now);   // 0 = ครบกำหนดวันนี้ (เข้าวันตัดรอบ)
    let firstAmount = share, usedDays = dim, prorated = false;
    if (remaining > 0) {
      usedDays = Math.min(dim, remaining + 1);   // นับวันใช้งานจริงแบบรวมวันตัดรอบ
      firstAmount = (share / dim) * usedDays;
      prorated = true;
    }
    const deposit = share;
    return {
      share, deposit, firstAmount, totalDue: firstAmount + deposit,
      fullPrice: info.now, slots, prorated, usedDays, daysInMonth: dim,
    };
  },

  /* [MEMBER] ส่งคำขอเข้าร่วม + แนบสลิป → เพิ่ม ME เป็นสมาชิก Pending + payment Waiting */
  joinGroupWithSlip(groupId: string, slipUrl: string): 'ok' | 'full' | 'already' | 'notfound' {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return 'notfound';
    const pre = DB.memberJoinStatus(groupId);
    if (pre !== 'ok') return pre;
    const members = read<Member>('member');
    members.push({ member_id: uuid(), group_id: groupId, user_id: ME.user_id,
      joined_date: today(), role: 'Member', status: 'Pending', left_date: null });
    write<Member>('member', members);
    const q = DB.memberQuote(groupId);
    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: ME.user_id,
      amount: (q ? q.totalDue : Number(g.total_price) * 2).toFixed(2),
      slip_url: slipUrl || '/slips/demo.jpg', status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return 'ok';
  },

  /* [MEMBER] แนบสลิปรอบถัดไป (สมาชิกที่อนุมัติแล้ว) → payment Waiting ใหม่ */
  memberPayWithSlip(groupId: string, slipUrl: string): boolean {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return false;
    const q = DB.memberQuote(groupId);
    const base = q ? q.share : Number(g.total_price);
    const amount = DB.myOweFull(groupId) ? base * 2 : base;   // เติมเงินประกันถ้าค้างจากการยกเลิกออก
    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: ME.user_id,
      amount: amount.toFixed(2),
      slip_url: slipUrl || '/slips/demo.jpg', status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return true;
  },

  /* สลิปล่าสุดของ ME ในกลุ่มนี้ (data URL ถ้ามี) */
  myLatestSlip(groupId: string): string | null {
    const p = read<Payment>('payment')
      .filter(x => x.group_id === groupId && x.user_id === ME.user_id && !x._archived)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    return p && p.slip_url && p.slip_url.startsWith('data:') ? p.slip_url : null;
  },

  /* จ่าย (Verified) สำหรับ "รอบบิลปัจจุบัน" แล้วหรือยัง — กันส่งสลิปซ้ำในรอบเดียวกัน
     รอบปัจจุบันเริ่มที่วันตัดรอบล่าสุดที่ <= วันนี้ (payment ก่อนหน้านั้นถือเป็นรอบก่อน) */
  paidCurrentCycle(groupId: string, now: Date = new Date()): boolean {
    return DB.paidCurrentCycleFor(groupId, ME.user_id, now);
  },

  /* จ่าย (Verified) รอบบิลปัจจุบันแล้วหรือยัง สำหรับสมาชิกคนใดก็ได้ (ใช้ให้ roster ตรงกับรอบจริง) */
  paidCurrentCycleFor(groupId: string, userId: string, now: Date = new Date()): boolean {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return false;
    const day = new Date(g.billing_date).getDate();
    let y = now.getFullYear(), mo = now.getMonth();
    let cut = new Date(y, mo, clampDay(y, mo, day));
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (cut.getTime() > base.getTime()) { mo--; if (mo < 0) { mo = 11; y--; } cut = new Date(y, mo, clampDay(y, mo, day)); }
    const p = read<Payment>('payment')
      .filter(x => x.group_id === groupId && x.user_id === userId && !x._archived && x.status === 'Verified')
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    return !!p && new Date(p.paid_at).getTime() >= cut.getTime();
  },

  /* สมาชิกคนนี้ "จ่ายแล้ว/ยังใช้งานได้" ไหม = payment ล่าสุด (ไม่ archived) เป็น Verified
     ใช้ตอนนอกช่วงเก็บเงิน เพื่อไม่ให้สมาชิกที่จ่ายรอบก่อนขึ้น "ยังไม่จ่าย" ทั้งกลุ่ม */
  isSettled(groupId: string, userId: string): boolean {
    const p = read<Payment>('payment')
      .filter(x => x.group_id === groupId && x.user_id === userId && !x._archived)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    return p?.status === 'Verified';
  },

  /* สถานะ payment ล่าสุดของ ME ในกลุ่มนี้ (คงอยู่ใน localStorage → รอด refresh) */
  myPaymentStatus(groupId: string): 'Verified' | 'Waiting' | 'Rejected' | null {
    const p = read<Payment>('payment')
      .filter(x => x.group_id === groupId && x.user_id === ME.user_id && !x._archived)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    return p ? p.status : null;
  },

  /* [MEMBER] ส่งสลิป (ครั้งแรก/รอบเดือน/ส่งใหม่หลังถูกปฏิเสธ) → payment Waiting ใหม่
     - ยัง Pending (แรกเข้า) → คิดยอดแรกเข้า (ค่าบริการ + เงินประกัน)
     - Active (รอบเดือน)     → คิดยอดหารต่อหัว */
  submitMemberSlip(groupId: string, slipUrl: string): boolean {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return false;
    const mine = read<Member>('member').find(m => m.group_id === groupId && m.user_id === ME.user_id && !m.left_date);
    const q = DB.memberQuote(groupId);
    const amount = mine && mine.status === 'Pending'
      ? (q ? q.totalDue : Number(g.total_price) * 2)            // แรกเข้า: ค่าบริการ + เงินประกัน
      : mine && mine._owe_full
        ? (q ? q.share + q.deposit : Number(g.total_price))     // ยกเลิกออกหลังใช้เงินประกัน: จ่ายเต็ม + เติมเงินประกัน
        : (q ? q.share : Number(g.total_price));                // รอบเดือนปกติ: ค่าบริการหารต่อหัว
    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: ME.user_id,
      amount: amount.toFixed(2), slip_url: slipUrl || '/slips/demo.jpg',
      status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return true;
  },

  /* [MEMBER] ยกเลิกการส่งหลักฐาน (สถานะกำลังตรวจสอบ) → ลบ payment Waiting ล่าสุด
     กลับไปสถานะ "ยังไม่ส่งสลิป" เพื่อเปลี่ยนรูป/อัปโหลดใหม่ (ยังอยู่ในกลุ่ม) */
  cancelSlip(groupId: string): boolean {
    const payments = read<Payment>('payment');
    const mine = payments.filter(p => p.group_id === groupId && p.user_id === ME.user_id && !p._archived)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1));
    const latest = mine[0];
    if (!latest || latest.status !== 'Waiting') return false;
    write<Payment>('payment', payments.filter(p => p.payment_id !== latest.payment_id));
    return true;
  },

  /* [MEMBER] ยกเลิกการสมัครเข้ากลุ่ม (ยังไม่อนุมัติ) → นำ ME ออก + ลบ payment ทั้งหมดในกลุ่ม
     ใช้ตอนถูกปฏิเสธแล้วเลือกไม่ส่งใหม่ */
  cancelJoin(groupId: string): boolean {
    const members = read<Member>('member');
    const mine = members.find(m => m.group_id === groupId && m.user_id === ME.user_id && !m.left_date);
    if (!mine || mine.status === 'Active') return false;   // อนุมัติแล้วต้องใช้ requestLeave แทน
    write<Member>('member', members.filter(m => m.member_id !== mine.member_id));
    write<Payment>('payment', read<Payment>('payment').filter(p => !(p.group_id === groupId && p.user_id === ME.user_id)));
    return true;
  },

  /* [DEV] จำลองโฮสต์ปฏิเสธสลิปล่าสุดของ ME (ทดสอบ state ถูกปฏิเสธ) */
  async devRejectMyLatest(groupId?: string): Promise<number> {
    const members = read<Member>('member').filter(m => m.user_id === ME.user_id && !m.left_date);
    const targets = groupId ? members.filter(m => m.group_id === groupId) : members;
    let n = 0;
    for (const m of targets) {
      const has = read<Payment>('payment').some(p => p.group_id === m.group_id && p.user_id === ME.user_id && !p._archived && p.status === 'Waiting');
      if (has) { await DB.rejectPayment(m.group_id, ME.user_id, 'ยอดเงินไม่ตรง'); n++; }
    }
    return n;
  },

  /* [MEMBER] กลุ่มที่ฉันเข้าร่วม (แท็บ MEMBER) — ราคาเต็ม + ราคาหาร + สถานะ */
  async getMemberGroups(): Promise<MemberGroupRow[]> {
    reconcileLeaves();
    const groups = read<Group>('group');
    const members = read<Member>('member');
    const payments = read<Payment>('payment');
    const rows: MemberGroupRow[] = [];
    for (const g of groups) {
      const mine = members.find(m => m.group_id === g.group_id && m.user_id === ME.user_id && m.role === 'Member' && !m.left_date);
      if (!mine) continue;
      const active = members.filter(m => m.group_id === g.group_id && m.status === 'Active' && !m.left_date);
      const info = priceInfo(g);
      const slots = Math.max(1, info.slotsNow);
      const myPay = payments.filter(p => p.group_id === g.group_id && p.user_id === ME.user_id && !p._archived)
        .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
      const state: MemberCardState = mine.status === 'Active'
        ? (mine.leaving ? 'leaving' : 'joined')
        : (myPay?.status === 'Rejected' ? 'rejected' : 'pending');
      const bi = DB.billingInfo(g.group_id);
      const due = bi ? new Date(bi.next_due) : null;
      const dueLabel = !bi ? '-'
        : bi.days_until === 0 ? 'วันนี้'
          : `${due!.getDate()}/${daysInMonth(due!.getFullYear(), due!.getMonth())}`;
      const dc = dueCountdown(g.billing_date, new Date(), cycleMonths(g._billing_cycle));
      rows.push({
        group_id: g.group_id, service_name: g.service_name, category: g.category,
        fullPrice: info.now, slots, share: info.now / slots,
        memberCount: active.length, max_slots: g.max_slots,
        status: mine.status, paid: myPay?.status === 'Verified', state,
        dueLabel, daysUntil: bi ? bi.days_until : 99,
        nearDue: bi ? (bi.days_until >= 0 && bi.days_until <= 3) : false,
        dueText: dc.text, dueUrgent: dc.urgent,
      });
    }
    return rows;
  },

  /* [DEV] กลุ่มสาธิตเข้ากลางรอบบิล (idempotent) — ราคาเต็ม 400/4 = 100/หัว
     ตั้งวันตัดรอบ = อีก 6 วัน → คิดค่าบริการเดือนแรกตามสัดส่วน 7 วันใช้งานจริง + เงินประกัน */
  ensureMidCycleDemo(now: Date = new Date()): Group {
    const code = 'SPOTIFY-7';
    const existing = read<Group>('group').find(x => x.invite_code.toUpperCase() === code);
    if (existing) return existing;
    const users = read<User>('user');
    const hostId = uuid();
    users.push({ user_id: hostId, line_uid: 'Uhost' + hostId.slice(0, 6), display_name: 'โฮสต์ Spotify', pic_user: '' });
    write<User>('user', users);
    const cut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
    const g: Group = {
      group_id: uuid(), user_id: hostId, service_name: 'Spotify (สาธิต)',
      total_price: '400.00', max_slots: 4, billing_date: cut.toISOString().slice(0, 10),
      invite_code: code, category: 'Music',
      bankDT: 'ธนาคารกสิกรไทย (KBANK) 123-4-56789-0 สมชาย ไดมอนด์',
      _billing_cycle: 'monthly', _deposit: '100.00',
      _pricing_history: [{ from: '1970-01', price: '400.00', max_slots: 4 }],
    };
    const groups = read<Group>('group'); groups.push(g); write<Group>('group', groups);
    const members = read<Member>('member');
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: hostId, joined_date: today(), role: 'Host', status: 'Active', left_date: null });
    write<Member>('member', members);
    return g;
  },

  /* [DEV] กลุ่มสาธิต "disney" รหัส DISNEY-99 (idempotent) — โฮสต์เป็นคนอื่น + มีสมาชิกตัวอย่าง
     ราคาเต็ม 594 / 6 ช่อง → หารต่อหัว 99 บาท */
  ensureDemoDisney(): Group {
    const existing = read<Group>('group').find(x => x.invite_code.toUpperCase() === 'DISNEY-99');
    if (existing) return existing;
    const users = read<User>('user');
    const hostId = uuid(), aId = uuid(), bId = uuid(), cId = uuid();
    users.push({ user_id: hostId, line_uid: 'Uhost' + hostId.slice(0, 6), display_name: 'โฮสต์ Disney', pic_user: '' });
    users.push({ user_id: aId, line_uid: 'Umem' + aId.slice(0, 6), display_name: 'Member A', pic_user: '' });
    users.push({ user_id: bId, line_uid: 'Umem' + bId.slice(0, 6), display_name: 'Member B', pic_user: '' });
    users.push({ user_id: cId, line_uid: 'Umem' + cId.slice(0, 6), display_name: 'Member C', pic_user: '' });
    write<User>('user', users);

    const g: Group = {
      group_id: uuid(), user_id: hostId, service_name: 'disney',
      total_price: '594.00', max_slots: 6, billing_date: today(),
      invite_code: 'DISNEY-99', category: 'Entertainment',
      bankDT: 'ธนาคารกสิกรไทย (KBANK) 123-4-56789-0 สมชาย ไดมอนด์',
      _billing_cycle: 'monthly', _deposit: '99.00',
      _pricing_history: [{ from: '1970-01', price: '594.00', max_slots: 6 }],
    };
    const groups = read<Group>('group'); groups.push(g); write<Group>('group', groups);

    const members = read<Member>('member');
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: hostId, joined_date: today(), role: 'Host', status: 'Active', left_date: null });
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: aId, joined_date: today(), role: 'Member', status: 'Active', left_date: null });
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: bId, joined_date: today(), role: 'Member', status: 'Active', left_date: null });
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: cId, joined_date: today(), role: 'Member', status: 'Active', left_date: null });
    write<Member>('member', members);

    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: g.group_id, user_id: aId, amount: '99.00', slip_url: '/slips/demo.jpg', status: 'Verified', paid_at: new Date().toISOString() });
    payments.push({ payment_id: uuid(), group_id: g.group_id, user_id: bId, amount: '99.00', slip_url: '/slips/demo.jpg', status: 'Verified', paid_at: new Date().toISOString() });
    payments.push({ payment_id: uuid(), group_id: g.group_id, user_id: cId, amount: '99.00', slip_url: '/slips/demo.jpg', status: 'Verified', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return g;
  },


  async approvePayment(groupId: string, userId: string): Promise<boolean> {
    const payments = read<Payment>('payment');
    const p = payments.filter(x => x.group_id === groupId && x.user_id === userId)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    if (p) { p.status = 'Verified'; write<Payment>('payment', payments); }
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId);
    if (m) {
      if (m.status === 'Pending') m.status = 'Active';
      if (m._owe_full) delete m._owe_full;   // จ่ายเต็ม + เติมเงินประกันแล้ว
      write<Member>('member', members);
    }
    return true;
  },

  async rejectPayment(groupId: string, userId: string, reason: string): Promise<boolean> {
    const payments = read<Payment>('payment');
    const p = payments.filter(x => x.group_id === groupId && x.user_id === userId)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    if (p) { p.status = 'Rejected'; p._reject_reason = reason; write<Payment>('payment', payments); }
    return true;
  },

  /* เตะสมาชิกออก (ทาง B: ใส่ left_date ไม่ลบแถว) */
  async removeMember(groupId: string, userId: string): Promise<boolean> {
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date);
    if (m) { m.left_date = today(); write<Member>('member', members); }   // [B1]
    return true;
  },

  /* [MEMBER] สมาชิกตัดสินใจออกเอง (ไม่ต้องรอ Host อนุมัติ) — ยังใช้งานต่อได้จนถึงวันตัดรอบถัดไป
     รอบสุดท้ายใช้เงินประกันครอบคลุม → ไม่ต้องจ่าย, slot ว่างเมื่อถึงวันมีผล */
  async requestLeave(groupId: string, userId: string): Promise<boolean> {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date);
    if (m && m.role !== 'Host') {
      m.leaving = true;                                    // [M4]
      m._leave_at = today();
      // ใช้งานต่ออีก 1 เดือนเต็ม: เงินประกันครอบคลุมรอบ C1→C2, ออกจริงที่วันตัดรอบถัดจากรอบหน้า (C2)
      if (g) {
        const c1 = nextDueDate(g.billing_date);
        const afterC1 = new Date(c1); afterC1.setDate(afterC1.getDate() + 1);
        m._leave_effective = nextDueDate(g.billing_date, afterC1).toISOString().slice(0, 10);
      } else { m._leave_effective = today(); }
      write<Member>('member', members);
    }
    return true;
  },

  /* [MEMBER] เปลี่ยนใจ — ยกเลิกคำขอออก กลับเป็นสมาชิกปกติ (ก่อนถึงวันมีผล) */
  async cancelLeave(groupId: string, userId: string): Promise<boolean> {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date);
    if (!m || !m.leaving) return true;
    // เงินประกันถูกใช้ไปแล้วหรือยัง = มีวันตัดรอบบิลผ่านไปแล้วตั้งแต่วันแจ้งออก
    const leftAt = m._leave_at ? new Date(m._leave_at) : new Date();
    const cutAfterLeave = g ? nextDueDate(g.billing_date, leftAt).toISOString().slice(0, 10) : today();
    const consumed = cutAfterLeave < today() && m._leave_at !== today();   // ใช้เงินประกันแล้วเฉพาะเมื่อเลยวันตัดรอบจริง (ไม่นับวันแจ้ง/วันตัดรอบเอง)
    m.leaving = false;
    delete m._leave_effective; delete m._leave_at;
    if (consumed) {
      // ใช้เงินประกันไปแล้ว → รอบถัดไปจ่ายเต็ม (ค่าบริการ + เติมเงินประกัน), เคลียร์สถานะจ่ายเดิม
      m._owe_full = true;
      write<Member>('member', members);
      const kept = read<Payment>('payment').filter(p => !(p.group_id === groupId && p.user_id === userId && !p._archived));
      write<Payment>('payment', kept);
    } else {
      delete m._owe_full;
      write<Member>('member', members);
    }
    return true;
  },

  /* ME ต้องจ่ายเต็ม (เติมเงินประกัน) รอบถัดไปหรือไม่ (หลังยกเลิกออกโดยใช้เงินประกันไปแล้ว) */
  myOweFull(groupId: string): boolean {
    const m = read<Member>('member').find(x => x.group_id === groupId && x.user_id === ME.user_id && !x.left_date);
    return !!m?._owe_full;
  },

  /* วันมีผลออกของ ME ในกลุ่มนี้ (ถ้ากำลังจะออก) */
  myLeaveEffective(groupId: string): string | null {
    const m = read<Member>('member').find(x => x.group_id === groupId && x.user_id === ME.user_id && !x.left_date);
    return m?.leaving ? (m._leave_effective ?? null) : null;
  },

  /* [DEV] เร่งเวลาให้คำขอออกของ ME ครบกำหนดทันที (ทดสอบหลุดกลุ่ม + slot ว่าง) */
  async devExpireMyLeave(): Promise<number> {
    const members = read<Member>('member');
    let n = 0;
    for (const m of members) {
      if (m.user_id === ME.user_id && m.leaving && !m.left_date) { m._leave_effective = today(); n++; }
    }
    if (n) write<Member>('member', members);
    reconcileLeaves();
    return n;
  },

  billingInfo(groupId: string): BillingInfo | null {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return null;
    return {
      billing_date: g.billing_date,
      next_due: nextDueDate(g.billing_date, new Date(), cycleMonths(g._billing_cycle)).toISOString().slice(0, 10),
      days_until: daysUntilDue(g.billing_date, new Date(), cycleMonths(g._billing_cycle)),
      reminder: reminderState(g.billing_date, new Date(), cycleMonths(g._billing_cycle)),
    };
  },

    async startNewCycle(groupId: string): Promise<{ period: number; price: string } | null> {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return null;
    let payments = read<Payment>('payment');
    const cycles = read<BillingCycle>('cycle');
    const period = cycles.filter(c => c.group_id === groupId).length + 1;
    cycles.push({ cycle_id: uuid(), group_id: groupId, period,
      started_at: new Date().toISOString(), price: g.total_price });
    write<BillingCycle>('cycle', cycles);
    payments = payments.map(p => p.group_id === groupId ? { ...p, _archived: true } : p);
    write<Payment>('payment', payments);

    // เตะอัตโนมัติ: คนที่กด "ประสงค์ออก" รอบก่อน → นำออกเมื่อขึ้นรอบใหม่ [B1]
    const members = read<Member>('member');
    let changed = false;
    for (const m of members) {
      if (m.group_id === groupId && m.leaving && !m.left_date) {
        m.left_date = today(); m.leaving = false; changed = true;
      }
    }
    if (changed) write<Member>('member', members);

    return { period, price: g.total_price };
  },

  async payMonthly(groupId: string, userId: string): Promise<boolean> {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return false;
    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: userId,
      amount: pricingNow(g).price.toFixed(2), slip_url: '/slips/demo.jpg',   // ราคาที่มีผลรอบนี้
      status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return true;
  },

  async deleteGroup(id: string): Promise<boolean> {
    write<Group>('group',    read<Group>('group').filter(g => g.group_id !== id));
    write<Member>('member',  read<Member>('member').filter(m => m.group_id !== id));
    write<Payment>('payment',read<Payment>('payment').filter(p => p.group_id !== id));
    write<BillingCycle>('cycle', read<BillingCycle>('cycle').filter(c => c.group_id !== id));
    return true;
  },

  /* Subscription ส่วนตัว (ยังไม่มีหน้ากรอก → ตอนนี้ว่าง = 0) */
  async getMySubscriptions(): Promise<Subscription[]> {
    return read<Subscription>('subscription').filter(s => s.user_id === ME.user_id);
  },
  async getSubscription(subId: string): Promise<Subscription | null> {
    return read<Subscription>('subscription').find(s => s.sub_id === subId && s.user_id === ME.user_id) ?? null;
  },
  async addSubscription(s: Omit<Subscription, 'sub_id' | 'user_id' | 'end_date'>): Promise<Subscription> {
    const subs = read<Subscription>('subscription');
    const sub: Subscription = { ...s, sub_id: uuid(), user_id: ME.user_id, end_date: null };
    subs.push(sub); write<Subscription>('subscription', subs);
    return sub;
  },
  async endSubscription(subId: string): Promise<boolean> {
    const subs = read<Subscription>('subscription');
    const s = subs.find(x => x.sub_id === subId && !x.end_date);
    if (s) { s.end_date = today(); write<Subscription>('subscription', subs); }
    return true;
  },
  /* PATCH /api/subscriptions/:id — แก้ไขรายจ่ายส่วนตัว */
  async updateSubscription(
    subId: string,
    patch: Partial<Pick<Subscription, 'service_name' | 'price' | 'billing_date' | 'category' | '_billing_cycle'>>,
  ): Promise<Subscription | null> {
    const subs = read<Subscription>('subscription');
    const s = subs.find(x => x.sub_id === subId && x.user_id === ME.user_id);
    if (!s) return null;
    Object.assign(s, patch);
    write<Subscription>('subscription', subs);
    return s;
  },
  /* DELETE /api/subscriptions/:id — ลบรายจ่ายส่วนตัวออกจริง */
  async deleteSubscription(subId: string): Promise<boolean> {
    write<Subscription>('subscription',
      read<Subscription>('subscription').filter(x => !(x.sub_id === subId && x.user_id === ME.user_id)));
    return true;
  },

  /* GET /api/dashboard — ภาพรวมค่าใช้จ่ายของ ME (รวมกลุ่ม + ส่วนตัว) */
  async getDashboard(year: number = new Date().getFullYear(), now: Date = new Date()): Promise<DashboardData> {
    const groups  = read<Group>('group');
    const members = read<Member>('member').filter(m => m.user_id === ME.user_id);
    const subs    = read<Subscription>('subscription').filter(s => s.user_id === ME.user_id);

    const month: Record<Category, number> = { Entertainment: 0, Music: 0, Productivity: 0, Other: 0 };
    const yearly: Record<Category, number> = { Entertainment: 0, Music: 0, Productivity: 0, Other: 0 };

    const monthIdxNow = now.getFullYear() * 12 + now.getMonth();
    const isActiveThisMonth = (startISO: string, endISO: string | null | undefined) => {
      const s = new Date(startISO); const sIdx = s.getFullYear() * 12 + s.getMonth();
      const eIdx = endISO ? (new Date(endISO).getFullYear() * 12 + new Date(endISO).getMonth()) : monthIdxNow;
      return sIdx <= monthIdxNow && monthIdxNow <= eIdx;
    };

    for (const m of members) {
      const g = groups.find(x => x.group_id === m.group_id);
      if (!g) continue;
      // เดือนนี้: ค่าต่อหัวตามราคาที่มีผลเดือนนี้
      if (isActiveThisMonth(m.joined_date, m.left_date)) {
        const pm = pricingForMonth(g, monthIdxNow);
        month[g.category] += pm.price / pm.slots;
      }
      // รายปี: รวมค่าต่อหัวรายเดือนที่ active ในปีนั้น โดยใช้ราคาตามแต่ละเดือน (ไม่ย้อนหลัง)
      const sIdx = new Date(m.joined_date).getFullYear() * 12 + new Date(m.joined_date).getMonth();
      const eIdx = m.left_date
        ? (new Date(m.left_date).getFullYear() * 12 + new Date(m.left_date).getMonth())
        : monthIdxNow;
      for (let mm = 0; mm < 12; mm++) {
        const idx = year * 12 + mm;
        if (sIdx <= idx && idx <= eIdx) {
          const pm = pricingForMonth(g, idx);
          yearly[g.category] += pm.price / pm.slots;
        }
      }
    }

    for (const s of subs) {
      const price = Number(s.price);
      if (isActiveThisMonth(s.billing_date, s.end_date)) month[s.category] += price;
      const mo = activeMonthsInYear(s.billing_date, s.end_date, year, now);
      yearly[s.category] += price * mo;
    }

    const monthTotal = CATEGORY_ORDER.reduce((sum, c) => sum + month[c], 0);
    const yearTotal  = CATEGORY_ORDER.reduce((sum, c) => sum + yearly[c], 0);
    const byCategory = CATEGORY_ORDER.map(c => ({
      category: c, label: CATEGORY_LABEL[c], amount: month[c],
      percent: monthTotal > 0 ? Math.round((month[c] / monthTotal) * 100) : 0,
    }));
    return { monthTotal, yearTotal, byCategory };
  },

  /* GET /api/dashboard/history — ยอดรวมย้อนหลัง 6 เดือน (นับตรง ไม่ตัดปี)
     เดือนที่ยังไม่มีรายการ = 0 */
  async getSpendingHistory(now: Date = new Date()): Promise<{ month: string; total: number }[]> {
    const groups  = read<Group>('group');
    const members = read<Member>('member').filter(m => m.user_id === ME.user_id);
    const subs    = read<Subscription>('subscription').filter(s => s.user_id === ME.user_id);
    const TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

    const activeInMonth = (startISO: string, endISO: string | null | undefined, idx: number) => {
      const s = new Date(startISO); const sIdx = s.getFullYear() * 12 + s.getMonth();
      const eIdx = endISO ? (new Date(endISO).getFullYear() * 12 + new Date(endISO).getMonth())
                          : (now.getFullYear() * 12 + now.getMonth());
      return sIdx <= idx && idx <= eIdx;
    };

    const out: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const idx = d.getFullYear() * 12 + d.getMonth();
      let total = 0;
      for (const m of members) {
        const g = groups.find(x => x.group_id === m.group_id);
        if (g && activeInMonth(m.joined_date, m.left_date, idx)) { const pm = pricingForMonth(g, idx); total += pm.price / pm.slots; }
      }
      for (const s of subs) {
        if (activeInMonth(s.billing_date, s.end_date, idx)) total += Number(s.price);
      }
      out.push({ month: TH_MON[d.getMonth()], total: Math.round(total) });
    }
    return out;
  },

  /* [DEV] จำลองโฮสต์อนุมัติคำขอ Pending ทั้งหมดของ ME (ทดสอบ flow อนุมัติเข้ากลุ่ม) */
  async devApproveMyPending(): Promise<number> {
    const members = read<Member>('member').filter(m => m.user_id === ME.user_id && m.status === 'Pending' && !m.left_date);
    for (const m of members) await DB.approvePayment(m.group_id, ME.user_id);
    return members.length;
  },

  reset(): void {
    Object.values(K).forEach(k => localStorage.removeItem(k));
    write<User>('user', [ME]);
  },

  /* [DEV/TEST] สร้างกลุ่มสาธิต (โฮสต์เป็นคนอื่น) + สมาชิก Active 1 + คำขอ Pending 1
     คืนรหัสเชิญให้ "ฉัน" นำไปกรอกที่หน้าเข้าร่วมกลุ่ม เพื่อทดสอบฝั่ง Member เต็มวงจร */
  async seedDemoGroup(): Promise<{ group: Group; code: string }> {
    const users = read<User>('user');
    const hostId = uuid(), memId = uuid(), reqId = uuid();
    users.push({ user_id: hostId, line_uid: 'Uhost' + hostId.slice(0, 6), display_name: 'โฮสต์ตัวอย่าง', pic_user: '' });
    users.push({ user_id: memId, line_uid: 'Umem' + memId.slice(0, 6), display_name: 'สมาชิก A', pic_user: '' });
    users.push({ user_id: reqId, line_uid: 'Ureq' + reqId.slice(0, 6), display_name: 'ผู้ขอเข้า B', pic_user: '' });
    write<User>('user', users);

    const code = genInviteCode();
    const groups = read<Group>('group');
    const g: Group = {
      group_id: uuid(), user_id: hostId, service_name: 'Netflix (สาธิต)',
      total_price: '149.00', max_slots: 4, billing_date: today().slice(0, 8) + '15',
      invite_code: code, category: 'Entertainment',
      bankDT: 'กสิกรไทย 123-4-56789-0 สมชาย ใจดี', _billing_cycle: 'monthly', _deposit: '149.00',
    };
    groups.push(g); write<Group>('group', groups);

    const members = read<Member>('member');
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: hostId, joined_date: today(), role: 'Host', status: 'Active' });
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: memId, joined_date: today(), role: 'Member', status: 'Active' });
    members.push({ member_id: uuid(), group_id: g.group_id, user_id: reqId, joined_date: today(), role: 'Member', status: 'Pending' });
    write<Member>('member', members);

    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: g.group_id, user_id: memId, amount: '149.00', slip_url: '/slips/demo.jpg', status: 'Verified', paid_at: new Date().toISOString() });
    payments.push({ payment_id: uuid(), group_id: g.group_id, user_id: reqId, amount: '298.00', slip_url: '/slips/demo.jpg', status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);

    return { group: g, code };
  },
};

export function deriveStatus(m: MemberWithDetail): import('./types').UiStatus {
  if (m.leaving) return 'leaving';
  const p = m.currentPayment;
  if (!p) return 'unpaid';
  if (p.status === 'Verified') return 'paid';
  if (p.status === 'Waiting')  return 'review';
  return 'unpaid';
}