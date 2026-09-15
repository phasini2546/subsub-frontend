/* =====================================================================
   SubSub · Data Access Layer · db.ts
   =====================================================================
   แปลงจาก db.js (vanilla) เป็น TypeScript — logic เดิมทั้งหมด
   • เก็บใน localStorage แยก key ตามตารางจริง (ชั่วคราว)
   • ทุกเมธอด = 1 endpoint ที่ backend (NestJS + Prisma) จะทำ
     ต่อ backend จริงเมื่อไหร่ แค่เปลี่ยนข้างในเมธอดเป็น fetch(...)

   ⚠️ field ที่ schema ยังไม่มี (mark _M2/_M3/_M4/_M5/_M6):
     [M2] Billing_Cycle (ตารางรอบบิล)   [M3] Group.billing_cycle
     [M4] Group_Member.leave_requested_at [M5] Payment.reject_reason
     [M6] Group.deposit (เงินประกัน)
   ===================================================================== */

import type {
  User, Group, Member, Payment, BillingCycle,
  GroupRow, GroupDetail, MemberWithDetail, BillingInfo, CreateGroupInput,
} from './types';

/* localStorage keys = ชื่อตาราง */
const K = {
  user:    'subsub_user',
  group:   'subsub_group',
  member:  'subsub_group_member',
  payment: 'subsub_payment',
  cycle:   'subsub_billing_cycle',   // [M2]
} as const;
type TableKey = keyof typeof K;

/* ผู้ใช้ที่ล็อกอินอยู่ (ของจริงมาจาก LINE LIFF profile — แทนที่ใน main.tsx) */
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
   DB — data access layer
   ===================================================================== */
export const DB = {
  me: (): User => ME,
  setMe: (u: User): void => { ME = u; write<User>('user', [u, ...read<User>('user').filter(x => x.user_id !== u.user_id)]); },

  /* GET /api/my-groups — กลุ่มที่ฉันเกี่ยวข้อง + role ของฉัน */
  async getMyGroups(): Promise<GroupRow[]> {
    const groups  = read<Group>('group');
    const members = read<Member>('member');
    const rows: GroupRow[] = [];
    for (const g of groups) {
      const mine = members.find(m => m.group_id === g.group_id && m.user_id === ME.user_id);
      if (!mine) continue;
      const active = members.filter(m => m.group_id === g.group_id && m.status === 'Active');
      rows.push({ ...g, role: mine.role, memberCount: active.length });
    }
    return rows;
  },

  /* POST /api/host/groups — สร้างกลุ่ม + host เป็นสมาชิกแรก + เปิดรอบ 1 */
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
      _billing_cycle: payload.billing_cycle,   // [M3]
      _deposit: payload.total_price,           // [M6]
    };
    groups.push(group);
    write<Group>('group', groups);

    members.push({
      member_id: uuid(), group_id: group.group_id, user_id: ME.user_id,
      joined_date: today(), role: 'Host', status: 'Active',
    });
    write<Member>('member', members);

    const cycles = read<BillingCycle>('cycle');
    cycles.push({ cycle_id: uuid(), group_id: group.group_id, period: 1,
      started_at: new Date().toISOString(), price: group.total_price });
    write<BillingCycle>('cycle', cycles);

    return group;
  },

  /* GET /api/host/groups/:id — group + members(join User+Payment) + requests */
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

    const all = read<Member>('member').filter(m => m.group_id === id);
    const members: MemberWithDetail[] = all.filter(m => m.status !== 'Pending')
      .map(m => ({ ...m, user: userOf(m.user_id), currentPayment: lastPay(m.user_id) }));
    const requests: MemberWithDetail[] = all.filter(m => m.status === 'Pending')
      .map(m => ({ ...m, user: userOf(m.user_id), currentPayment: lastPay(m.user_id) }));

    return { ...g, members, requests };
  },

  /* [ฝั่ง MEMBER จำลอง] คนขอเข้ากลุ่ม + แนบสลิปเงินประกัน */
  async createJoinRequest(groupId: string, name: string): Promise<boolean> {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return false;
    const users = read<User>('user'), members = read<Member>('member'), payments = read<Payment>('payment');

    const uid = uuid();
    users.push({ user_id: uid, line_uid: 'U' + uid.slice(0, 8), display_name: name, pic_user: '' });
    write<User>('user', users);

    members.push({ member_id: uuid(), group_id: groupId, user_id: uid,
      joined_date: today(), role: 'Member', status: 'Pending' });
    write<Member>('member', members);

    const amt = (Number(g.total_price) * 2).toFixed(2);   // ค่าบริการ + เงินประกัน [M6]
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: uid,
      amount: amt, slip_url: '/slips/demo.jpg', status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return true;
  },

  /* PATCH /api/host/payments/:id — อนุมัติ */
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

  /* PATCH /api/host/payments/:id — ปฏิเสธ + เหตุผล [M5] */
  async rejectPayment(groupId: string, userId: string, reason: string): Promise<boolean> {
    const payments = read<Payment>('payment');
    const p = payments.filter(x => x.group_id === groupId && x.user_id === userId)
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))[0];
    if (p) { p.status = 'Rejected'; p._reject_reason = reason; write<Payment>('payment', payments); }
    return true;
  },

  /* ข้อมูลรอบบิลของกลุ่ม (สำหรับแสดง "ครบกำหนด x / อีก y วัน") */
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

  /* ขึ้นรอบบิลใหม่ (Cron) — reset member Active, host ไม่แตะ, คนออกข้าม */
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
    return { period, price: g.total_price };
  },

  /* [ฝั่ง MEMBER] จ่ายค่าบริการรอบเดือน — ยอดค่าบริการเต็ม (ไม่รวมประกัน) */
  async payMonthly(groupId: string, userId: string): Promise<boolean> {
    const g = read<Group>('group').find(x => x.group_id === groupId);
    if (!g) return false;
    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: userId,
      amount: Number(g.total_price).toFixed(2), slip_url: '/slips/demo.jpg',
      status: 'Waiting', paid_at: new Date().toISOString() });
    write<Payment>('payment', payments);
    return true;
  },

  /* DELETE /api/host/groups/:id — cascade */
  async deleteGroup(id: string): Promise<boolean> {
    write<Group>('group',    read<Group>('group').filter(g => g.group_id !== id));
    write<Member>('member',  read<Member>('member').filter(m => m.group_id !== id));
    write<Payment>('payment',read<Payment>('payment').filter(p => p.group_id !== id));
    write<BillingCycle>('cycle', read<BillingCycle>('cycle').filter(c => c.group_id !== id));
    return true;
  },

  /* ล้างข้อมูลทดสอบ */
  reset(): void {
    Object.values(K).forEach(k => localStorage.removeItem(k));
    write<User>('user', [ME]);
  },
};

/* เผยแพร่สำหรับ deriveStatus ใน component */
export function deriveStatus(m: MemberWithDetail): import('./types').UiStatus {
  if (m.leaving) return 'leaving';
  const p = m.currentPayment;
  if (!p) return 'unpaid';
  if (p.status === 'Verified') return 'paid';
  if (p.status === 'Waiting')  return 'review';
  return 'unpaid';   // Rejected → กลับไปค้างจ่าย
}