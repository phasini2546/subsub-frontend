/* =====================================================================
   SubSub · กฎรอบบิล / ค้างชำระ / ราคา · lib/billing.ts
   ---------------------------------------------------------------------
   Pure functions ล้วน (ไม่อ่าน localStorage, ไม่อ่านนาฬิกาเอง — รับ today เข้ามา)
   → เขียน unit test ได้ และย้ายไปใช้ซ้ำที่ backend ได้ทันที

   นิยาม "รอบบิล" (cycle) — ตัวอย่างตัดรอบวันที่ 20:
     รอบเริ่ม 20 ม.ค. ครอบคลุม 20 ม.ค. – 19 ก.พ.  (รอบถัดไปเริ่ม 20 ก.พ.)
     วันเริ่มรอบ = วันครบกำหนดชำระของรอบนั้น (D0)

   Timeline การชำระ 1 รอบ:                                         [B2/B3]
     D-3 … D-1  ช่วงจ่ายล่วงหน้า (phase 'window')   — อัปโหลดได้
     D0  … D+4  ถึงกำหนด ยังไม่จ่าย (phase 'due')    — อัปโหลดได้
     D+5 … D+9  ค้างชำระ (phase 'overdue')          — อัปโหลดได้ + นับถอยหลัง 5…1
     D+10       ถูกนำออกอัตโนมัติ (slot ว่าง, ยึดเงินประกัน)
   ===================================================================== */
import type { Group, Member, Payment, BillStatus, ISODate } from '../types';
import { addDays, addMonthsKeepDay, diffDays, makeDate, monthIndex, parts, toISODateTH } from './date.ts';

export const UPLOAD_OPEN_BEFORE_DAYS = 3;   // [B3] เปิดให้ส่งสลิปล่วงหน้า 3 วัน
export const OVERDUE_AFTER_DAYS = 5;        // [B2] เลยกำหนด 5 วัน → "ค้างชำระ"
export const KICK_AFTER_DAYS = 10;          // [B2] เลยกำหนด 10 วัน → นำออกอัตโนมัติ

/* ---------------- รอบบิลของกลุ่ม ---------------- */

export function cycleMonths(cycle?: string): number {
  const c = (cycle || 'monthly').toLowerCase();
  if (c.includes('year') || c.includes('annual')) return 12;
  if (c.includes('quarter')) return 3;
  if (c.includes('half') || c === '6') return 6;
  const n = parseInt(c, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** ข้อมูลขั้นต่ำที่ใช้คำนวณรอบ (ใช้ได้ทั้ง Group และ Subscription) */
export interface CycleSource {
  billing_date: string;      // anchor = วันเริ่มรอบแรก
  _billing_day?: number;
  _billing_cycle?: string;
}

export const billingDayOf = (s: CycleSource): number => s._billing_day ?? parts(s.billing_date).d;

/** [B7] วันเริ่มรอบบิลแรก = "วันที่ Host เลือก" ครั้งแรกที่ ≥ "วันที่สร้างกลุ่ม"
    เช่น สร้าง 5 ต.ค. เลือกวันที่ 20 → 20 ต.ค. / สร้าง 25 ต.ค. เลือก 20 → 20 พ.ย.
    เลือกวันที่ 31 ในเดือนที่มี 30 วัน → วันสุดท้ายของเดือน (ไม่ไหลไปวันที่ 1 ของเดือนถัดไป) */
export function firstBillingDate(createdISO: ISODate, billingDay: number): ISODate {
  const c = parts(createdISO);
  const cand = makeDate(c.y, c.m, billingDay);
  return cand >= createdISO ? cand : makeDate(c.y, c.m + 1, billingDay);
}

/** [B7] รอบรายปี: วันที่ที่เลือก (เช่นวันสมัครปีก่อน) → เลื่อนทีละ 12 เดือนจนถึง ≥ วันที่สร้างกลุ่ม */
export function firstYearlyDate(createdISO: ISODate, chosenISO: ISODate): ISODate {
  const day = parts(chosenISO).d;
  let d = chosenISO, guard = 0;
  while (d < createdISO && guard++ < 200) d = addMonthsKeepDay(d, 12, day);
  return d;
}

/** วันเริ่มรอบที่ n (n = 0 คือรอบแรก) — คำนวณจาก anchor ทุกครั้ง จึงไม่มีการไหลของวันที่ */
export function cycleStart(s: CycleSource, n: number): ISODate {
  return addMonthsKeepDay(s.billing_date, n * cycleMonths(s._billing_cycle), billingDayOf(s));
}

/** ดัชนีรอบที่ครอบคลุมวันที่ date (-1 = ก่อนรอบแรก) */
export function cycleIndexAt(s: CycleSource, date: ISODate): number {
  if (date < s.billing_date) return -1;
  const cm = cycleMonths(s._billing_cycle);
  let n = Math.max(0, Math.floor((monthIndex(date) - monthIndex(s.billing_date)) / cm));
  while (cycleStart(s, n + 1) <= date) n++;
  while (n > 0 && cycleStart(s, n) > date) n--;
  return n;
}

/** วันเริ่มรอบปัจจุบัน (null = ยังไม่ถึงรอบแรก) */
export function currentCycleStart(s: CycleSource, date: ISODate): ISODate | null {
  const i = cycleIndexAt(s, date);
  return i < 0 ? null : cycleStart(s, i);
}

/** วันเริ่มรอบถัดไป (> date เสมอ) */
export function nextCycleStart(s: CycleSource, date: ISODate): ISODate {
  return cycleStart(s, cycleIndexAt(s, date) + 1);
}

/** วันครบกำหนดที่ใกล้ที่สุด: วันนี้ถ้าวันนี้เป็นวันตัดรอบ ไม่งั้นรอบถัดไป */
export function upcomingDue(s: CycleSource, date: ISODate): { date: ISODate; days: number } {
  const cur = currentCycleStart(s, date);
  if (cur === date) return { date, days: 0 };
  const nx = nextCycleStart(s, date);
  return { date: nx, days: diffDays(date, nx) };
}

/** ข้อความ "ครบกำหนด" มาตรฐานเดียว (urgent = เหลือ ≤ 3 วัน / วันนี้ / เลยกำหนด) */
export function dueText(days: number): { text: string; urgent: boolean; days: number } {
  if (days < 0) return { days, urgent: true, text: `เลยกำหนดชำระ ${Math.abs(days)} วัน` };
  if (days === 0) return { days, urgent: true, text: 'ครบกำหนดชำระวันนี้' };
  if (days < 30) return { days, urgent: days <= UPLOAD_OPEN_BEFORE_DAYS, text: `ครบกำหนด อีก ${days} วัน` };
  const mo = Math.floor(days / 30); const rem = days % 30;
  return { days, urgent: false, text: rem > 0 ? `ครบกำหนด อีก ${mo} เดือน ${rem} วัน` : `ครบกำหนด อีก ${mo} เดือน` };
}

/* ---------------- ราคา (B12: มีผลตาม "รอบบิล" ไม่ใช่เดือนปฏิทิน) ---------------- */

/** from แบบเก่า 'YYYY-MM' → 'YYYY-MM-01' */
export const normalizeFrom = (from: string): ISODate => (from.length === 7 ? from + '-01' : from);

/** ราคา/ช่องที่มีผล ณ วันที่ date (ปกติส่ง "วันเริ่มรอบ" ที่กำลังจะจ่าย) */
export function pricingAt(g: Group, date: ISODate): { price: number; slots: number } {
  const hist = (g._pricing_history ?? [])
    .map(h => ({ ...h, from: normalizeFrom(h.from) }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  if (hist.length) {
    let chosen = hist[0];
    for (const h of hist) if (h.from <= date) chosen = h;
    return { price: Number(chosen.price), slots: Math.max(1, chosen.max_slots) };
  }
  return { price: Number(g.total_price), slots: Math.max(1, g.max_slots) };
}

export const shareAt = (g: Group, date: ISODate): number => {
  const p = pricingAt(g, date);
  return round2(p.price / p.slots);
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** ราคาตอนนี้ + ราคาที่ตั้งไว้ให้มีผลรอบถัดไป (ถ้ามี) — ใช้แสดงผล */
export function priceInfo(g: Group, today: ISODate): {
  now: number; slotsNow: number; upcoming: { from: ISODate; price: number; slots: number } | null;
} {
  const cur = pricingAt(g, today);
  const future = (g._pricing_history ?? [])
    .map(h => ({ ...h, from: normalizeFrom(h.from) }))
    .filter(h => h.from > today)
    .sort((a, b) => (a.from < b.from ? -1 : 1))[0];
  return {
    now: cur.price, slotsNow: cur.slots,
    upcoming: future ? { from: future.from, price: Number(future.price), slots: future.max_slots } : null,
  };
}

/* ---------------- ยอดแรกเข้า (pro-rata) ---------------- */

export interface MemberQuote {
  share: number;         // ราคาหารต่อหัวเต็มรอบ
  deposit: number;       // เงินประกัน (รายเดือน = share, รายปี = 0)
  firstAmount: number;   // ค่าบริการรอบแรก (คิดตามสัดส่วนวันถ้าเข้ากลางรอบ)
  totalDue: number;      // ยอดรวมที่ต้องชำระแรกเข้า
  fullPrice: number;     // ราคาเต็มทั้งกลุ่ม
  slots: number;
  prorated: boolean;     // true = เข้ากลางรอบ
  usedDays: number;      // จำนวนวันที่คิดเงินรอบแรก (วันนี้ → วันก่อนรอบถัดไป)
  daysInCycle: number;   // ความยาวรอบ (วัน)
  nextDue: ISODate;      // วันเริ่มรอบถัดไป (ต้องจ่ายค่าบริการรอบเต็มครั้งแรก)
}

/** เข้าตรงวันตัดรอบ = จ่ายเต็มส่วนแบ่ง, เข้ากลางรอบ = share/วันในรอบ × วันที่เหลือ — บวกเงินประกัน 1 ส่วนเสมอ */
export function memberQuote(g: Group, today: ISODate): MemberQuote {
  const p = pricingAt(g, today);
  const share = round2(p.price / p.slots);
  const deposit = cycleMonths(g._billing_cycle) === 12 ? 0 : share;   // [ปรับ] รายปีไม่เก็บเงินประกัน
  const nextDue = nextCycleStart(g, today);
  const prevStart = addMonthsKeepDay(nextDue, -cycleMonths(g._billing_cycle), billingDayOf(g));
  const len = Math.max(1, diffDays(prevStart, nextDue));
  const used = Math.min(len, diffDays(today, nextDue));
  const prorated = used < len;
  const firstAmount = prorated ? round2((share / len) * used) : share;
  return {
    share, deposit, firstAmount, totalDue: round2(firstAmount + deposit),
    fullPrice: p.price, slots: p.slots, prorated, usedDays: used, daysInCycle: len, nextDue,
  };
}

/* ---------------- สถานะการชำระของสมาชิก (หัวใจของ B2/B3/B4/B5) ---------------- */

/** รอบนี้สมาชิกต้องจ่ายไหม
    - รอบที่ "เริ่มก่อน/ตรงวันเข้ากลุ่ม" ถูกจ่ายไปแล้วในยอดแรกเข้า
    - รอบที่ใช้เงินประกันแทน (_waived_cycles) ไม่ต้องจ่าย
    - รอบตั้งแต่วันที่ออกจริงเป็นต้นไป ไม่ต้องจ่าย */
export function cycleRequired(m: Member, start: ISODate): boolean {
  if (start <= m.joined_date) return false;
  if (m._waived_cycles?.includes(start)) return false;
  if (m._leave_effective && start >= m._leave_effective) return false;
  return true;
}

/** สลิปของรอบ start (ถ้ามีใบที่ยืนยันแล้วเอาใบนั้น ไม่งั้นใบล่าสุด) */
export function paymentForCycle(payments: Payment[], start: ISODate): Payment | null {
  const list = payments.filter(p => p._kind !== 'join' && p._cycle === start)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
  return list.find(p => p.status === 'Verified') ?? list[0] ?? null;
}

/** สลิปแรกเข้าล่าสุด */
export function joinPayment(payments: Payment[]): Payment | null {
  return payments.filter(p => p._kind === 'join')
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))[0] ?? null;
}

/** ยอดที่ต้องจ่ายของรอบ start */
export function cycleAmount(g: Group, start: ISODate): number {
  return shareAt(g, start);
}

const EMPTY = (over: Partial<BillStatus>): BillStatus => ({
  phase: 'settled', slip: null, payment: null, target: null, dueDate: null, daysUntilDue: null,
  daysLate: 0, kickInDays: null, kickDate: null, canUpload: false, amount: 0, leaveEffective: null,
  ...over,
});

/** สถานะการชำระของสมาชิก 1 คน ณ วันที่ today
    ใช้ฟังก์ชันเดียวกันทั้งหน้า Host / หน้า Member / roster / ระบบเตะอัตโนมัติ → สถานะตรงกันเสมอ [B5] */
export function memberBillStatus(g: Group, m: Member, payments: Payment[], today: ISODate): BillStatus {
  const leaveEffective = m.leaving ? (m._leave_effective ?? null) : null;

  if (m.role === 'Host') return EMPTY({ phase: 'host' });

  /* แรกเข้า: รอโฮสต์อนุมัติ (จองที่นั่งแล้ว) */
  if (m.status === 'Pending') {
    const p = joinPayment(payments);
    return EMPTY({
      phase: 'pending', slip: p?.status ?? null, payment: p,
      canUpload: !p || p.status === 'Rejected',
      amount: p ? Number(p.amount) : memberQuote(g, today).totalDue,
    });
  }

  /* 1) หารอบที่ "ถึงกำหนดแล้วแต่ยังไม่ได้รับการยืนยัน" รอบแรกสุด (ค้างชำระ) */
  const firstIdx = Math.max(0, cycleIndexAt(g, m.joined_date) + 1);
  const curIdx = cycleIndexAt(g, today);
  for (let i = firstIdx; i <= curIdx; i++) {
    const start = cycleStart(g, i);
    if (!cycleRequired(m, start)) continue;
    const p = paymentForCycle(payments, start);
    if (p?.status === 'Verified') continue;

    const late = diffDays(start, today);
    let kickDate = addDays(start, KICK_AFTER_DAYS);
    // สลิปถูกปฏิเสธหลังเลยเส้นตาย → ให้เวลาส่งใหม่อีก 1 วัน (ไม่โดนเตะทันทีที่โฮสต์กดปฏิเสธ)
    if (p?.status === 'Rejected' && p.reviewed_at) {
      const grace = addDays(toISODateTH(new Date(p.reviewed_at)), 1);
      if (grace > kickDate) kickDate = grace;
    }
    const waiting = p?.status === 'Waiting';
    return EMPTY({
      phase: late >= OVERDUE_AFTER_DAYS ? 'overdue' : 'due',
      slip: p?.status ?? null, payment: p, target: start, dueDate: start,
      daysUntilDue: -late, daysLate: late,
      kickInDays: waiting ? null : Math.max(0, diffDays(today, kickDate)),
      kickDate: waiting ? null : kickDate,
      canUpload: !waiting,
      amount: cycleAmount(g, start),
      leaveEffective,
    });
  }

  /* 2) ไม่มีค้าง → ดูรอบถัดไป: อยู่ในช่วงจ่ายล่วงหน้า 3 วันไหม */
  const next = nextCycleStart(g, today);
  const until = diffDays(today, next);
  if (cycleRequired(m, next) && until <= UPLOAD_OPEN_BEFORE_DAYS) {
    const p = paymentForCycle(payments, next);
    if (p?.status !== 'Verified') {
      return EMPTY({
        phase: 'window', slip: p?.status ?? null, payment: p, target: next, dueDate: next,
        daysUntilDue: until, canUpload: p?.status !== 'Waiting',
        amount: cycleAmount(g, next), leaveEffective,
      });
    }
  }

  /* 3) จ่ายครบแล้ว → แสดงสลิปที่ยืนยันล่าสุด + วันครบกำหนดถัดไป */
  const lastVerified = payments.filter(p => p.status === 'Verified')
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))[0] ?? null;
  let due: ISODate | null = next;
  if (leaveEffective) {
    // แจ้งออกแล้ว: ไม่มีรอบที่ต้องจ่ายอีก → วันถัดไปที่สำคัญคือวันออกจริง
    let n = next, guard = 0;
    while (!cycleRequired(m, n) && n < leaveEffective && guard++ < 24) n = nextCycleStart(g, n);
    due = cycleRequired(m, n) ? n : null;
  }
  return EMPTY({
    phase: m.leaving && !due ? 'leaving' : 'settled',
    slip: lastVerified ? 'Verified' : null, payment: lastVerified,
    dueDate: due, daysUntilDue: due ? diffDays(today, due) : null,
    amount: due ? cycleAmount(g, due) : 0, leaveEffective,
  });
}

/** [B9.2] แจ้งออก: ต้องจ่ายรอบปัจจุบันตามปกติ, รอบถัดไปใช้เงินประกันแทน, ออกจริงวันเริ่มรอบถัดจากนั้น
    ตัวอย่าง (ตัดรอบวันที่ 20): แจ้งออกระหว่าง 20 ม.ค.–19 ก.พ.
      → ต้องจ่ายรอบ 20 ม.ค. / รอบ 20 ก.พ. ใช้เงินประกัน / ใช้งานได้ถึง 20 มี.ค. แล้วถูกนำออก */
export function planLeave(g: Group, m: Member, payments: Payment[], today: ISODate): { waived: ISODate | null; effective: ISODate } {
  if (cycleMonths(g._billing_cycle) === 12) {
    // รายปีไม่มีเงินประกัน → ใช้ครบปีที่จ่ายแล้ว ออกต้นรอบถัดไป ไม่มีรอบ waived
    return { waived: null, effective: nextCycleStart(g, today) };
  }
  let waived = nextCycleStart(g, today);
  // จ่ายรอบถัดไปล่วงหน้าไปแล้ว → เงินประกันใช้กับรอบถัดจากนั้นแทน
  if (paymentForCycle(payments, waived)?.status === 'Verified') waived = nextCycleStart(g, waived);
  // ยังไม่ครบรอบแรก (เข้ากลุ่มหลังวันนี้?) — กันกรณีขอบ
  if (waived <= m.joined_date) waived = nextCycleStart(g, m.joined_date);
  return { waived, effective: nextCycleStart(g, waived) };
}
