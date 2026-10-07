/* =====================================================================
   SubSub · ข้อมูลสาธิต (DEV ONLY) · dev/mock.ts                     [B1/B11]
   ---------------------------------------------------------------------
   ⚠️ ไฟล์ในโฟลเดอร์ src/dev/ ถูก import ผ่าน __DEV_TOOLS__ เท่านั้น
      → ไม่ถูก bundle เข้า production (ตรวจได้ด้วย `npm run check:prod`)
   (แทนที่ src/memberMock.ts เดิม)
   ===================================================================== */

/* [B1] บัญชีของ Host ในกลุ่มสาธิต — ใช้สร้าง bankDT ของกลุ่มสาธิตเท่านั้น
   หน้าโอนเงินจริงอ่านจาก group.bankDT ของแต่ละกลุ่ม (ที่ Host กรอกตอนสร้างกลุ่ม) */
export const MOCK_HOST_ACCOUNT = {
  bankName: 'ธนาคารกสิกรไทย (KBANK)',
  accountNo: '123-4-56789-0',
  accountName: 'สมชาย ไดมอนด์',
};

/** รูปแบบเดียวกับที่ CreatePage บันทึก: "<ธนาคาร> <เลขบัญชี> <ชื่อบัญชี>" */
export const MOCK_HOST_BANKDT =
  `${MOCK_HOST_ACCOUNT.bankName} ${MOCK_HOST_ACCOUNT.accountNo} ${MOCK_HOST_ACCOUNT.accountName}`;

/* รหัสเชิญสาธิต (พิมพ์ที่หน้าเข้าร่วมกลุ่มได้เฉพาะตอน dev) */
export const DEMO_CODE = 'DISNEY-99';       // กลุ่มสาธิตที่มีที่ว่าง
export const DEMO_FULL_CODE = 'NFLX-2026';  // กลุ่มสาธิตที่เต็ม
