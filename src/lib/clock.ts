/* =====================================================================
   SubSub · นาฬิกากลางของแอป · lib/clock.ts                        [B6/B11]
   ---------------------------------------------------------------------
   ทุกที่ที่ต้องรู้ "ตอนนี้/วันนี้" ให้เรียกผ่านไฟล์นี้เท่านั้น
     • Production : เวลาจริงเสมอ (import.meta.env.DEV = false → โค้ดเลื่อนเวลาถูกตัดทิ้งตอน build)
     • Dev        : เลื่อนวันจำลองได้จาก DevPanel (ทดสอบขึ้นรอบใหม่/ค้างชำระ/เตะออก โดยไม่ต้องรอจริง)
   ===================================================================== */
import { toISODateTH } from './date';
import type { ISODate } from '../types';

/** key ที่ DevPanel ใช้เก็บจำนวนวันที่เลื่อน (dev เท่านั้น) */
export const DEV_CLOCK_KEY = 'subsub_dev_day_offset';

function devOffsetDays(): number {
  if (!__DEV_TOOLS__) return 0;
  try { return Number(localStorage.getItem(DEV_CLOCK_KEY) || 0) || 0; }
  catch { return 0; }
}

/** เวลาปัจจุบัน (instant) */
export function now(): Date {
  const off = devOffsetDays();
  return off ? new Date(Date.now() + off * 86_400_000) : new Date();
}

/** วันนี้ตามปฏิทินไทย 'YYYY-MM-DD' */
export const todayTH = (): ISODate => toISODateTH(now());

/** timestamp ปัจจุบัน (ISO/UTC — เป็นจุดเวลาที่แน่นอน แสดงผลด้วย fmtDateTimeTH) */
export const nowStamp = (): string => now().toISOString();
