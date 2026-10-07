/* =====================================================================
   SubSub · ข้อมูลสาธิต + ตัวจำลองฝั่ง Host/Member (DEV ONLY) · dev/devDb.ts   [B11]
   ---------------------------------------------------------------------
   ย้ายมาจาก db.ts เดิมทั้งหมด (ensureDemoDisney, seedDemoGroup, dev*, payMonthly,
   createJoinRequest, startNewCycle) — db.ts ของจริงจึงไม่มีโค้ดทดสอบปนอีก
   ===================================================================== */
import type { Group, Member, Payment, User, Category, ISODate } from '../types';
import { read, write, uuid, K } from '../lib/store';
import { todayTH, nowStamp, DEV_CLOCK_KEY } from '../lib/clock';
import { addDays, addMonthsKeepDay, parts } from '../lib/date';
import { memberBillStatus, memberQuote, currentCycleStart } from '../lib/billing';
import { DB } from '../db';
import { MOCK_HOST_ACCOUNT, DEMO_CODE, DEMO_FULL_CODE } from './mock';

/* ---------------- รูปสลิปตัวอย่าง (SVG data URL) ---------------- */
export function sampleSlip(amount: string, fromName = 'สมาชิก'): string {
  const amt = Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="440" font-family="'Noto Sans Thai',sans-serif">
<rect width="340" height="440" rx="16" fill="#F7FBF4"/>
<rect width="340" height="86" fill="#1E9E4A"/><rect y="60" width="340" height="26" fill="#1E9E4A"/>
<circle cx="170" cy="42" r="21" fill="#fff"/>
<path d="M161 42l7 7 12-14" stroke="#1E9E4A" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="170" y="114" text-anchor="middle" font-size="17" font-weight="700" fill="#1E9E4A">โอนเงินสำเร็จ</text>
<text x="170" y="134" text-anchor="middle" font-size="11" fill="#8A8A8A">สลิปตัวอย่างสำหรับทดสอบ</text>
<line x1="24" y1="156" x2="316" y2="156" stroke="#E0E0E0" stroke-dasharray="4 4"/>
<text x="24" y="186" font-size="11" fill="#9A9A9A">จาก</text>
<text x="24" y="206" font-size="14" font-weight="600" fill="#1C1C1C">${fromName}</text>
<text x="24" y="258" font-size="11" fill="#9A9A9A">ไปยัง</text>
<text x="24" y="278" font-size="14" font-weight="600" fill="#1C1C1C">${MOCK_HOST_ACCOUNT.accountName}</text>
<text x="24" y="296" font-size="11" fill="#9A9A9A">${MOCK_HOST_ACCOUNT.bankName} ${MOCK_HOST_ACCOUNT.accountNo}</text>
<line x1="24" y1="320" x2="316" y2="320" stroke="#E0E0E0" stroke-dasharray="4 4"/>
<text x="24" y="352" font-size="12" fill="#7A7A7A">จำนวนเงิน</text>
<text x="316" y="357" text-anchor="end" font-size="24" font-weight="800" fill="#1E9E4A">${amt} ฿</text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------------- helpers ---------------- */
function addUser(name: string): string {
  const users = read<User>('user');
  const id = uuid();
  users.push({ user_id: id, line_uid: 'U' + id.slice(0, 8), display_name: name, pic_user: '' });
  write<User>('user', users);
  return id;
}

function addGroup(o: { name: string; price: number; slots: number; cycleStart: ISODate; code: string; category: Category; hostId: string }): Group {
  const day = parts(o.cycleStart).d;
  const anchor = addMonthsKeepDay(o.cycleStart, -1, day);          // เริ่มรอบแรกเมื่อ 1 รอบก่อน
  const g: Group = {
    group_id: uuid(), user_id: o.hostId, service_name: o.name,
    total_price: o.price.toFixed(2), max_slots: o.slots, billing_date: anchor,
    invite_code: o.code, category: o.category, bank_name: MOCK_HOST_ACCOUNT.bankName, bank_account: MOCK_HOST_ACCOUNT.accountNo, account_holder: MOCK_HOST_ACCOUNT.accountName,
    _billing_cycle: 'monthly', _billing_day: day, _created_at: anchor, _closed_at: null,
    _pricing_history: [{ from: '1970-01-01', price: o.price.toFixed(2), max_slots: o.slots }],
  };
  const groups = read<Group>('group'); groups.push(g); write<Group>('group', groups);
  addMember(g.group_id, o.hostId, 'Host', 'Active', anchor);
  return g;
}

function addMember(gid: string, uid: string, role: Member['role'], status: Member['status'], joined: ISODate): void {
  const members = read<Member>('member');
  members.push({ member_id: uuid(), group_id: gid, user_id: uid, joined_date: joined, role, status, left_date: null });
  write<Member>('member', members);
}

function addPayment(p: Omit<Payment, 'payment_id' | 'submitted_at' | 'slip_url'> & { name: string }): void {
  const payments = read<Payment>('payment');
  const { name, ...rest } = p;
  payments.push({ ...rest, payment_id: uuid(), submitted_at: nowStamp(), slip_url: sampleSlip(p.amount, name) });
  write<Payment>('payment', payments);
}

const findByCode = (code: string) => read<Group>('group').find(x => x.invite_code.toUpperCase() === code.toUpperCase() && !x._closed_at);

/* ---------------- กลุ่มสาธิต ---------------- */

/** DISNEY-99: รอบปัจจุบันเริ่มเมื่อ 6 วันก่อน — A จ่ายแล้ว / B ค้างชำระ 6 วัน / C ส่งสลิปรอตรวจ / ว่าง 2 ที่ */
export function ensureDemoDisney(): Group {
  const exist = findByCode(DEMO_CODE);
  if (exist) return exist;
  const cs = addDays(todayTH(), -6);
  const hostId = addUser('โฮสต์ Disney');
  const g = addGroup({ name: 'Disney+ (สาธิต)', price: 594, slots: 6, cycleStart: cs, code: DEMO_CODE, category: 'Entertainment', hostId });
  const share = (594 / 6).toFixed(2);
  const a = addUser('Member A'), b = addUser('Member B'), c = addUser('Member C');
  for (const uid of [a, b, c]) addMember(g.group_id, uid, 'Member', 'Active', g.billing_date);
  addPayment({ group_id: g.group_id, user_id: a, amount: share, status: 'Verified', _kind: 'cycle', _cycle: cs, name: 'Member A' });
  addPayment({ group_id: g.group_id, user_id: c, amount: share, status: 'Waiting', _kind: 'cycle', _cycle: cs, name: 'Member C' });
  return g;
}

/** NFLX-2026: กลุ่มเต็ม (ทดสอบ B9 — คนที่รออนุมัติก็นับเป็นที่นั่ง) */
export function ensureDemoFull(): Group {
  const exist = findByCode(DEMO_FULL_CODE);
  if (exist) return exist;
  const hostId = addUser('โฮสต์ Netflix');
  const g = addGroup({ name: 'Netflix (สาธิต · เต็ม)', price: 419, slots: 4, cycleStart: addDays(todayTH(), -10), code: DEMO_FULL_CODE, category: 'Entertainment', hostId });
  const cs = addDays(todayTH(), -10);
  const share = (419 / 4).toFixed(2);
  for (const name of ['สมาชิก 1', 'สมาชิก 2']) {
    const uid = addUser(name);
    addMember(g.group_id, uid, 'Member', 'Active', g.billing_date);
    addPayment({ group_id: g.group_id, user_id: uid, amount: share, status: 'Verified', _kind: 'cycle', _cycle: cs, name });
  }
  addMember(g.group_id, addUser('ผู้ขอเข้า 3 (รออนุมัติ)'), 'Member', 'Pending', todayTH());
  return g;
}

/** SPOTIFY-7: ตัดรอบอีก 6 วัน → ทดสอบคิดเงินตามสัดส่วนวัน (pro-rata) */
export function ensureMidCycleDemo(): Group {
  const exist = findByCode('SPOTIFY-7');
  if (exist) return exist;
  const hostId = addUser('โฮสต์ Spotify');
  return addGroup({ name: 'Spotify (สาธิต)', price: 400, slots: 4, cycleStart: addDays(todayTH(), 6), code: 'SPOTIFY-7', category: 'Music', hostId });
}

/** รหัสสาธิตที่หน้าเข้าร่วมกลุ่มรู้จัก (dev เท่านั้น) */
export function resolveDemoCode(normalized: string): Group | null {
  if (normalized === DEMO_CODE.replace(/-/g, '')) return ensureDemoDisney();
  if (normalized === DEMO_FULL_CODE.replace(/-/g, '')) return ensureDemoFull();
  if (normalized === 'SPOTIFY7') return ensureMidCycleDemo();
  return null;
}

/* ---------------- จำลองฝั่ง Host (ใช้จากหน้า Member) ---------------- */

/** โฮสต์อนุมัติสลิปที่รอตรวจทั้งหมดของ ME */
export async function devApproveMine(groupId?: string): Promise<number> {
  const me = DB.me().user_id;
  const waiting = read<Payment>('payment').filter(p => p.user_id === me && p.status === 'Waiting' && (!groupId || p.group_id === groupId));
  for (const p of waiting) await DB.approvePayment(p.payment_id);
  return waiting.length;
}

/** โฮสต์ปฏิเสธสลิปที่รอตรวจของ ME */
export async function devRejectMine(groupId?: string): Promise<number> {
  const me = DB.me().user_id;
  const waiting = read<Payment>('payment').filter(p => p.user_id === me && p.status === 'Waiting' && (!groupId || p.group_id === groupId));
  for (const p of waiting) await DB.rejectPayment(p.payment_id, 'ยอดเงินไม่ตรง');
  return waiting.length;
}

/** เมมเบอร์ส่งสลิปใหม่หลังถูกปฏิเสธ — สร้างใบ Waiting ใบใหม่ของรอบเดิม (ใบ Rejected เก็บเป็นประวัติ) */
export function devResubmitMine(groupId?: string): string | null {
  const me = DB.me().user_id;
  const payments = read<Payment>('payment');
  const members = read<Member>('member');
  for (const g of read<Group>('group').filter(x => !x._closed_at && (!groupId || x.group_id === groupId))) {
    const mine = members.find(m => m.group_id === g.group_id && m.user_id === me && !m.left_date && m.role === 'Member');
    if (!mine) continue;
    const bill = memberBillStatus(g, mine, payments.filter(x => x.group_id === g.group_id && x.user_id === me), todayTH());
    if (bill.slip !== 'Rejected' || !bill.canUpload) continue;
    const r = DB.submitMemberSlip(g.group_id, sampleSlip(bill.amount.toFixed(2), DB.me().display_name));
    if (r === 'ok') return g.service_name;
  }
  return null;
}

/** เร่งให้คำขอออกของ ME ถึงวันออกจริงทันที */
export function devExpireMyLeave(): number {
  const members = read<Member>('member');
  let n = 0;
  for (const m of members) {
    if (m.user_id === DB.me().user_id && m.leaving && !m.left_date) { m._leave_effective = todayTH(); n++; }
  }
  if (n) write<Member>('member', members);
  return n;
}

/* ---------------- จำลองฝั่ง Member (ใช้จากหน้า Host) ---------------- */

/** มีคนขอเข้ากลุ่ม + แนบสลิปแรกเข้า (จองที่นั่ง) */
export function simJoinRequest(groupId: string): 'ok' | 'full' {
  const g = DB.findGroupById(groupId);
  if (!g) return 'full';
  const used = read<Member>('member').filter(m => m.group_id === groupId && !m.left_date).length;
  if (used >= g.max_slots) return 'full';
  const name = 'ผู้ขอเข้า ' + String.fromCharCode(65 + used);
  const uid = addUser(name);
  addMember(groupId, uid, 'Member', 'Pending', todayTH());
  const q = memberQuote(g, todayTH());
  addPayment({ group_id: groupId, user_id: uid, amount: q.totalDue.toFixed(2), status: 'Waiting',
    _kind: 'join', _cycle: currentCycleStart(g, todayTH()) ?? todayTH(), name });
  return 'ok';
}

/** สมาชิกคนแรกที่ถึงรอบต้องจ่าย ส่งสลิปรอบนั้น */
export function simMemberPay(groupId: string): string | null {
  const g = DB.findGroupById(groupId);
  if (!g) return null;
  const users = read<User>('user');
  const payments = read<Payment>('payment');
  for (const m of read<Member>('member').filter(x => x.group_id === groupId && !x.left_date && x.role === 'Member' && x.status === 'Active')) {
    const bill = memberBillStatus(g, m, payments.filter(p => p.group_id === groupId && p.user_id === m.user_id), todayTH());
    if (!bill.canUpload || !bill.target) continue;
    const name = users.find(u => u.user_id === m.user_id)?.display_name ?? 'สมาชิก';
    addPayment({ group_id: groupId, user_id: m.user_id, amount: bill.amount.toFixed(2), status: 'Waiting', _kind: 'cycle', _cycle: bill.target, name });
    return name;
  }
  return null;
}

/** สมาชิกคนแรกที่สลิปถูกโฮสต์ปฏิเสธ ส่งสลิปใหม่ (ใช้จากหน้าโฮสต์ — ทดสอบรีวิวสลิปใบใหม่) */
export function simMemberResubmit(groupId: string): string | null {
  const g = DB.findGroupById(groupId);
  if (!g) return null;
  const users = read<User>('user');
  const payments = read<Payment>('payment');
  // รองรับทั้งสลิปรอบบิล (Active) และสลิปแรกเข้า (Pending) — ใช้ _kind/_cycle จากใบที่ถูกปฏิเสธ
  for (const m of read<Member>('member').filter(x => x.group_id === groupId && !x.left_date && x.role === 'Member' && (x.status === 'Active' || x.status === 'Pending'))) {
    const bill = memberBillStatus(g, m, payments.filter(p => p.group_id === groupId && p.user_id === m.user_id), todayTH());
    if (bill.slip !== 'Rejected' || !bill.canUpload || !bill.payment) continue;
    const rej = bill.payment;
    const name = users.find(u => u.user_id === m.user_id)?.display_name ?? 'สมาชิก';
    addPayment({ group_id: groupId, user_id: m.user_id, amount: bill.amount.toFixed(2), status: 'Waiting', _kind: rej._kind, _cycle: rej._cycle ?? (currentCycleStart(g, todayTH()) ?? todayTH()), name });
    return name;
  }
  return null;
}

/** สมาชิกคนแรกที่ยังไม่แจ้งออก กดแจ้งออก */
export async function simLeave(groupId: string): Promise<string | null> {
  const users = read<User>('user');
  const m = read<Member>('member').find(x => x.group_id === groupId && !x.left_date && x.role === 'Member' && x.status === 'Active' && !x.leaving);
  if (!m) return null;
  await DB.requestLeave(groupId, m.user_id);
  return users.find(u => u.user_id === m.user_id)?.display_name ?? 'สมาชิก';
}

/* ---------------- Dashboard: จำลองข้อมูลเดือนก่อน ---------------- */
export function devSeedPrevMonthCompare(dir: 'up' | 'down'): void {
  devClearPrevMonthCompare();
  const t = parts(todayTH());
  const start = `${t.y}-${String(t.m).padStart(2, '0')}-01`;
  const twoAgo = addMonthsKeepDay(start, -2, 1);
  const slots = 4;
  const prev = dir === 'up' ? 100 : 800, cur = dir === 'up' ? 400 : 100;
  const g: Group = {
    group_id: uuid(), user_id: uuid(), service_name: 'ทดสอบเทียบเดือน',
    total_price: (cur * slots).toFixed(2), max_slots: slots, billing_date: twoAgo,
    invite_code: 'PREVDEMO', category: 'Other', bank_name: MOCK_HOST_ACCOUNT.bankName, bank_account: MOCK_HOST_ACCOUNT.accountNo, account_holder: MOCK_HOST_ACCOUNT.accountName,
    _billing_cycle: 'monthly', _billing_day: 1, _created_at: twoAgo, _closed_at: null,
    _pricing_history: [
      { from: twoAgo, price: (prev * slots).toFixed(2), max_slots: slots },
      { from: start,  price: (cur * slots).toFixed(2),  max_slots: slots },
    ],
  };
  const groups = read<Group>('group'); groups.push(g); write<Group>('group', groups);
  addMember(g.group_id, DB.me().user_id, 'Member', 'Active', twoAgo);
}

export function devClearPrevMonthCompare(): void {
  const demo = read<Group>('group').find(x => x.invite_code === 'PREVDEMO');
  if (!demo) return;
  write<Group>('group', read<Group>('group').filter(x => x.group_id !== demo.group_id));
  write<Member>('member', read<Member>('member').filter(m => m.group_id !== demo.group_id));
  write<Payment>('payment', read<Payment>('payment').filter(p => p.group_id !== demo.group_id));
}

/* ---------------- นาฬิกาจำลอง ---------------- */
export const devClock = {
  get(): number { try { return Number(localStorage.getItem(DEV_CLOCK_KEY) || 0) || 0; } catch { return 0; } },
  set(days: number): void { try { localStorage.setItem(DEV_CLOCK_KEY, String(days)); } catch { /* blocked */ } },
  shift(days: number): number { const n = devClock.get() + days; devClock.set(n); return n; },
  reset(): void { try { localStorage.removeItem(DEV_CLOCK_KEY); } catch { /* blocked */ } },
};

/** ล้างข้อมูลทดสอบทั้งหมด (+ รีเซ็ตนาฬิกา) */
export function devReset(): void {
  Object.values(K).forEach(k => { try { localStorage.removeItem(k); } catch { /* blocked */ } });
  try { localStorage.removeItem('subsub_schema_version'); } catch { /* blocked */ }
  devClock.reset();
  write<User>('user', [DB.me()]);
}
