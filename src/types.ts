/* =====================================================================
   SubSub · TypeScript types · types.ts
   ---------------------------------------------------------------------
   นิยามชนิดข้อมูลให้ตรงกับ schema จริง (PostgreSQL + Prisma)
   ใช้ร่วมกันทุกไฟล์ เพื่อให้ TS ช่วยจับ error ตอนเขียน
   ===================================================================== */

/* ---------- ค่าคงที่ที่เป็นชุดตายตัว (union type) ---------- */
export type Role      = 'Host' | 'Member';
export type MemberStatus  = 'Active' | 'Inactive' | 'Pending';
export type PaymentStatus = 'Verified' | 'Waiting' | 'Rejected';
export type Category  = 'Entertainment' | 'Music' | 'Productivity' | 'Other';

/* สถานะที่ UI ใช้แสดง (map มาจากหลายตารางด้วย deriveStatus) */
export type UiStatus  = 'paid' | 'review' | 'unpaid' | 'leaving';

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
  billing_date: string;     // YYYY-MM-DD
  invite_code: string;
  category: Category;
  bankDT: string;
  _billing_cycle?: string;  // [M3] ยังไม่มีใน schema
  _deposit?: string;        // [M6] ยังไม่มีใน schema
}

/* ---------- ตาราง Group_Member ---------- */
export interface Member {
  member_id: string;
  group_id: string;
  user_id: string;
  joined_date: string;
  role: Role;
  status: MemberStatus;
  leaving?: boolean;        // [M4] ธงชั่วคราวแทน leave_requested_at
}

/* ---------- ตาราง Payment ---------- */
export interface Payment {
  payment_id: string;
  group_id: string;
  user_id: string;
  amount: string;
  slip_url: string;
  status: PaymentStatus;
  paid_at: string;          // ISO timestamp
  _reject_reason?: string;  // [M5] ยังไม่มีใน schema
  _archived?: boolean;      // รอบบิลเก่า (จำลอง Billing_Cycle)
}

/* ---------- ตาราง Billing_Cycle [M2] ---------- */
export interface BillingCycle {
  cycle_id: string;
  group_id: string;
  period: number;
  started_at: string;
  price: string;
}

/* ---------- รูปแบบข้อมูลที่ API คืนกลับ (join แล้ว) ---------- */

// แถวในหน้ารายการกลุ่ม (Group + role ของฉัน + จำนวนสมาชิก)
export interface GroupRow extends Group {
  role: Role;
  memberCount: number;
}

// สมาชิกในหน้า detail (Member + User + Payment รอบปัจจุบัน)
export interface MemberWithDetail extends Member {
  user: User;
  currentPayment: Payment | null;
}

// ข้อมูลกลุ่มเต็มในหน้า detail
export interface GroupDetail extends Group {
  members: MemberWithDetail[];
  requests: MemberWithDetail[];
}

// ข้อมูลรอบบิล (จาก billing_date)
export interface BillingInfo {
  billing_date: string;
  next_due: string;
  days_until: number;
  reminder: 'due_today' | 'due_in_3days' | 'overdue' | null;
}

// payload ตอนสร้างกลุ่ม
export interface CreateGroupInput {
  service_name: string;
  total_price: string;
  max_slots: number;
  billing_date: string;
  category: Category;
  bankDT: string;
  billing_cycle: string;
}