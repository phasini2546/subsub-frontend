/* =====================================================================
   SubSub · Data Access Layer · db.ts
   =====================================================================
   • เก็บใน localStorage (lib/store.ts) แยก key ตามตารางจริง (ชั่วคราว)
   • ทุกเมธอด = 1 endpoint ที่ backend (NestJS + Prisma) จะทำ
   • กฎรอบบิล/ราคา/ค้างชำระ อยู่ใน lib/billing.ts (pure) — ไฟล์นี้แค่อ่าน/เขียนข้อมูล
   • วันที่ทั้งหมดเป็นเวลาไทยผ่าน lib/clock.ts + lib/date.ts [B6]
   • ข้อมูลสาธิต/ปุ่มทดสอบ ย้ายไป src/dev/ ทั้งหมด (ไม่ถูก bundle ตอน build production) [B11]

   field ที่ schema ยังไม่มี — ต้องเพิ่มใน ER diagram/เอกสาร:
     [M2] Billing_Cycle   [M3] Group.billing_cycle   [M4] Group_Member.leave_requested_at
     [M5] Payment.reject_reason   [M6] Group.deposit
     [B1] Group_Member.left_date   [B2] Subscription.end_date
     [ใหม่] Group.billing_day, Group.created_at, Payment.cycle_start, Payment.kind,
            Group_Member.removed_reason, Group_Member.reminded_at
   ===================================================================== */

import type {
  User, Group, Member, Payment, BillingCycle, BillStatus, ISODate,
  GroupRow, GroupDetail, MemberWithDetail, BillingInfo, CreateGroupInput,
  Subscription, DashboardData, Category, UiStatus, LeftReason,
} from './types';
import { read, write, uuid, genInviteCode } from './lib/store';
import { todayTH, nowStamp } from './lib/clock';
import { addDays, diffDays, monthIndex, parts, makeDate } from './lib/date';
import {
  cycleMonths, firstBillingDate, firstYearlyDate, cycleIndexAt, currentCycleStart, nextCycleStart,
  upcomingDue, dueText, pricingAt, priceInfo, memberQuote, memberBillStatus, planLeave,
  normalizeFrom, billingDayOf, KICK_AFTER_DAYS, round2,
  type MemberQuote, type CycleSource,
} from './lib/billing';

/* re-export ให้หน้าเดิม import จาก '../db' ได้เหมือนเดิม */
export { priceInfo, cycleMonths, dueText };
export type { MemberQuote };

/* แถวกลุ่มฝั่งสมาชิก (แท็บ MEMBER) */
export interface MemberGroupRow {
  group_id: string;
  service_name: string;
  category: Category;
  fullPrice: number;     // ราคาเต็มทั้งกลุ่ม/รอบ
  slots: number;         // จำนวนช่องที่คิดราคาหาร
  share: number;         // ราคาหารต่อหัว
  memberCount: number;   // ที่นั่งที่ใช้/จองแล้ว (Active + Pending)
  max_slots: number;
  status: 'Active' | 'Inactive' | 'Pending';
  state: MemberCardState;
  bill: BillStatus;
  dueText: string;       // ข้อความมาตรฐาน เช่น 'ครบกำหนด อีก 29 วัน' / 'ค้างชำระ 6 วัน'
  dueUrgent: boolean;
}

/* สถานะการ์ดกลุ่มฝั่งสมาชิก */
export type MemberCardState = 'pending' | 'rejected' | 'joined' | 'due' | 'overdue' | 'leaving';

/* ผู้ใช้ที่ล็อกอินอยู่ (ของจริงมาจาก LINE LIFF profile) */
let ME: User = { user_id: 'u-me', line_uid: 'Ume000000', display_name: 'ฉัน', pic_user: '' };

/* หมวดหมู่ (อังกฤษใน DB) → label ไทย สำหรับ Dashboard */
export const CATEGORY_LABEL: Record<Category, string> = {
  Entertainment: 'บันเทิง',
  Music: 'เพลง',
  Productivity: 'ทำงาน',
  Other: 'อื่น ๆ',
};
const CATEGORY_ORDER: Category[] = ['Entertainment', 'Music', 'Productivity', 'Other'];

/* แยก bankDT ("<ธนาคาร> <เลขบัญชี> <ชื่อบัญชี>") กลับเป็น 3 ช่อง — ใช้ทั้งหน้าแก้ไขและการ์ดบัญชีฝั่งสมาชิก [B1]
   best-effort: เลขบัญชี = token แรกที่เป็นตัวเลข/ขีดล้วน — แยกไม่ได้ก็ยัดทั้งก้อนไว้ช่องธนาคาร */
export function splitBankDT(s: string): { bank: string; account: string; holder: string } {
  const p = (s || '').trim().split(/\s+/).filter(Boolean);
  const idx = p.findIndex(x => /\d/.test(x) && /^[\d-]+$/.test(x));
  if (idx === -1) return { bank: s || '', account: '', holder: '' };
  return { bank: p.slice(0, idx).join(' '), account: p[idx], holder: p.slice(idx + 1).join(' ') };
}

/* ---------------- helpers ภายใน ---------------- */
const byNewest = (a: Payment, b: Payment) => (a.paid_at < b.paid_at ? 1 : -1);
const isOpen = (g: Group) => !g._closed_at;
const userPayments = (all: Payment[], gid: string, uid: string) =>
  all.filter(p => p.group_id === gid && p.user_id === uid).sort(byNewest);

/** ที่นั่งที่ใช้/จองแล้ว = ทุกคนที่ยังไม่ออก (Host + Active + Pending) [B9] */
const seatsUsedOf = (members: Member[], gid: string) =>
  members.filter(m => m.group_id === gid && !m.left_date).length;

/** ปล่อยสมาชิกออกจากกลุ่ม (soft: ใส่ left_date — slot ว่าง, ประวัติยังอยู่) */
function release(m: Member, date: ISODate, reason: LeftReason): void {
  m.left_date = date;
  m._removed_reason = reason;
  m.leaving = false;
}

/* =====================================================================
   ปรับข้อมูลเก่าให้เข้ากับ schema ใหม่ (รันครั้งเดียว)
   ===================================================================== */
const SCHEMA_KEY = 'subsub_schema_version';
const SCHEMA_VERSION = 2;
function migrate(): void {
  let ver = 0;
  try { ver = Number(localStorage.getItem(SCHEMA_KEY) || 0); } catch { /* blocked */ }
  if (ver >= SCHEMA_VERSION) return;

  const groups = read<Group>('group');
  for (const g of groups) {
    g._billing_day ??= parts(g.billing_date).d;
    g._created_at ??= g.billing_date.slice(0, 10);
    if (g._pricing_history) g._pricing_history = g._pricing_history.map(h => ({ ...h, from: normalizeFrom(h.from) }));
  }
  write<Group>('group', groups);

  // payment เก่าไม่มี _kind/_cycle → ใบแรกของแต่ละคน = แรกเข้า, ที่เหลือผูกกับรอบที่ใกล้ที่สุด (เผื่อจ่ายล่วงหน้า 3 วัน)
  const payments = read<Payment>('payment');
  const firstSeen = new Set<string>();
  for (const p of [...payments].sort((a, b) => (a.paid_at < b.paid_at ? -1 : 1))) {
    if (p._kind) continue;
    const key = p.group_id + '|' + p.user_id;
    const g = groups.find(x => x.group_id === p.group_id);
    if (!firstSeen.has(key)) { firstSeen.add(key); p._kind = 'join'; continue; }
    p._kind = 'cycle';
    if (g) p._cycle = currentCycleStart(g, addDays(toDay(p.paid_at), 3)) ?? g.billing_date;
  }
  write<Payment>('payment', payments);
  try { localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION)); } catch { /* blocked */ }
}
const toDay = (ts: string): ISODate => { const p = parts(ts); return makeDate(p.y, p.m, p.d); };

migrate();
if (read<User>('user').length === 0) write<User>('user', [ME]);

/* =====================================================================
   งานอัตโนมัติ (ของจริงต้องเป็น cron ที่ backend ทุกวัน 00:05 เวลาไทย)
   ตอนนี้เรียกทุกครั้งก่อนอ่านข้อมูล:
     1) แจ้งออก + ถึงวันออกจริง → นำออก (slot ว่าง)                    [B9.2]
     2) ค้างชำระครบ 10 วัน (ไม่มีสลิปรอตรวจ) → นำออก + ยึดเงินประกัน     [B2, B9.1]
   ===================================================================== */
function reconcile(): void {
  const today = todayTH();
  const groups = read<Group>('group');
  const members = read<Member>('member');
  const payments = read<Payment>('payment');
  let changed = false;

  for (const m of members) {
    if (m.left_date || m.role === 'Host' || m.status !== 'Active') continue;
    const g = groups.find(x => x.group_id === m.group_id);
    if (!g || !isOpen(g)) continue;

    if (m.leaving && m._leave_effective && m._leave_effective <= today) {
      release(m, m._leave_effective, 'left');
      changed = true;
      continue;
    }
    const bill = memberBillStatus(g, m, userPayments(payments, g.group_id, m.user_id), today);
    if ((bill.phase === 'due' || bill.phase === 'overdue') && bill.kickDate && bill.kickDate <= today) {
      release(m, bill.kickDate, 'overdue');
      m._deposit_forfeited = true;          // เงินประกันถูกยึดเป็นค่าบริการรอบที่ค้าง
      changed = true;
    }
  }
  if (changed) write<Member>('member', members);
}

/* =====================================================================
   DB — data access layer
   ===================================================================== */
export const DB = {
  me: (): User => ME,
  setMe: (u: User): void => { ME = u; write<User>('user', [u, ...read<User>('user').filter(x => x.user_id !== u.user_id)]); },

  /* GET /api/my-groups */
  async getMyGroups(): Promise<GroupRow[]> {
    reconcile();
    const members = read<Member>('member');
    const rows: GroupRow[] = [];
    for (const g of read<Group>('group').filter(isOpen)) {
      const mine = members.find(m => m.group_id === g.group_id && m.user_id === ME.user_id && !m.left_date);
      if (!mine) continue;
      rows.push({ ...g, role: mine.role, memberCount: seatsUsedOf(members, g.group_id) });
    }
    return rows;
  },

  /* POST /api/groups */
  async createGroup(payload: CreateGroupInput): Promise<Group> {
    const today = todayTH();
    const groups = read<Group>('group');
    const yearly = cycleMonths(payload.billing_cycle) === 12;
    // [B7] วันเริ่มรอบแรก = อ้างอิงวันที่สร้างกลุ่ม + วันที่ Host เลือก
    const anchor = yearly && payload.billing_date_full
      ? firstYearlyDate(today, payload.billing_date_full)
      : firstBillingDate(today, payload.billing_day);
    const group: Group = {
      group_id: uuid(),
      user_id: ME.user_id,
      service_name: payload.service_name,
      total_price: payload.total_price,
      max_slots: payload.max_slots,
      billing_date: anchor,
      invite_code: genInviteCode(c => groups.some(x => x.invite_code === c)),
      category: payload.category,
      bankDT: payload.bankDT,
      _billing_cycle: payload.billing_cycle,
      _billing_day: payload.billing_day,
      _created_at: today,
      _closed_at: null,
      _deposit: payload.total_price,
      _pricing_history: [{ from: today, price: payload.total_price, max_slots: payload.max_slots }],
    };
    groups.push(group);
    write<Group>('group', groups);
    const members = read<Member>('member');
    members.push({
      member_id: uuid(), group_id: group.group_id, user_id: ME.user_id,
      joined_date: today, role: 'Host', status: 'Active', left_date: null,
    });
    write<Member>('member', members);
    const cycles = read<BillingCycle>('cycle');
    cycles.push({ cycle_id: uuid(), group_id: group.group_id, period: 1, started_at: anchor, price: group.total_price });
    write<BillingCycle>('cycle', cycles);
    return group;
  },

  /* PATCH /api/groups/:id — แก้ข้อมูลกลุ่ม (ไม่แตะ invite_code / _deposit / group_id / user_id) */
  async updateGroup(id: string, payload: CreateGroupInput): Promise<Group | null> {
    const today = todayTH();
    const groups = read<Group>('group');
    const g = groups.find(x => x.group_id === id && x.user_id === ME.user_id);
    if (!g) return null;

    const oldPrice = g.total_price;
    const oldSlots = g.max_slots;
    const priceChanged = Number(oldPrice) !== Number(payload.total_price);
    const slotsChanged = oldSlots !== payload.max_slots;

    g.service_name = payload.service_name;
    g.total_price  = payload.total_price;
    g.max_slots    = payload.max_slots;
    g.category     = payload.category;
    g.bankDT       = payload.bankDT;

    // เปลี่ยนวันตัดรอบ/ประเภทรอบ → anchor ใหม่ เริ่มนับจาก "วันนี้" (รอบที่จ่ายไปแล้วไม่ถูกย้อน)
    const newCycle = payload.billing_cycle;
    const yearly = cycleMonths(newCycle) === 12;
    const dayChanged = billingDayOf(g) !== payload.billing_day || (g._billing_cycle ?? 'monthly') !== newCycle;
    if (dayChanged || (yearly && payload.billing_date_full && payload.billing_date_full !== g.billing_date)) {
      const from = nextCycleStart(g, today);   // ใช้รอบเดิมให้จบก่อน แล้วค่อยเริ่มวันใหม่
      g.billing_date = yearly && payload.billing_date_full
        ? firstYearlyDate(from, payload.billing_date_full)
        : firstBillingDate(from, payload.billing_day);
      g._billing_day = payload.billing_day;
      g._billing_cycle = newCycle;
    }

    // [B12] ราคา/ช่องใหม่ มีผลตั้งแต่ "รอบบิลถัดไป" (ไม่ใช่เดือนปฏิทินถัดไป) และไม่ย้อนหลัง
    if (priceChanged || slotsChanged) {
      const hist = (g._pricing_history ?? []).map(h => ({ ...h, from: normalizeFrom(h.from) }));
      if (hist.length === 0) hist.push({ from: '1970-01-01', price: Number(oldPrice).toFixed(2), max_slots: oldSlots });
      const from = nextCycleStart(g, today);
      const entry = { from, price: Number(payload.total_price).toFixed(2), max_slots: payload.max_slots };
      const i = hist.findIndex(h => h.from === from);
      if (i >= 0) hist[i] = entry; else hist.push(entry);   // แก้ซ้ำในรอบเดียว = ทับรายการเดิม
      hist.sort((a, b) => (a.from < b.from ? -1 : 1));
      g._pricing_history = hist;
    }

    write<Group>('group', groups);
    return g;
  },

  /* GET /api/groups/:id — สมาชิก + คำขอเข้า + สถานะบิลของทุกคน */
  async getGroup(id: string): Promise<GroupDetail | null> {
    reconcile();
    const today = todayTH();
    const g = read<Group>('group').find(x => x.group_id === id && isOpen(x));
    if (!g) return null;
    const users = read<User>('user');
    const payments = read<Payment>('payment');
    const userOf = (uid: string): User =>
      users.find(u => u.user_id === uid) ?? { user_id: uid, line_uid: '', display_name: 'ผู้ใช้', pic_user: '' };
    const all = read<Member>('member').filter(m => m.group_id === id && !m.left_date);
    const detail = (m: Member): MemberWithDetail => {
      const pays = userPayments(payments, id, m.user_id);
      const bill = memberBillStatus(g, m, pays, today);
      return { ...m, user: userOf(m.user_id), bill, currentPayment: bill.payment, payments: pays };
    };
    return {
      ...g,
      members: all.filter(m => m.status !== 'Pending').map(detail),
      requests: all.filter(m => m.status === 'Pending').map(detail),
      seatsUsed: all.length,
    };
  },

  /* =====================================================================
     [MEMBER] เข้าร่วมกลุ่ม
     ===================================================================== */

  findGroupById(id: string): Group | null {
    return read<Group>('group').find(x => x.group_id === id && isOpen(x)) ?? null;
  },

  /* GET /api/invites/:code — หา group จากรหัสเชิญ (ไม่สนขีด/#/ช่องว่าง/ตัวพิมพ์) */
  findGroupByCode(code: string): Group | null {
    const norm = code.replace(/[#\s-]/g, '').toUpperCase();
    if (!norm) return null;
    return read<Group>('group').find(x => isOpen(x) && x.invite_code.replace(/-/g, '').toUpperCase() === norm) ?? null;
  },

  /* เช็คสถานะก่อนเข้าร่วม — Pending จองที่นั่งแล้ว จึงนับรวม [B9] */
  memberJoinStatus(groupId: string): 'ok' | 'full' | 'already' | 'notfound' {
    reconcile();
    const g = DB.findGroupById(groupId);
    if (!g) return 'notfound';
    const members = read<Member>('member');
    if (members.some(m => m.group_id === groupId && m.user_id === ME.user_id && !m.left_date)) return 'already';
    if (seatsUsedOf(members, groupId) >= g.max_slots) return 'full';
    return 'ok';
  },

  /* ยอดแรกเข้า (pro-rata + เงินประกัน) */
  memberQuote(groupId: string): MemberQuote | null {
    const g = DB.findGroupById(groupId);
    return g ? memberQuote(g, todayTH()) : null;
  },

  /* POST /api/invites/:code/join — ส่งคำขอ + สลิปแรกเข้า → Pending (จองที่นั่งทันที) */
  joinGroupWithSlip(groupId: string, slipUrl: string): 'ok' | 'full' | 'already' | 'notfound' | 'noslip' {
    const pre = DB.memberJoinStatus(groupId);
    if (pre !== 'ok') return pre;
    if (!slipUrl) return 'noslip';
    const g = DB.findGroupById(groupId)!;
    const today = todayTH();
    const members = read<Member>('member');
    members.push({ member_id: uuid(), group_id: groupId, user_id: ME.user_id,
      joined_date: today, role: 'Member', status: 'Pending', left_date: null });
    write<Member>('member', members);
    const q = memberQuote(g, today);
    const payments = read<Payment>('payment');
    payments.push({ payment_id: uuid(), group_id: groupId, user_id: ME.user_id,
      amount: q.totalDue.toFixed(2), slip_url: slipUrl, status: 'Waiting', paid_at: nowStamp(),
      _kind: 'join', _cycle: currentCycleStart(g, today) ?? today });
    write<Payment>('payment', payments);
    return 'ok';
  },

  /* =====================================================================
     [MEMBER] สถานะ/การชำระของฉัน
     ===================================================================== */

  /* สถานะบิลของ ME ในกลุ่มนี้ (null = ไม่ได้เป็นสมาชิกแล้ว) */
  myBill(groupId: string): BillStatus | null {
    reconcile();
    const g = DB.findGroupById(groupId);
    const m = read<Member>('member').find(x => x.group_id === groupId && x.user_id === ME.user_id && !x.left_date);
    if (!g || !m) return null;
    return memberBillStatus(g, m, userPayments(read<Payment>('payment'), groupId, ME.user_id), todayTH());
  },

  /* ME เคยอยู่กลุ่มนี้แต่หลุดไปแล้ว → เหตุผล/วันที่ (ไว้แสดงข้อความในหน้ากลุ่ม) */
  myMembershipEnd(groupId: string): { reason: LeftReason; date: ISODate; depositForfeited: boolean } | null {
    const rows = read<Member>('member').filter(x => x.group_id === groupId && x.user_id === ME.user_id);
    if (rows.some(r => !r.left_date)) return null;
    const last = rows.filter(r => r.left_date).sort((a, b) => ((a.left_date ?? '') < (b.left_date ?? '') ? 1 : -1))[0];
    return last?.left_date
      ? { reason: last._removed_reason ?? 'left', date: last.left_date, depositForfeited: !!last._deposit_forfeited }
      : null;
  },

  /* วันที่ Host กดแจ้งเตือน ME ล่าสุด [B5] */
  myReminder(groupId: string): string | null {
    const m = read<Member>('member').find(x => x.group_id === groupId && x.user_id === ME.user_id && !x.left_date);
    return m?._reminded_at ?? null;
  },

  /* สลิปล่าสุดของ ME ในกลุ่มนี้ (data URL ถ้ามี) */
  myLatestSlip(groupId: string): string | null {
    const p = userPayments(read<Payment>('payment'), groupId, ME.user_id)[0];
    return p && p.slip_url.startsWith('data:') ? p.slip_url : null;
  },

  /* POST /api/invoices/:cycle/slips — ส่งสลิป (แรกเข้า / รอบเดือน / ส่งใหม่หลังถูกปฏิเสธ)
     ผูกสลิปกับ "รอบเป้าหมาย" ที่คำนวณจาก memberBillStatus เสมอ [B2/B3] */
  submitMemberSlip(groupId: string, slipUrl: string): 'ok' | 'not_allowed' | 'noslip' {
    if (!slipUrl) return 'noslip';
    const bill = DB.myBill(groupId);
    if (!bill || !bill.canUpload) return 'not_allowed';
    const payments = read<Payment>('payment');
    payments.push({
      payment_id: uuid(), group_id: groupId, user_id: ME.user_id,
      amount: bill.amount.toFixed(2), slip_url: slipUrl, status: 'Waiting', paid_at: nowStamp(),
      _kind: bill.phase === 'pending' ? 'join' : 'cycle',
      _cycle: bill.phase === 'pending' ? (bill.payment?._cycle ?? todayTH()) : (bill.target ?? undefined),
    });
    write<Payment>('payment', payments);
    return 'ok';
  },

  /* [MEMBER] ยกเลิกสลิปที่ยังรอตรวจ (เพื่อเปลี่ยนรูป) — ลบเฉพาะใบ Waiting ล่าสุดของ ME */
  cancelSlip(groupId: string): boolean {
    const payments = read<Payment>('payment');
    const latest = userPayments(payments, groupId, ME.user_id)[0];
    if (!latest || latest.status !== 'Waiting') return false;
    write<Payment>('payment', payments.filter(p => p.payment_id !== latest.payment_id));
    return true;
  },

  /* [MEMBER] ยกเลิกคำขอเข้ากลุ่ม (ยังไม่อนุมัติ) → ปล่อยที่นั่งที่จองไว้ */
  cancelJoin(groupId: string): boolean {
    const members = read<Member>('member');
    const mine = members.find(m => m.group_id === groupId && m.user_id === ME.user_id && !m.left_date);
    if (!mine || mine.status !== 'Pending') return false;   // อนุมัติแล้วต้องใช้ requestLeave
    release(mine, todayTH(), 'cancelled');
    write<Member>('member', members);
    return true;
  },

  /* GET /api/my-groups?role=member — การ์ดกลุ่มที่ฉันเข้าร่วม */
  async getMemberGroups(): Promise<MemberGroupRow[]> {
    reconcile();
    const today = todayTH();
    const members = read<Member>('member');
    const payments = read<Payment>('payment');
    const rows: MemberGroupRow[] = [];
    for (const g of read<Group>('group').filter(isOpen)) {
      const mine = members.find(m => m.group_id === g.group_id && m.user_id === ME.user_id && m.role === 'Member' && !m.left_date);
      if (!mine) continue;
      const bill = memberBillStatus(g, mine, userPayments(payments, g.group_id, ME.user_id), today);
      const info = priceInfo(g, today);
      const state: MemberCardState =
        bill.phase === 'pending' ? (bill.slip === 'Rejected' ? 'rejected' : 'pending')
          : bill.phase === 'overdue' ? 'overdue'
            : bill.phase === 'due' ? 'due'
              : mine.leaving ? 'leaving' : 'joined';
      const dt = bill.daysUntilDue === null ? null
        : bill.phase === 'overdue' ? { text: `ค้างชำระ ${bill.daysLate} วัน`, urgent: true }
          : dueText(bill.daysUntilDue);
      rows.push({
        group_id: g.group_id, service_name: g.service_name, category: g.category,
        fullPrice: info.now, slots: info.slotsNow, share: round2(info.now / info.slotsNow),
        memberCount: seatsUsedOf(members, g.group_id), max_slots: g.max_slots,
        status: mine.status, state, bill,
        dueText: dt?.text ?? (mine.leaving && bill.leaveEffective ? 'ไม่มีรอบที่ต้องชำระแล้ว' : '-'),
        dueUrgent: dt?.urgent ?? false,
      });
    }
    return rows;
  },

  /* =====================================================================
     [HOST] ตรวจสลิป — อ้างอิงด้วย payment_id เสมอ [B10]
     ===================================================================== */

  /* POST /api/slips/:id/verify */
  async approvePayment(paymentId: string): Promise<'ok' | 'notfound' | 'not_waiting' | 'full'> {
    const payments = read<Payment>('payment');
    const p = payments.find(x => x.payment_id === paymentId);
    if (!p) return 'notfound';
    if (p.status !== 'Waiting') return 'not_waiting';      // ป้องกันอนุมัติใบที่ถูกยกเลิก/ปฏิเสธไปแล้ว
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === p.group_id && x.user_id === p.user_id && !x.left_date);
    if (!m) return 'notfound';
    if (m.status === 'Pending') {
      // คนที่ Pending จองที่นั่งไว้แล้ว — เช็คซ้ำเผื่อข้อมูลเก่าที่จองเกิน
      const g = read<Group>('group').find(x => x.group_id === p.group_id);
      const active = members.filter(x => x.group_id === p.group_id && !x.left_date && x.status === 'Active').length;
      if (g && active >= g.max_slots) return 'full';
      m.status = 'Active';
      // joined_date คงเป็นวันที่ขอเข้า: ยอดแรกเข้าคิดถึงวันก่อนรอบถัดไปของวันนั้น
      // ถ้าโฮสต์อนุมัติช้าจนข้ามรอบ สมาชิกต้องจ่ายรอบใหม่ตามปกติ
    }
    if (m._owe_full && p._kind === 'cycle') delete m._owe_full;   // จ่ายเต็ม + เติมเงินประกันแล้ว
    p.status = 'Verified';
    p._reviewed_at = nowStamp();
    write<Payment>('payment', payments);
    write<Member>('member', members);
    return 'ok';
  },

  /* POST /api/slips/:id/reject */
  async rejectPayment(paymentId: string, reason: string): Promise<'ok' | 'notfound' | 'not_waiting'> {
    const payments = read<Payment>('payment');
    const p = payments.find(x => x.payment_id === paymentId);
    if (!p) return 'notfound';
    if (p.status !== 'Waiting') return 'not_waiting';
    p.status = 'Rejected';
    p._reject_reason = reason;
    p._reviewed_at = nowStamp();
    write<Payment>('payment', payments);
    return 'ok';
  },

  /* POST /api/groups/:id/members/:uid/remind — Host แจ้งเตือนให้รีบจ่าย [B5]
     (ของจริง: backend ส่ง LINE push message) */
  async remindMember(groupId: string, userId: string): Promise<boolean> {
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date);
    if (!m) return false;
    m._reminded_at = nowStamp();
    write<Member>('member', members);
    return true;
  },

  /* DELETE /api/groups/:id/members/:uid — Host นำสมาชิก/คำขอออก → slot ว่างทันที [B9.3] */
  async removeMember(groupId: string, userId: string): Promise<boolean> {
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date && x.role !== 'Host');
    if (!m) return false;
    release(m, todayTH(), 'host');
    write<Member>('member', members);
    return true;
  },

  /* =====================================================================
     [MEMBER] แจ้งออก / ยกเลิกการแจ้งออก                             [B9.2]
     ===================================================================== */

  async requestLeave(groupId: string, userId: string): Promise<{ waived: ISODate; effective: ISODate } | null> {
    const g = DB.findGroupById(groupId);
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date);
    if (!g || !m || m.role === 'Host' || m.status !== 'Active') return null;
    const today = todayTH();
    const plan = planLeave(g, m, userPayments(read<Payment>('payment'), groupId, userId), today);
    m.leaving = true;
    m._leave_at = today;
    m._leave_effective = plan.effective;
    m._waived_cycles = [...(m._waived_cycles ?? []).filter(c => c !== plan.waived), plan.waived];
    write<Member>('member', members);
    return plan;
  },

  async cancelLeave(groupId: string, userId: string): Promise<{ oweFull: boolean }> {
    const members = read<Member>('member');
    const m = members.find(x => x.group_id === groupId && x.user_id === userId && !x.left_date);
    if (!m || !m.leaving) return { oweFull: false };
    const today = todayTH();
    const waived = (m._waived_cycles ?? []).slice(-1)[0];
    // เงินประกันถูกใช้ไปแล้วหรือยัง = รอบที่ใช้เงินประกันเริ่มแล้ว
    const consumed = !!waived && waived <= today;
    m.leaving = false;
    delete m._leave_effective; delete m._leave_at;
    if (consumed) {
      m._owe_full = true;                 // รอบถัดไปจ่ายค่าบริการ + เติมเงินประกันคืน
    } else if (waived) {
      m._waived_cycles = (m._waived_cycles ?? []).filter(c => c !== waived);   // คืนสิทธิ์เงินประกันเดิม
    }
    write<Member>('member', members);
    return { oweFull: consumed };
  },

  myOweFull(groupId: string): boolean {
    const m = read<Member>('member').find(x => x.group_id === groupId && x.user_id === ME.user_id && !x.left_date);
    return !!m?._owe_full;
  },

  /* =====================================================================
     ข้อมูลรอบบิลระดับกลุ่ม (แถบเตือนของ Host)
     ===================================================================== */
  billingInfo(groupId: string): BillingInfo | null {
    const g = DB.findGroupById(groupId);
    if (!g) return null;
    const due = upcomingDue(g, todayTH());
    return {
      billing_date: g.billing_date,
      next_due: due.date,
      days_until: due.days,
      reminder: due.days === 0 ? 'due_today' : due.days === 3 ? 'due_in_3days' : null,
    };
  },

  /* วันครบกำหนดถัดไปของกลุ่ม/รายการเดี่ยว (ใช้กับการ์ดในหน้า list) */
  upcomingDue(src: CycleSource): { date: ISODate; days: number } {
    return upcomingDue(src, todayTH());
  },

  /* DELETE /api/groups/:id — ปิดกลุ่ม (soft) — สมาชิกทุกคนหลุด แต่ประวัติค่าใช้จ่ายยังอยู่ใน Dashboard */
  async deleteGroup(id: string): Promise<boolean> {
    const today = todayTH();
    const groups = read<Group>('group');
    const g = groups.find(x => x.group_id === id && x.user_id === ME.user_id);
    if (!g) return false;
    g._closed_at = today;
    write<Group>('group', groups);
    const members = read<Member>('member');
    for (const m of members) if (m.group_id === id && !m.left_date) release(m, today, 'closed');
    write<Member>('member', members);
    return true;
  },

  /* =====================================================================
     Subscription ส่วนตัว
     ===================================================================== */
  async getMySubscriptions(): Promise<Subscription[]> {
    return read<Subscription>('subscription').filter(s => s.user_id === ME.user_id);
  },
  async getSubscription(subId: string): Promise<Subscription | null> {
    return read<Subscription>('subscription').find(s => s.sub_id === subId && s.user_id === ME.user_id) ?? null;
  },
  /* billing_date ที่ส่งมา: รายเดือน = ไม่ต้องส่ง (ใช้ _billing_day), รายปี = วันที่ที่เลือก */
  async addSubscription(s: Omit<Subscription, 'sub_id' | 'user_id' | 'end_date' | 'billing_date'> & { billing_date?: string }): Promise<Subscription> {
    const today = todayTH();
    const subs = read<Subscription>('subscription');
    const sub: Subscription = {
      ...s, sub_id: uuid(), user_id: ME.user_id, end_date: null,
      billing_date: subAnchor(today, s._billing_cycle, s._billing_day, s.billing_date),
    };
    subs.push(sub); write<Subscription>('subscription', subs);
    return sub;
  },
  async endSubscription(subId: string): Promise<boolean> {
    const subs = read<Subscription>('subscription');
    const s = subs.find(x => x.sub_id === subId && !x.end_date);
    if (s) { s.end_date = todayTH(); write<Subscription>('subscription', subs); }
    return true;
  },
  /* PATCH /api/subscriptions/:id */
  async updateSubscription(
    subId: string,
    patch: Partial<Pick<Subscription, 'service_name' | 'price' | 'category' | '_billing_cycle' | '_billing_day' | 'billing_date'>>,
  ): Promise<Subscription | null> {
    const subs = read<Subscription>('subscription');
    const s = subs.find(x => x.sub_id === subId && x.user_id === ME.user_id);
    if (!s) return null;
    const dayChanged = (patch._billing_day !== undefined && patch._billing_day !== billingDayOf(s))
      || (patch._billing_cycle !== undefined && patch._billing_cycle !== (s._billing_cycle ?? 'monthly'))
      || (patch.billing_date !== undefined && patch.billing_date !== s.billing_date);
    const { billing_date: chosen, ...rest } = patch;
    Object.assign(s, rest);
    if (dayChanged) s.billing_date = subAnchor(todayTH(), s._billing_cycle, s._billing_day, chosen);
    write<Subscription>('subscription', subs);
    return s;
  },
  /* DELETE /api/subscriptions/:id */
  async deleteSubscription(subId: string): Promise<boolean> {
    write<Subscription>('subscription',
      read<Subscription>('subscription').filter(x => !(x.sub_id === subId && x.user_id === ME.user_id)));
    return true;
  },

  /* =====================================================================
     Dashboard — ค่าใช้จ่ายต่อหัวตามราคาที่มีผลในแต่ละเดือน (เวลาไทย)
     ===================================================================== */
  async getDashboard(year?: number): Promise<DashboardData> {
    const today = todayTH();
    const y = year ?? parts(today).y;
    const groups  = read<Group>('group');
    const members = read<Member>('member').filter(m => m.user_id === ME.user_id && m.status === 'Active');
    const subs    = read<Subscription>('subscription').filter(s => s.user_id === ME.user_id);

    const month: Record<Category, number> = { Entertainment: 0, Music: 0, Productivity: 0, Other: 0 };
    const yearly: Record<Category, number> = { Entertainment: 0, Music: 0, Productivity: 0, Other: 0 };
    const nowIdx = monthIndex(today);
    const prevIdx = nowIdx - 1;
    let prevTotal = 0;

    const active = (start: string, end: string | null | undefined, idx: number) =>
      monthIndex(start) <= idx && idx <= (end ? monthIndex(end) : nowIdx);

    for (const m of members) {
      const g = groups.find(x => x.group_id === m.group_id);
      if (!g) continue;
      if (active(m.joined_date, m.left_date, nowIdx)) month[g.category] += perHeadInMonth(g, nowIdx);
      if (active(m.joined_date, m.left_date, prevIdx)) prevTotal += perHeadInMonth(g, prevIdx);
      for (let mm = 0; mm < 12; mm++) {
        const idx = y * 12 + mm;
        if (active(m.joined_date, m.left_date, idx)) yearly[g.category] += perHeadInMonth(g, idx);
      }
    }
    for (const s of subs) {
      const price = Number(s.price);
      if (active(s.billing_date, s.end_date, nowIdx)) month[s.category] += price;
      if (active(s.billing_date, s.end_date, prevIdx)) prevTotal += price;
      for (let mm = 0; mm < 12; mm++) if (active(s.billing_date, s.end_date, y * 12 + mm)) yearly[s.category] += price;
    }

    const monthTotal = CATEGORY_ORDER.reduce((sum, c) => sum + month[c], 0);
    const yearTotal  = CATEGORY_ORDER.reduce((sum, c) => sum + yearly[c], 0);
    const byCategory = CATEGORY_ORDER.map(c => ({
      category: c, label: CATEGORY_LABEL[c], amount: month[c],
      percent: monthTotal > 0 ? Math.round((month[c] / monthTotal) * 100) : 0,
    }));
    return { monthTotal, yearTotal, prevMonthTotal: prevTotal, byCategory };
  },

  /* GET /api/dashboard/history — ยอดรวมย้อนหลัง 6 เดือน */
  async getSpendingHistory(): Promise<{ month: string; total: number }[]> {
    const today = todayTH();
    const groups  = read<Group>('group');
    const members = read<Member>('member').filter(m => m.user_id === ME.user_id && m.status === 'Active');
    const subs    = read<Subscription>('subscription').filter(s => s.user_id === ME.user_id);
    const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const nowIdx = monthIndex(today);
    const active = (start: string, end: string | null | undefined, idx: number) =>
      monthIndex(start) <= idx && idx <= (end ? monthIndex(end) : nowIdx);

    const out: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const idx = nowIdx - i;
      let total = 0;
      for (const m of members) {
        const g = groups.find(x => x.group_id === m.group_id);
        if (g && active(m.joined_date, m.left_date, idx)) total += perHeadInMonth(g, idx);
      }
      for (const s of subs) if (active(s.billing_date, s.end_date, idx)) total += Number(s.price);
      out.push({ month: TH_MON[((idx % 12) + 12) % 12], total: Math.round(total) });
    }
    return out;
  },
};

/* ราคาต่อหัวของกลุ่มในเดือน idx = ราคาของรอบบิลที่เริ่มในเดือนนั้น [B12] */
function perHeadInMonth(g: Group, idx: number): number {
  const y = Math.floor(idx / 12), m = (idx % 12) + 1;
  const p = pricingAt(g, makeDate(y, m, billingDayOf(g)));
  return p.price / p.slots;
}

/* [B7] anchor ของรายการเดี่ยว: รายเดือน = วันที่เลือกครั้งแรกที่ ≥ วันนี้, รายปี = วันที่เลือกเลื่อนทีละปี */
function subAnchor(today: ISODate, cycle: string | undefined, day: number | undefined, chosen?: string): ISODate {
  if (cycleMonths(cycle) === 12 && chosen) return firstYearlyDate(today, chosen);
  return firstBillingDate(today, day ?? parts(chosen ?? today).d);
}

/* สถานะสำหรับหน้า Host (map จาก BillStatus ตัวเดียวกับฝั่ง Member) [B5] */
export function deriveStatus(m: MemberWithDetail): UiStatus {
  const b = m.bill;
  if (b.slip === 'Waiting' && b.phase !== 'settled') return 'review';
  if (b.phase === 'overdue') return 'overdue';
  if (b.phase === 'due') return b.slip === 'Rejected' ? 'rejected' : 'unpaid';
  if (b.phase === 'window') return b.slip === 'Rejected' ? 'rejected' : 'upcoming';
  if (b.phase === 'leaving' || m.leaving) return 'leaving';
  return 'paid';
}

/* ใช้ใน DevPanel/หน้าอื่น: เส้นตายเตะออก */
export { KICK_AFTER_DAYS };
/* เผื่อ type อื่น ๆ ที่หน้าเดิมเคย import */
export type { CycleSource };
export { cycleIndexAt, diffDays };
