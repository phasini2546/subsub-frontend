/* =====================================================================
   SubSub · ชำระเงินเข้ากลุ่ม (Member) · pages/MemberPay.tsx
   ---------------------------------------------------------------------
   หน้า "รายละเอียดกลุ่ม" ก่อนเข้าร่วม — ยอดที่ต้องชำระ (หารต่อหัว + เงินประกัน)
   + บัญชีธนาคาร + อัปโหลดสลิป แล้วแสดงผล "ฝังในหน้า" (ไม่ใช่ pop-up)
     • สำเร็จ  → ส่งคำขอเข้ากลุ่ม (บันทึกลง DB สถานะรอโฮสต์อนุมัติ) + การ์ดโผล่แท็บ MEMBER
     • ไม่สำเร็จ → 1) โฮสต์ปฏิเสธ (?result=fail)  2) ไฟล์ไม่รองรับ/เกินขนาด
   ===================================================================== */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../ui';
import { DB } from '../db';
import type { Group } from '../types';
import {
  MIcon, BankInfoCard, SlipUploader, BottomSheet, InlineResult, validateSlip, compressImage, th2,
} from './MemberUI';

type Phase = 'form' | 'success' | 'fail';

export default function MemberPay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const forceFail = params.get('result') === 'fail';   // จำลอง: โฮสต์ปฏิเสธ

  const [group, setGroup] = useState<Group | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [failMsg, setFailMsg] = useState('');

  /* หา group จาก gid — ไม่มี gid ให้ใช้กลุ่มสาธิต disney */
  useEffect(() => {
    const gid = params.get('gid');
    if (gid) {
      if (DB.memberJoinStatus(gid) === 'already') { navigate('/member/group/' + gid); return; }
      setGroup(DB.findGroupById(gid));
    } else {
      setGroup(DB.ensureDemoDisney());
    }
  }, [params, navigate]);

  const quote = useMemo(() => (group ? DB.memberQuote(group.group_id) : null), [group]);

  const confirmSend = async () => {
    setSheetOpen(false);
    const v = validateSlip(slip);
    if (!v.ok) {                                   // 2) ไฟล์ไม่รองรับ/เกินขนาด
      setFailMsg(v.reason || 'ไฟล์ที่แนบไม่ถูกต้อง');
      setTimeout(() => setPhase('fail'), 200);
      return;
    }
    if (forceFail) {                               // 1) โฮสต์ปฏิเสธ (จำลอง)
      setFailMsg('คำขอเข้าร่วมกลุ่มของคุณไม่ได้รับการอนุมัติจากโฮสต์ กรุณาติดต่อโฮสต์หรือลองส่งหลักฐานใหม่');
      setTimeout(() => setPhase('fail'), 200);
      return;
    }
    if (!group) return;
    const dataUrl = slip ? await compressImage(slip) : '';
    DB.joinGroupWithSlip(group.group_id, dataUrl);   // บันทึกคำขอ + สลิปลง DB
    setTimeout(() => setPhase('success'), 200);
  };

  const retryUpload = () => { setSlip(null); setPhase('form'); setSheetOpen(true); };


  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/join')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>รายละเอียดกลุ่ม</h1>
      </header>

      <main className="mscreen">
        {/* บันทึกย่อ */}
        <div className="msummary">{MIcon.info}<p>กรุณาชำระเงินเพื่อเริ่มใช้งานกลุ่ม และ ระบบคำนวณยอดหารให้อัตโนมัติ</p></div>

        {/* ยอดรวมที่ต้องชำระ */}
        <div className="duecard">
          <div className="duecard-l">TOTAL AMOUNT DUE</div>
          <div className="duecard-a">{th2(quote ? quote.totalDue : 0)}<span>บาท</span></div>
        </div>

        {/* สรุปยอดคำนวณ */}
        <div className="brkcard">
          <h3>สรุปยอดคำนวณ</h3>
          <div className="brkrows">
            <div className="brkrow">
              <div>
                <div className="bl">ค่าบริการเดือนแรก{quote?.prorated ? ' (ตามสัดส่วนวัน)' : ' (หารต่อหัว)'}</div>
                <div className="bc">
                  {quote?.prorated
                    ? `ราคาเต็ม ${th2(quote.fullPrice)} ÷ ${quote.slots} คน = ${th2(quote.share)}/เดือน · ใช้จริง ${quote.usedDays}/${quote.daysInMonth} วัน`
                    : `ราคาเต็ม ${th2(quote ? quote.fullPrice : 0)} ÷ ${quote ? quote.slots : 0} คน`}
                </div>
              </div>
              <div className="bv">{th2(quote ? quote.firstAmount : 0)} บาท</div>
            </div>
            <div className="brkdiv" />
            <div className="brkrow" style={{ alignItems: 'center' }}>
              <div className="bl">เงินประกัน (Security Deposit)</div>
              <div className="bv">{th2(quote ? quote.deposit : 0)} บาท</div>
            </div>
          </div>
        </div>

        {/* บัญชีธนาคาร */}
        <BankInfoCard />

        {/* ---- ใต้บัญชีธนาคาร: ฟอร์มอัปโหลด หรือ ผลลัพธ์ฝังในหน้า ---- */}
        {phase === 'form' && (
          <>
            <button className="mbtn gold" onClick={() => setSheetOpen(true)}>
              {MIcon.upload}อัปโหลดสลิป (Upload Slip)
            </button>
            <p className="mnote">เมื่อโอนเงินเสร็จสิ้น โปรดแนบหลักฐานการโอนเงินเพื่อให้ Host ตรวจสอบยอดชำระ</p>
          </>
        )}

        {phase === 'success' && (
          <InlineResult
            variant="success"
            title="ส่งคำขอเข้ากลุ่มสำเร็จ"
            message="ระบบได้ส่งคำขอของคุณไปยังเจ้าของกลุ่มเรียบร้อยแล้ว โปรดรอการยืนยันจากโฮสต์ในขั้นตอนถัดไป"
            waiting="รอการอนุมัติจากโฮสต์"
            primary={{ label: 'ไปที่กลุ่มของฉัน', onClick: () => navigate(group ? '/member/group/' + group.group_id : '/groups') }}
          />
        )}

        {phase === 'fail' && (
          <InlineResult
            variant="error"
            title="ขออภัย คำขอเข้าร่วมไม่สำเร็จ"
            message={failMsg}
            retry={{ label: 'อัปโหลดสลิป (Upload Slip)', onClick: retryUpload }}
          />
        )}
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
    </div>
  );
}
