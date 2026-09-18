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
  localStorage.setItem(K[t], JSON.stringify(rows));
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

export function nextDueDate(billingDate: string, from: Date = new Date()): Date {
  const day = new Date(billingDate).getDate();
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let y = base.getFullYear(), m0 = base.getMonth();
  let due = new Date(y, m0, clampDay(y, m0, day));
  if (due < base) {
    m0++; if (m0 > 11) { m0 = 0; y++; }
    due = new Date(y, m0, clampDay(y, m0, day));
  }
  return due;
}

export function daysUntilDue(billingDate: string, from: Date = new Date()): number {
  const due = nextDueDate(billingDate, from);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((due.getTime() - base.getTime()) / 86400000);
}

export function reminderState(billingDate: string, from: Date = new Date()): BillingInfo['reminder'] {
  const d = daysUntilDue(billingDate, from);
  if (d === 0) return 'due_today';
  if (d === 3) return 'due_in_3days';
  if (d < 0)   return 'overdue';
  return null;
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

  async approvePayment(groupId: string, userId: string): Promise<boolean> {
    const payments = read<Payment>('payment');
    const p = payments.filter(x => x.group_id === groupId && x.user_id === userId)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    if (p) { p.status = 'Verified'; write<Payment>('payment', payments); }
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId);
    if (m && m.status === 'Pending') { m.status = 'Active'; write<Member>('member', members); }
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

  /* สมาชิกกดขอออก — ยังอยู่/ไม่ต้องจ่ายจนจบรอบ แล้วเดือนหน้าถูกเตะอัตโนมัติตอนขึ้นรอบใหม่ */
async requestLeave(groupId: string, userId: string): Promise<boolean> {
  const members = read<Member>('member');
  const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date);
  if (m && m.role !== 'Host') { m.leaving = true; write<Member>('member', members); }  // [M4]
  return true;
  },

  billingInfo(groupId: string): BillingInfo | null {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return null;
    return {
      billing_date: g.billing_date,
      next_due: nextDueDate(g.billing_date).toISOString().slice(0, 10),
      days_until: daysUntilDue(g.billing_date),
      reminder: reminderState(g.billing_date),
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

  reset(): void {
    Object.values(K).forEach(k => localStorage.removeItem(k));
    write<User>('user', [ME]);
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