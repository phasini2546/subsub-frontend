/* =====================================================================
   SubSub · ชำระเงินเข้ากลุ่ม (Member) · pages/MemberPay.tsx
   ---------------------------------------------------------------------
   หน้า "รายละเอียดกลุ่ม" ก่อนเข้าร่วม — ยอดที่ต้องชำระ (หารต่อหัว + เงินประกัน)
   + บัญชีธนาคาร + อัปโหลดสลิป แล้วแสดงผล "ฝังในหน้า" (ไม่ใช่ pop-up)
     • สำเร็จ  → ส่งคำขอเข้ากลุ่ม (สถานะรอโฮสต์อนุมัติ + จองที่นั่งทันที [B9]) + การ์ดโผล่แท็บ MEMBER
     • ไม่สำเร็จ → ไฟล์ไม่รองรับ/เกินขนาด/อ่านรูปไม่ได้ หรือกลุ่มเต็มระหว่างกรอก
   [B1] บัญชีรับเงินมาจาก group.bankDT ของกลุ่มนี้
   [B11] ตัด ?result=fail และกลุ่มสาธิตอัตโนมัติออก (จำลองโฮสต์ปฏิเสธ → ใช้ DevPanel)
   ===================================================================== */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../ui';
import { DB } from '../db';
import type { Group } from '../types';
import { fmtDateTH } from '../lib/date';
import {
  MIcon, BankInfoCard, SlipUploader, BottomSheet, InlineResult, validateSlip, compressImage, th2,
} from './MemberUI';

type Phase = 'form' | 'success' | 'fail';

export default function MemberPay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [group, setGroup] = useState<Group | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [failMsg, setFailMsg] = useState('');
  const [busy, setBusy] = useState(false);

  /* หา group จาก gid — ไม่มี gid / ไม่พบกลุ่ม → กลับไปหน้ากรอกรหัส */
  useEffect(() => {
    const gid = params.get('gid');
    if (!gid) { navigate('/join', { replace: true }); return; }
    if (DB.memberJoinStatus(gid) === 'already') { navigate('/member/group/' + gid, { replace: true }); return; }
    const g = DB.findGroupById(gid);
    if (!g) { navigate('/join', { replace: true }); return; }
    setGroup(g);
  }, [params, navigate]);

  const quote = useMemo(() => (group ? DB.memberQuote(group.group_id) : null), [group]);

  const fail = (msg: string) => { setFailMsg(msg); setTimeout(() => setPhase('fail'), 200); };

  const confirmSend = async () => {
    if (busy || !group) return;
    setSheetOpen(false);
    const v = validateSlip(slip);
    if (!v.ok) { fail(v.reason || 'ไฟล์ที่แนบไม่ถูกต้อง'); return; }
    setBusy(true);
    try {
      const dataUrl = slip ? await compressImage(slip) : '';
      if (!dataUrl) { fail('อ่านรูปสลิปไม่ได้ กรุณาเลือกรูป JPG/PNG ใหม่อีกครั้ง'); return; }
      const r = DB.joinGroupWithSlip(group.group_id, dataUrl);   // บันทึกคำขอ + สลิป (จองที่นั่ง)
      if (r === 'full') { fail('ขออภัย ระหว่างที่คุณกรอกข้อมูล ที่นั่งในกลุ่มเต็มแล้ว'); return; }
      if (r === 'already') { navigate('/member/group/' + group.group_id); return; }
      if (r !== 'ok') { fail('ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'); return; }
      setTimeout(() => setPhase('success'), 200);
    } finally {
      setBusy(false);
    }
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
                    ? `ราคาเต็ม ${th2(quote.fullPrice)} ÷ ${quote.slots} คน = ${th2(quote.share)}/รอบ · ใช้จริง ${quote.usedDays}/${quote.daysInCycle} วัน`
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

        {quote && (
          <p className="mnote" style={{ marginTop: 10 }}>
            รอบบิลเต็มรอบแรกของคุณเริ่ม {fmtDateTH(quote.nextDue)} — ระบบจะเปิดให้ส่งสลิปล่วงหน้า 3 วันก่อนวันนั้น
          </p>
        )}

        {/* บัญชีธนาคารของโฮสต์กลุ่มนี้ [B1] */}
        {group && <BankInfoCard bankDT={group.bankDT} />}

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
          <button className="mbtn green" style={{ marginTop: 20 }} disabled={!slip || busy} onClick={confirmSend}>
            {MIcon.shield}ยืนยันการส่งหลักฐาน
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
