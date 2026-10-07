/* =====================================================================
   SubSub · วันที่/เวลาตามเวลาไทย · lib/date.ts                    [B6]
   ---------------------------------------------------------------------
   ปัญหาเดิม: ใช้ new Date().toISOString().slice(0,10) → ได้วันที่ "UTC"
     • เปิดแอป 00:00–06:59 น. (เวลาไทย) วันที่จะเป็นของเมื่อวาน
     • new Date(y,m,d).toISOString() ในไทย = วันก่อนหน้า 1 วัน (17:00Z)
   แนวทางใหม่:
     • วันที่ล้วน (ไม่มีเวลา) เก็บเป็นสตริง 'YYYY-MM-DD' ตามปฏิทินไทย (ISODate)
     • คำนวณบวก/ลบวันด้วย Date.UTC ล้วน → ไม่ขึ้นกับ timezone ของเครื่อง
     • แสดงผลด้วย Intl + timeZone เสมอ
   ===================================================================== */
import type { ISODate } from '../types';

export const TZ = 'Asia/Bangkok';
const DAY_MS = 86_400_000;

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

export const pad2 = (n: number): string => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number): ISODate => `${y}-${pad2(m)}-${pad2(d)}`;

/** แปลงเวลา (instant) → วันที่ตามปฏิทินไทย 'YYYY-MM-DD' */
export function toISODateTH(d: Date): ISODate {
  let y = 0, m = 0, day = 0;
  for (const p of partsFmt.formatToParts(d)) {
    if (p.type === 'year') y = Number(p.value);
    else if (p.type === 'month') m = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
  }
  return ymd(y, m, day);
}

/** แยก 'YYYY-MM-DD' (หรือ timestamp เต็ม → แปลงเป็นวันไทยก่อน) เป็นตัวเลข (m = 1–12) */
export function parts(iso: string): { y: number; m: number; d: number } {
  const s = iso.length > 10 ? toISODateTH(new Date(iso)) : iso;
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/** จำนวนวันในเดือน (m = 1–12) */
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** สร้างวันที่จาก ปี/เดือน/วัน — เดือนเกิน 12 ได้ (ทบปี), วันเกินเดือน → ตัดเป็นวันสุดท้ายของเดือน [B7] */
export function makeDate(y: number, m: number, day: number): ISODate {
  const m0 = m - 1;
  const yy = y + Math.floor(m0 / 12);
  const mm = (((m0 % 12) + 12) % 12) + 1;
  return ymd(yy, mm, Math.min(Math.max(1, day), daysInMonth(yy, mm)));
}

const utcMs = (iso: ISODate): number => { const p = parts(iso); return Date.UTC(p.y, p.m - 1, p.d); };

export function addDays(iso: ISODate, n: number): ISODate {
  const t = new Date(utcMs(iso) + n * DAY_MS);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** จำนวนวันจาก from → to (to - from) */
export const diffDays = (from: ISODate, to: ISODate): number => Math.round((utcMs(to) - utcMs(from)) / DAY_MS);

/** บวกเดือนโดย "ยึดวันเดิม" (anchorDay) — 31 ม.ค. → 28/29 ก.พ. → 31 มี.ค. (ไม่ไหลเป็น 28) [B7] */
export function addMonthsKeepDay(iso: ISODate, months: number, anchorDay?: number): ISODate {
  const p = parts(iso);
  return makeDate(p.y, p.m + months, anchorDay ?? p.d);
}

/** ดัชนีเดือน (ปี*12 + เดือน0) */
export const monthIndex = (iso: ISODate): number => { const p = parts(iso); return p.y * 12 + p.m - 1; };

/* ---------------- แสดงผล (ภาษาไทย / เวลาไทย) ---------------- */

/** วันที่ล้วน → ข้อความไทย เช่น '20 ตุลาคม 2569' */
export function fmtDateTH(iso: string | null | undefined, opts: { month?: 'long' | 'short'; year?: boolean } = {}): string {
  if (!iso) return '-';
  const p = parts(iso);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString('th-TH', {
    timeZone: 'UTC',                       // ค่าเป็นวันที่ล้วนแล้ว ห้ามเลื่อน timezone ซ้ำ
    day: 'numeric', month: opts.month ?? 'long', ...(opts.year === false ? {} : { year: 'numeric' }),
  });
}

/** timestamp → 'วันที่ · เวลา น.' ตามเวลาไทย */
export function fmtDateTimeTH(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) + ' น.';
}
