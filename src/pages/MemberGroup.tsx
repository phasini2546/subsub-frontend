/* =====================================================================
   SubSub · กลุ่มที่ใช้งานอยู่ (Member) · pages/MemberGroup.tsx
   ---------------------------------------------------------------------
   พอร์ตจากหน้าจอ 12/13/17/18 (25 ส.ค.) — รายละเอียดกลุ่ม + ตรวจสอบสลิป
   + ออกจากกลุ่ม
   • idle       : บัญชีธนาคาร + อัปโหลดหลักฐาน + ลิงก์ออกจากกลุ่ม
   • verifying  : "กำลังตรวจสอบหลักฐาน" + ปุ่มจำลองโฮสต์อนุมัติ
   • verified   : ผล "ตรวจสอบหลักฐานเรียบร้อยแล้ว"
   • leave      : ยืนยัน → ผล "ส่งคำขอออกจากกลุ่มสำเร็จ" + ข้อมูลการขอยกเลิก
   ===================================================================== */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../ui';
import {
  MIcon, BankInfoCard, SlipUploader, BottomSheet, ConfirmBody, ResultOverlay,
} from './MemberUI';
import { activeGroup } from '../memberMock';

type Phase = 'idle' | 'verifying';
type PayStatus = 'due' | 'paid' | 'waived';

const STATUS_LABEL: Record<PayStatus, string> = {
  due: 'ค้างชำระ', paid: 'ชำระแล้ว', waived: 'ไม่ต้องจ่าย',
};

export default function MemberGroup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [phase, setPhase] = useState<Phase>(params.get('state') === 'verifying' ? 'verifying' : 'idle');
  const [payStatus, setPayStatus] = useState<PayStatus>('due');
  const [slip, setSlip] = useState<File | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [verifiedOpen, setVerifiedOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveDone, setLeaveDone] = useState(false);

  useEffect(() => {
    if (params.get('state') === 'verified') { setPayStatus('paid'); setVerifiedOpen(true); }
    if (params.get('leave') === '1') setLeaveConfirm(true);
  }, [params]);

  const member = activeGroup.members[0];

  const submitProof = () => {
    if (!slip && phase === 'idle') return;
    if (slip && slip.type.startsWith('image/')) setSlipUrl(URL.createObjectURL(slip));
    setPhase('verifying');
  };
  const hostApprove = () => { setPayStatus('paid'); setVerifiedOpen(true); };
  const doLeave = () => {
    setLeaveConfirm(false);
    setPayStatus('waived');
    setTimeout(() => setLeaveDone(true), 250);
  };

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/groups')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>รายละเอียดกลุ่ม</h1>
      </header>

      <main className="mscreen">
        {/* หัวการ์ดกลุ่ม */}
        <div className="mghero">
          <div className="mghero-top">
            <span className="mghero-logo">{activeGroup.serviceLabel.charAt(0).toUpperCase()}</span>
            <div>
              <h2>{activeGroup.serviceLabel}</h2>
              <span className="activebadge"><i />{activeGroup.status}</span>
            </div>
          </div>
          <div className="mghero-price">
            <div className="k">TOTAL MONTHLY PRICE</div>
            <div className="v"><b>{activeGroup.totalMonthlyPrice}</b><span>{activeGroup.currency}</span></div>
          </div>
        </div>

        {/* แถวสมาชิก (ของฉัน) */}
        <div className="mrow">
          <div className="mrow-l">
            <span className="mrow-av">{member.name.slice(-1)}</span>
            <div>
              <b>{member.name}</b>
              <span>{member.subtitle}</span>
            </div>
          </div>
          <span className={'mstatus ' + payStatus}>{STATUS_LABEL[payStatus]}</span>
        </div>

        {phase === 'idle' ? (
          <>
            {/* บัญชีธนาคาร */}
            <BankInfoCard />

            {/* อัปโหลดหลักฐาน */}
            <div className="verify" style={{ paddingTop: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: 20 }}>ส่งหลักฐานของคุณ</h2>
                <p className="sub" style={{ marginTop: 4 }}>กรุณาแนบรูปภาพสลิปธนาคารที่เห็นยอดเงินและวันที่ชัดเจน</p>
              </div>
              <div style={{ marginTop: 16 }}>
                <SlipUploader onChange={setSlip} />
              </div>
            </div>

            <button className="mbtn green" disabled={!slip} onClick={submitProof}>
              {MIcon.shield}ยืนยันการส่งหลักฐาน
            </button>
            <button className="mghost" onClick={() => setCancelConfirm(true)}>{MIcon.x}ยกเลิก</button>

            <button className="mleave" onClick={() => setLeaveConfirm(true)}>
              แจ้งความประสงค์ออกจากกลุ่ม คลิกที่นี่{MIcon.chevron}
            </button>
          </>
        ) : (
          <>
            {/* กำลังตรวจสอบหลักฐาน */}
            <div className="verify">
              <h2>กำลังตรวจสอบหลักฐาน</h2>
              <p className="sub">โฮสต์กำลังตรวจสอบสลิปของคุณ ระบบจะแจ้งเตือนเมื่อได้รับการอนุมัติ</p>
              <div className="verify-slip">
                <span className="verify-badge">UPLOADED SLIP</span>
                <div className="verify-img">
                  {slipUrl
                    ? <img src={slipUrl} alt="สลิป" />
                    : <span className="ph">{MIcon.imgph}ตัวอย่างสลิปที่อัปโหลด</span>}
                </div>
                <div className="verify-foot">
                  <span className="pulse" />
                  <span>รอโฮสต์ยืนยัน... (สถานะ: กำลังตรวจสอบ)</span>
                </div>
              </div>
              <button className="verify-sim" onClick={hostApprove}>▶︎ จำลอง: โฮสต์อนุมัติการชำระเงิน</button>
            </div>

            <button className="mleave" onClick={() => setLeaveConfirm(true)}>
              แจ้งความประสงค์ออกจากกลุ่ม คลิกที่นี่{MIcon.chevron}
            </button>
          </>
        )}
      </main>

      {/* ยืนยันยกเลิกการส่งหลักฐาน */}
      <BottomSheet open={cancelConfirm} onClose={() => setCancelConfirm(false)}>
        <ConfirmBody
          tone="neutral"
          title="ยกเลิกการส่งหลักฐาน?"
          message="ไฟล์สลิปที่แนบไว้จะถูกล้าง คุณสามารถอัปโหลดใหม่ได้ภายหลัง"
          confirmLabel="ยืนยันยกเลิก"
          onConfirm={() => { setSlip(null); setCancelConfirm(false); }}
          onCancel={() => setCancelConfirm(false)}
        />
      </BottomSheet>

      {/* ยืนยันการออกจากกลุ่ม */}
      <BottomSheet open={leaveConfirm} onClose={() => setLeaveConfirm(false)}>
        <ConfirmBody
          tone="danger"
          title="ยืนยันการออกจากกลุ่ม?"
          message="เมื่อออกจากกลุ่ม คุณจะไม่สามารถใช้บริการต่อได้หลังสิ้นสุดรอบบิลปัจจุบัน และเงินประกันจะเป็นไปตามนโยบายของกลุ่ม"
          confirmLabel="ออกจากกลุ่ม"
          onConfirm={doLeave}
          onCancel={() => setLeaveConfirm(false)}
        />
      </BottomSheet>

      {/* ผล: ตรวจสอบหลักฐานเรียบร้อยแล้ว */}
      <ResultOverlay
        open={verifiedOpen}
        variant="success"
        title="ตรวจสอบหลักฐานเรียบร้อยแล้ว"
        message="ระบบอัปเดตสถานะการจ่ายเงินของคุณเรียบร้อยแล้ว ขอบคุณที่ชำระตรงเวลา"
        action={{ label: 'เยี่ยมเลย', onClick: () => setVerifiedOpen(false) }}
        onClose={() => setVerifiedOpen(false)}
      />

      {/* ผล: ส่งคำขอออกจากกลุ่มสำเร็จ */}
      <ResultOverlay
        open={leaveDone}
        variant="success"
        title="ส่งคำขอออกจากกลุ่มสำเร็จ"
        message="ระบบได้อัปเดตสถานะของคุณเรียบร้อยแล้ว คุณยังคงสามารถใช้งานได้จนถึงวันสิ้นสุดรอบบิลปัจจุบัน"
        action={{ label: 'กลับหน้าหลัก', onClick: () => navigate('/service') }}
        onClose={() => setLeaveDone(false)}
      >
        <div className="leaveinfo">
          <b className="h">ข้อมูลการขอยกเลิก</b>
          <div className="leaverow"><span className="k">บริการ</span><span className="v">Disney+</span></div>
          <div className="leaverow"><span className="k">วันที่มีผล</span><span className="v">{activeGroup.leaveEffectiveDate}</span></div>
          <div className="leaverow"><span className="k">สถานะ</span><span className="v muted">ไม่ต้องจ่าย</span></div>
          <div className="leavewarn">{MIcon.warn}ระบบจะไม่คืนเงินประกันตามนโยบายของกลุ่ม กรุณาติดต่อโฮสต์โดยตรงหากมีข้อสงสัย</div>
        </div>
      </ResultOverlay>
    </div>
  );
}
