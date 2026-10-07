/* =====================================================================
   SubSub · TypeScript types · types.ts
   ---------------------------------------------------------------------
   นิยามชนิดข้อมูลให้ตรงกับ schema จริง (PostgreSQL + Prisma)
   ใช้ร่วมกันทุกไฟล์ เพื่อให้ TS ช่วยจับ error ตอนเขียน
   ---------------------------------------------------------------------
   วันที่ทั้งระบบ:
     • ISODate   = 'YYYY-MM-DD' ตาม "ปฏิทินไทย" (Asia/Bangkok, UTC+7)
     • timestamp = ISO เต็ม เช่น submitted_at (เก็บเป็น UTC แต่แสดงผลเป็นเวลาไทยเสมอ)
   ===================================================================== */

/* ---------- ค่าคงที่ที่เป็นชุดตายตัว (union type) ---------- */
export type Role      = 'Host' | 'Member';
export type MemberStatus  = 'Active' | 'Inactive' | 'Pending';
export type PaymentStatus = 'Verified' | 'Waiting' | 'Rejected';
export type Category  = 'Entertainment' | 'Music' | 'Productivity' | 'Other';

/** 'YYYY-MM-DD' ตามปฏิทินไทย */
export type ISODate = string;

/* สถานะที่ UI ฝั่ง Host ใช้แสดง (map มาจาก BillStatus ด้วย deriveStatus) */
export type UiStatus = 'paid' | 'review' | 'rejected' | 'upcoming' | 'unpaid' | 'overdue' | 'leaving';

/* เหตุผลที่สมาชิกหลุดจากกลุ่ม (ปล่อย slot) */
export type LeftReason = 'overdue' | 'left' | 'host' | 'closed' | 'cancelled';

/* ---------- ตาราง User ---------- */
export interface User {
  user_id: string;
  line_uid: string;
  display_name: string;
  pic_user: string;
}

/* ---------- ตาราง Group ---------- */
export interface Group {
  group_id: string;
  user_id: string;          // host
  service_name: string;
  total_price: string;      // DECIMAL เก็บเป็น string กันปัญหาทศนิยม
  max_slots: number;
  billing_date: string;     // ISODate — "วันเริ่มรอบบิลแรก" (anchor) คำนวณจากวันที่สร้างกลุ่ม + วันที่ Host เลือก [B7]
  invite_code: string;
  _invite_cycle?: string;     // [#12] รอบบิลที่รหัสเชิญนี้ใช้ได้ — ขึ้นรอบใหม่ = สุ่มรหัสใหม่ รหัสเก่าใช้ไม่ได้
  category: Category;
  bank_name: string;
  bank_account: string;
  account_holder: string;
  _billing_cycle?: string;  // [M3] 'monthly' | 'yearly'
  _billing_day?: number;    // [B7] วันที่ตัดรอบที่ Host เลือก (1–31) — ใช้ยึดวันเดิมทุกรอบ ไม่เลื่อน
  _created_at?: string;     // [B7] ISODate วันที่สร้างกลุ่มสำเร็จ
  _closed_at?: string | null; // ปิดกลุ่ม (soft delete) — เก็บประวัติให้ Dashboard
  /* [M7/B12] ประวัติราคา/ช่อง — from = ISODate "วันเริ่มรอบบิล" แรกที่ราคานี้มีผล
     (ข้อมูลเก่าแบบ 'YYYY-MM' ยังอ่านได้ — ถือเป็นวันที่ 1 ของเดือน) */
  _pricing_history?: { from: string; price: string; max_slots: number }[];
}

/* ---------- ตาราง Group_Member ---------- */
export interface Member {
  member_id: string;
  group_id: string;
  user_id: string;
  joined_date: string;        // ISODate
  role: Role;
  status: MemberStatus;
  leaving?: boolean;          // [M4] แจ้งประสงค์ออกแล้ว (แทน leave_requested_at)
  _leave_at?: string;         // ISODate วันที่กดแจ้งออก
  _leave_effective?: string;  // ISODate วันที่ออกจริง (= วันเริ่มรอบหลังรอบที่ใช้เงินประกัน)
  _waived_cycles?: string[];  // รอบบิลที่ไม่ต้องจ่าย เพราะใช้เงินประกันจ่ายแทน
  _reminded_at?: string;      // timestamp ที่ Host กดแจ้งเตือนล่าสุด [B5]
  _removed_reason?: LeftReason; // เหตุผลที่หลุดจากกลุ่ม [B9]
  _deposit_forfeited?: boolean; // ถูกเตะเพราะค้างชำระ → เงินประกันถูกยึดเป็นค่าบริการรอบที่ค้าง
  left_date?: string | null;  // ISODate วันที่ออกจากกลุ่ม — null=ยังอยู่ (slot ว่างเมื่อมีค่า)
}

/* ---------- ตาราง Payment ---------- */
export interface Payment {
  payment_id: string;
  group_id: string;
  user_id: string;
  amount: string;
  slip_url: string;
  status: PaymentStatus;
  submitted_at: string;            // timestamp ที่ส่งสลิป
  _kind?: 'join' | 'cycle';   // join = แรกเข้า (ค่าบริการเดือนแรก + เงินประกัน), cycle = ค่าบริการรายรอบ
  _cycle?: string;            // ISODate วันเริ่มรอบบิลที่สลิปนี้จ่าย [B2/B3/B12]
  _reject_reason?: string;    // [M5]
  reviewed_at?: string;      // timestamp ที่ Host อนุมัติ/ปฏิเสธ
  _archived?: boolean;        // (legacy) ไม่ใช้แล้ว — คงไว้ให้ข้อมูลเก่าอ่านได้
}

/* ---------- ตาราง Billing_Cycle [M2] ---------- */
export interface BillingCycle {
  cycle_id: string;
  group_id: string;
  period: number;
  started_at: string;
  price: string;
}

/* ---------- สถานะการชำระของสมาชิก 1 คน (คำนวณจากวันที่ — ใช้ร่วมกันทั้ง Host และ Member) ---------- */
export type BillPhase =
  | 'host'      // โฮสต์ (ไม่ต้องจ่าย)
  | 'pending'   // แรกเข้า รอโฮสต์อนุมัติ
  | 'settled'   // จ่ายรอบปัจจุบันแล้ว / ยังไม่ถึงช่วงจ่าย
  | 'window'    // ช่วงจ่ายล่วงหน้า 3 วันก่อนครบกำหนด
  | 'due'       // ถึงกำหนดแล้ว ยังไม่จ่าย (D0–D+4)
  | 'overdue'   // ค้างชำระ (D+5–D+9) — นับถอยหลังก่อนถูกนำออก
  | 'leaving';  // แจ้งออกแล้ว ไม่มีรอบที่ต้องจ่าย

export interface BillStatus {
  phase: BillPhase;
  slip: PaymentStatus | null;     // สถานะสลิปของรอบเป้าหมาย
  payment: Payment | null;        // สลิปใบนั้น (หรือใบที่ยืนยันล่าสุดถ้า settled)
  target: ISODate | null;         // รอบบิลที่ต้องจ่าย (วันเริ่มรอบ)
  dueDate: ISODate | null;        // วันครบกำหนดของรอบเป้าหมาย / รอบถัดไป
  daysUntilDue: number | null;    // + = อีกกี่วัน, 0 = วันนี้, - = เลยมากี่วัน
  daysLate: number;               // จำนวนวันที่เลยกำหนด (0 = ไม่ค้าง)
  kickInDays: number | null;      // อีกกี่วันจะถูกนำออก (null = ไม่มีความเสี่ยง/รอโฮสต์ตรวจสลิป)
  kickDate: ISODate | null;       // วันที่จะถูกนำออกอัตโนมัติ
  canUpload: boolean;             // เปิดกล่องอัปโหลดสลิปได้ไหม
  amount: number;                 // ยอดที่ต้องจ่ายของรอบเป้าหมาย
  leaveEffective: ISODate | null; // วันที่ออกจริง (ถ้าแจ้งออก)
}

/* ---------- รูปแบบข้อมูลที่ API คืนกลับ (join แล้ว) ---------- */

// แถวในหน้ารายการกลุ่ม (Group + role ของฉัน + จำนวนสมาชิก)
export interface GroupRow extends Group {
  role: Role;
  memberCount: number;      // ที่นั่งที่ถูกใช้/จอง (Active + Pending) [B9]
}

// สมาชิกในหน้า detail (Member + User + Payment รอบเป้าหมาย + สถานะบิล + ประวัติสลิป)
export interface MemberWithDetail extends Member {
  user: User;
  currentPayment: Payment | null;
  bill: BillStatus;
  payments: Payment[];      // ประวัติสลิปทั้งหมด (ใหม่ → เก่า) [B8]
}

// ข้อมูลกลุ่มเต็มในหน้า detail
export interface GroupDetail extends Group {
  members: MemberWithDetail[];
  requests: MemberWithDetail[];
  seatsUsed: number;        // Active + Pending (Pending จองที่นั่ง) [B9]
}

// ข้อมูลรอบบิลระดับกลุ่ม (จาก billing_date)
export interface BillingInfo {
  billing_date: string;
  next_due: string;         // ISODate วันเริ่มรอบถัดไป (หรือวันนี้ถ้าวันนี้คือวันตัดรอบ)
  days_until: number;
  reminder: 'due_today' | 'due_in_3days' | null;
}

// payload ตอนสร้าง/แก้ไขกลุ่ม
export interface CreateGroupInput {
  service_name: string;
  total_price: string;
  max_slots: number;
  billing_day: number;      // [B7] วันที่ 1–31 ที่ Host เลือก (รายปี = วันของ billing_date_full)
  billing_date_full?: string; // รายปี: วันที่ที่เลือกจากปฏิทิน
  category: Category;
  bank_name: string;
  bank_account: string;
  account_holder: string;
  billing_cycle: string;
}

/* ---------- ตาราง Subscription (รายจ่ายส่วนตัว) ---------- */
export interface Subscription {
  sub_id: string;
  user_id: string;
  service_name: string;
  price: string;
  billing_date: string;      // ISODate วันครบกำหนดรอบแรก (anchor)
  category: Category;
  _billing_cycle?: string;   // 'monthly' | 'yearly'
  _billing_day?: number;     // [B7] วันที่ตัดรอบ (1–31)
  end_date?: string | null;  // วันที่ลบ/ยกเลิก — null=ยังบันทึกอยู่ (ทาง B)
}

/* ---------- ข้อมูลสรุปสำหรับ Dashboard ---------- */
export interface DashboardData {
  monthTotal: number;                              // ค่าใช้จ่ายเดือนนี้ (รวมทุกหมวด)
  yearTotal: number;                               // ค่าใช้จ่ายรายปี (นับเดือนสะสม)
  prevMonthTotal: number;                          // ค่าใช้จ่ายเดือนก่อน (ไว้เทียบ ↑↓ %)
  byCategory: { category: Category; label: string; amount: number; percent: number }[];
}
