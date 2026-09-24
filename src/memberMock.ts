/* =====================================================================
   SubSub · ข้อมูลจำลองฝั่ง Member · memberMock.ts
   ---------------------------------------------------------------------
   พอร์ตจากเวอร์ชัน 25 ส.ค. (Figma "Manage Group Subscriptions Ver. Member")
   ยอด/สำเนา/รหัส ตรงกับต้นฉบับทุกตัว — เป็นแหล่งข้อมูลเดียวของ prototype
   (ยังไม่ผูก backend; หน้า Member เดินเรื่องด้วยข้อมูลชุดนี้)
   ===================================================================== */

/* บัญชีผู้รับเงิน (โชว์บนหน้าชำระเงิน) */
export const payee = {
  bankName: 'ธนาคารกสิกรไทย (KBANK)',
  bankShort: 'KBANK',
  accountName: 'สมชาย ไดมอนด์',
  accountNo: '123-4-56789-0',
};

/* รหัสคำเชิญที่ใช้ได้จริง / รหัสกลุ่มเต็ม */
export const VALID_CODE = 'DISNEY-99';
export const FULL_CODE = 'NFLX-2026';

export type Breakdown = {
  firstMonthLabel: string;
  firstMonthCalc: string;
  firstMonthAmount: number;
  depositLabel: string;
  depositAmount: number;
};
export type PayGroup = {
  id: string;
  service: string;
  serviceLabel: string;
  status: string;
  totalMonthlyPrice: number;
  currency: string;
  joinedMidCycle: boolean;
  note: string;
  totalDue: number;
  breakdown: Breakdown;
};

/* กลุ่มที่เข้าร่วมกลางรอบบิล → คิดตามจริง (232.80) */
export const proratedGroup: PayGroup = {
  id: 'grp_disney',
  service: 'disney',
  serviceLabel: 'Disney+',
  status: 'ACTIVE',
  totalMonthlyPrice: 99,
  currency: 'THB',
  joinedMidCycle: true,
  note: 'คุณเข้าร่วมระหว่างรอบบิล ระบบคำนวณตามจริง',
  totalDue: 232.8,
  breakdown: {
    firstMonthLabel: 'ค่าบริการเดือนแรก',
    firstMonthCalc: 'calculated from 12/30 days',
    firstMonthAmount: 83.8,
    depositLabel: 'เงินประกัน',
    depositAmount: 149.0,
  },
};

/* กลุ่มที่เข้าร่วมต้นรอบบิล → เต็มเดือน (298.80) */
export const fullMonthGroup: PayGroup = {
  ...proratedGroup,
  joinedMidCycle: false,
  note: 'กรุณาชำระเงินเพื่อเริ่มใช้งานกลุ่ม',
  totalDue: 298.8,
  breakdown: {
    firstMonthLabel: 'ค่าบริการเดือนแรก',
    firstMonthCalc: 'calculated from 1/30 days',
    firstMonthAmount: 149.0,
    depositLabel: 'เงินประกัน (Security Deposit)',
    depositAmount: 149.0,
  },
};

/* กลุ่มที่ใช้งานอยู่ (หน้ารายละเอียด/ตรวจสอบ/ออกจากกลุ่ม) */
export const activeGroup = {
  id: 'grp_disney',
  service: 'disney',
  serviceLabel: 'disney',
  status: 'ACTIVE',
  totalMonthlyPrice: 99,
  currency: 'THB',
  leaveEffectiveDate: '1 มกราคม 2567',
  members: [
    { id: 'm_a', name: 'Member A', subtitle: 'ชำระเงินเรียบร้อยแล้ว', payStatus: 'due' as const },
  ],
};

/* ขั้นตอนขอรหัสจากโฮสต์ (หน้าเข้าร่วมกลุ่ม) */
export const codeInstructions = [
  'ติดต่อหัวหน้ากลุ่ม (Host) ที่คุณต้องการร่วมทีม',
  'ขอรหัสคำเชิญ 8 หลักจากเมนู "แชร์รหัส" ของโฮสต์',
  'นำรหัสมากรอกในช่องด้านบนและกดปุ่มเข้าร่วม',
];
