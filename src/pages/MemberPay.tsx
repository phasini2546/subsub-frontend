/* =====================================================================
   SubSub · ชำระเงินเข้ากลุ่ม (Member) · pages/MemberPay.tsx
   ---------------------------------------------------------------------
   พอร์ตจากหน้าจอ 05/06/07/10/11 (25 ส.ค.) — รายละเอียดยอดที่ต้องชำระ
   + ชีตอัปโหลดสลิป + ผลลัพธ์สำเร็จ/ไม่สำเร็จ
   • ?plan=full  → เต็มเดือน 298.80 | ค่าเริ่มต้น: คิดตามจริง 232.80
   • ?result=fail → แสดงผล "คำขอเข้าร่วมไม่สำเร็จ"
   ===================================================================== */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../ui';
import {
  MIcon, BankInfoCard, SlipUploader, BottomSheet, ResultOverlay, th2,
} from './MemberUI';
import { proratedGroup, fullMonthGroup } from '../memberMock';

export default function MemberPay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const group = params.get('plan') === 'full' ? fullMonthGroup : proratedGroup;
  const forceFail = params.get('result') === 'fail';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [result, setResult] = useState<null | 'ok' | 'fail'>(null);

  const confirmSend = () => {
    setSheetOpen(false);
    setTimeout(() => setResult(forceFail ? 'fail' : 'ok'), 250);
  };

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/join')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>รายละเอียดกลุ่ม</h1>
      </header>

      <main className="mscreen">
        {/* บันทึกย่อ */}
        <div className="msummary">{MIcon.info}<p>{group.note}</p></div>

        {/* ยอดรวมที่ต้องชำระ */}
        <div className="duecard">
          <div className="duecard-l">TOTAL AMOUNT DUE</div>
          <div className="duecard-a">{th2(group.totalDue)}<span>บาท</span></div>
        </div>

        {/* สรุปยอดคำนวณ */}
        <div className="brkcard">
          <h3>สรุปยอดคำนวณ</h3>
          <div className="brkrows">
            <div className="brkrow">
              <div>
                <div className="bl">{group.breakdown.firstMonthLabel}</div>
                <div className="bc">{group.breakdown.firstMonthCalc}</div>
              </div>
              <div className="bv">{th2(group.breakdown.firstMonthAmount)} บาท</div>
            </div>
            <div className="brkdiv" />
            <div className="brkrow" style={{ alignItems: 'center' }}>
              <div className="bl">{group.breakdown.depositLabel}</div>
              <div className="bv">{th2(group.breakdown.depositAmount)} บาท</div>
            </div>
          </div>
        </div>

        {/* บัญชีธนาคาร */}
        <BankInfoCard />

        {/* ปุ่มอัปโหลดสลิป */}
        <button className="mbtn gold" onClick={() => setSheetOpen(true)}>
          {MIcon.upload}อัปโหลดสลิป (Upload Slip)
        </button>
        <p className="mnote">เมื่อโอนเงินเสร็จสิ้น โปรดแนบหลักฐานการโอนเงินเพื่อให้ Host ตรวจสอบยอดชำระ</p>
      </main>

      {/* ชีตอัปโหลดสลิป */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="sheet-head">
          <h2>ส่งหลักฐานของคุณ</h2>
          <p>กรุณาแนบรูปภาพสลิปธนาคารที่เห็นยอดเงินและวันที่ชัดเจน</p>
        </div>
        <div className="sheet-body">
          <SlipUploader onChange={setSlip} />
          <button className="mbtn green" style={{ marginTop: 20 }} disabled={!slip} onClick={confirmSend}>
            {MIcon.shield}ยืนยันการส่งหลักฐาน
          </button>
        </div>
      </BottomSheet>

      {/* ผล: ส่งคำขอเข้ากลุ่มสำเร็จ */}
      <ResultOverlay
        open={result === 'ok'}
        variant="success"
        title="ส่งคำขอเข้ากลุ่มสำเร็จ"
        message="ระบบได้ส่งคำขอของคุณไปยังเจ้าของกลุ่มเรียบร้อยแล้ว โปรดรอการยืนยันจากโฮสต์ในขั้นตอนถัดไป"
        action={{ label: 'ไปที่กลุ่มของฉัน', onClick: () => navigate('/member/group') }}
        onClose={() => setResult(null)}
      />

      {/* ผล: คำขอเข้าร่วมไม่สำเร็จ */}
      <ResultOverlay
        open={result === 'fail'}
        variant="error"
        title="ขออภัย คำขอเข้าร่วมไม่สำเร็จ"
        message="คำขอเข้าร่วมกลุ่มของคุณไม่ได้รับการอนุมัติ กรุณาลองเลือกกลุ่มใหม่อีกครั้ง"
        action={{ label: 'ลองอีกครั้ง', onClick: () => setResult(null) }}
        onClose={() => setResult(null)}
      />
    </div>
  );
}
