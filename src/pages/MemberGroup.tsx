/* =====================================================================
   SubSub · กลุ่มที่เข้าร่วม (Member) · pages/MemberGroup.tsx
   ---------------------------------------------------------------------
   หน้ารายละเอียดกลุ่มฝั่งสมาชิก (อ่านจาก DB จริงด้วย group id)
   สถานะ derive จาก payment ล่าสุดใน DB → คงอยู่ข้ามการรีเฟรช
     • pending  (รออนุมัติ)  : รอโฮสต์ตรวจสลิป — ยกเลิกการส่งหลักฐานได้ (กลับไปแก้รูป)
     • rejected (ถูกปฏิเสธ)  : เลือกได้ 2 ทาง — ส่งสลิปใหม่ / ยกเลิกการสมัครเข้ากลุ่ม
     • joined   (เข้าร่วมแล้ว): รายชื่อสมาชิก (จ่ายแล้ว/ยังไม่จ่าย) · ส่งสลิปเมื่อ ≤3 วัน
       (กำลังตรวจสอบ → ยกเลิกการส่งหลักฐานได้) · ปุ่มประสงค์ออกกลุ่ม
   ===================================================================== */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB, priceInfo, dueCountdown } from '../db';
import type { GroupDetail, BillingInfo, Category } from '../types';
import { Icon, useToast, NavBar, baht, CATEGORY_ICON } from '../ui';
import {
  MIcon, BankInfoCard, SlipUploader, BottomSheet, ConfirmBody, ResultOverlay, validateSlip, compressImage,
} from './MemberUI';

/* สีพื้นไอคอนหมวดหมู่ (ตามหมวดที่เลือกตอนสร้างกลุ่ม) */
const CAT_COLOR: Record<Category, string> = {
  Entertainment: '#EDE7FF', Music: '#FDE7F0', Productivity: '#E4F0FF', Other: '#EAF6EB',
};

const initial = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] || name || '?';
  return last.charAt(0).toUpperCase();
};

/* avatar: ใช้รูปโปรไฟล์ LINE (pic_user) ถ้ามี ไม่มีก็ตัวอักษรกลางวง */
function Avatar({ name, pic }: { name: string; pic?: string }) {
  return <span className="mrow-av">{pic ? <img src={pic} alt={name} /> : initial(name)}</span>;
}

export default function MemberGroup() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [gid, setGid] = useState<string>('');
  const [g, setG] = useState<GroupDetail | null>(null);
  const [bill, setBill] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [slip, setSlip] = useState<File | null>(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveDone, setLeaveDone] = useState(false);

  const reload = useCallback(async (targetId: string) => {
    setG(await DB.getGroup(targetId));
    setBill(DB.billingInfo(targetId));
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      let target = routeId || '';
      if (!target) {
        const mine = await DB.getMemberGroups();
        target = mine[0]?.group_id || '';
      }
      setGid(target);
      if (target) await reload(target); else setLoading(false);
    })();
  }, [routeId, reload]);

  if (loading) {
    return <div className="phone"><main className="mscreen"><div className="skel" style={{ height: 160, marginTop: 20 }} /></main></div>;
  }
  if (!g || !gid) {
    return (
      <div className="phone">
        <header className="topbar">
          <button className="back" onClick={() => navigate('/groups')} aria-label="ย้อนกลับ">{Icon.back}</button>
          <h1>รายละเอียดกลุ่ม</h1>
        </header>
        <main className="mscreen">
          <div className="empty" style={{ minHeight: 240 }}><p>ยังไม่พบกลุ่มที่คุณเข้าร่วม</p></div>
        </main>
        <NavBar current="group" />
      </div>
    );
  }

  const me = DB.me();
  const meActive = g.members.find(m => m.user_id === me.user_id);
  const mePending = g.requests.find(m => m.user_id === me.user_id);
  const isPending = !meActive && !!mePending;

  const payStatus = DB.myPaymentStatus(gid);   // 'Verified' | 'Waiting' | 'Rejected' | null
  const waiting = payStatus === 'Waiting';
  const rejected = payStatus === 'Rejected';
  const isLeaving = !!meActive?.leaving;
  const leaveEff = DB.myLeaveEffective(gid);
  const oweFull = DB.myOweFull(gid);
  const cardState: 'pending' | 'rejected' | 'joined' | 'leaving' =
    meActive ? (isLeaving ? 'leaving' : 'joined') : (rejected ? 'rejected' : 'pending');
  const STATE_LABEL = { pending: 'รออนุมัติ', rejected: 'ถูกปฏิเสธ', joined: 'เข้าร่วมแล้ว', leaving: 'กำลังจะออก' } as const;
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

  const info = priceInfo(g);
  const slots = Math.max(1, info.slotsNow);
  const share = info.now / slots;
  const seatsUsed = g.members.filter(m => m.status === 'Active').length;

  const myPaid = meActive ? DB.paidCurrentCycle(gid) : false;   // จ่ายรอบบิลปัจจุบันแล้ว (กันส่งซ้ำ; เปิดใหม่รอบหน้าเอง)
  const latestSlip = DB.myLatestSlip(gid);
  const days = bill ? bill.days_until : 99;
  const canUpload = days <= 3;
  const dc = dueCountdown(g.billing_date);   // ข้อความครบกำหนดมาตรฐานเดียว

  /* ---------- actions ---------- */
  const hostApproveSim = async () => {
    await DB.approvePayment(gid, me.user_id);
    await reload(gid);
    show('โฮสต์อนุมัติแล้ว — คุณเป็นสมาชิกของกลุ่มเรียบร้อย');
  };
  const hostRejectSim = async () => {
    await DB.rejectPayment(gid, me.user_id, 'ยอดเงินไม่ตรง');
    await reload(gid);
    show('โฮสต์ปฏิเสธสลิป — กรุณาส่งหลักฐานใหม่');
  };
  const submitSlip = async () => {
    const v = validateSlip(slip);
    if (!v.ok) { show(v.reason || 'ไฟล์ไม่ถูกต้อง'); return; }
    const dataUrl = slip ? await compressImage(slip) : '';
    DB.submitMemberSlip(gid, dataUrl);
    setSlip(null);
    await reload(gid);
    show('ส่งหลักฐานแล้ว — รอโฮสต์ตรวจสอบ');
  };
  const cancelSlip = async () => {
    DB.cancelSlip(gid);
    setSlip(null);
    await reload(gid);
    show('ยกเลิกการส่งหลักฐานแล้ว — อัปโหลดสลิปใหม่ได้เลย');
  };
  const cancelJoin = async () => {
    DB.cancelJoin(gid);
    show('ยกเลิกการสมัครเข้ากลุ่มแล้ว');
    setTimeout(() => navigate('/groups'), 400);
  };
  const doLeave = async () => {
    setLeaveConfirm(false);
    await DB.requestLeave(gid, me.user_id);
    await reload(gid);
    setTimeout(() => setLeaveDone(true), 200);
  };
  const cancelLeave = async () => {
    await DB.cancelLeave(gid, me.user_id);
    await reload(gid);
    show('ยกเลิกคำขอออกแล้ว — คุณยังเป็นสมาชิกกลุ่มตามปกติ');
  };
  /* [DEV] จำลองโฮสต์กด "ขึ้นรอบบิลใหม่" → archive payment เก่า → สถานะจ่ายเงินรีเซ็ตทั้งกลุ่ม */
  const newCycleSim = async () => {
    await DB.startNewCycle(gid);
    await reload(gid);
    show('โฮสต์ขึ้นรอบบิลใหม่แล้ว — สถานะจ่ายเงินรีเซ็ต ต้องชำระรอบใหม่');
  };


  const uploaderBlock = (
    <>
      <div style={{ marginTop: 16 }}><SlipUploader key={payStatus || 'new'} onChange={setSlip} /></div>
      <button className="mbtn green" disabled={!slip} onClick={submitSlip}>
        {MIcon.shield}ยืนยันการส่งหลักฐาน
      </button>
    </>
  );

  const waitingBlock = (
    <>
      <div className="verify-slip" style={{ marginTop: 16 }}>
        <span className="verify-badge">UPLOADED SLIP</span>
        <div className="verify-img">
          {latestSlip ? <img src={latestSlip} alt="สลิป" /> : <span className="ph">{MIcon.imgph}สลิปที่อัปโหลด</span>}
        </div>
      </div>
      {/* แก้ไขการส่งหลักฐาน → ลบสลิปเดิม แล้วเลือก/เพิ่มรูปใหม่ (ข้อ 1.3) */}
      <button className="mcancel" onClick={cancelSlip}>{Icon.edit}แก้ไขการส่งหลักฐาน</button>
    </>
  );

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/groups')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>รายละเอียดกลุ่ม</h1>
      </header>

      <main className="mscreen">
        {/* หัวการ์ดกลุ่ม: ไอคอนหมวดหมู่ + ราคาเต็ม + ราคาหาร + สถานะ */}
        <div className="mghero">
          <div className="mghero-top">
            <span className="mghero-logo" style={{ background: CAT_COLOR[g.category], fontSize: 30 }}>
              {CATEGORY_ICON[g.category] || '📦'}
            </span>
            <div>
              <h2>{g.service_name}</h2>
              <span className={'mgbadge ' + cardState}><i />{STATE_LABEL[cardState]}</span>
            </div>
          </div>
          <div className="mgprice2">
            <div className="col">
              <div className="k">ราคาเต็ม/เดือน</div>
              <div className="full">{baht(info.now)} <span>บาท</span></div>
            </div>
            <div className="col hi">
              <div className="k">ยอดที่คุณต้องจ่าย (หาร {slots} คน)</div>
              <div className="v"><b>{baht(share)}</b><span>บาท</span></div>
            </div>
          </div>
        </div>

        {isPending ? (
          /* ================= แรกเข้า (ยังไม่อนุมัติ) ================= */
          <>
            <div className="verify">
              {rejected ? (
                /* ถูกปฏิเสธ → 2 ทางเลือก: ส่งสลิปใหม่ / ยกเลิกการสมัคร (ไม่ขึ้นข้อความปฏิเสธ) */
                <>
                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: 20 }}>ส่งหลักฐานของคุณอีกครั้ง</h2>
                    <p className="sub" style={{ marginTop: 4 }}>กรุณาแนบรูปภาพสลิปธนาคารที่เห็นยอดเงินและวันที่ชัดเจน</p>
                  </div>
                  {uploaderBlock}
                  <button className="mcancel danger" onClick={cancelJoin}>{MIcon.logout}ยกเลิกการสมัครเข้ากลุ่ม</button>
                </>
              ) : waiting ? (
                <>
                  <h2>รอการอนุมัติจากโฮสต์</h2>
                  <p className="sub">โฮสต์กำลังตรวจสอบสลิปของคุณ ระบบจะแจ้งเตือนเมื่อได้รับการอนุมัติ</p>
                  {waitingBlock}
                  {import.meta.env.DEV && (
                    <div className="simrow">
                      <button className="verify-sim" onClick={hostApproveSim}>▶︎ จำลอง: โฮสต์อนุมัติ</button>
                      <button className="verify-sim reject" onClick={hostRejectSim}>▶︎ จำลอง: โฮสต์ปฏิเสธ</button>
                    </div>
                  )}
                </>
              ) : (
                /* ยกเลิกสลิปแล้ว (ยังอยู่ในคำขอ) → อัปโหลดใหม่ */
                <>
                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: 20 }}>ส่งหลักฐานของคุณ</h2>
                    <p className="sub" style={{ marginTop: 4 }}>กรุณาแนบรูปภาพสลิปธนาคารที่เห็นยอดเงินและวันที่ชัดเจน</p>
                  </div>
                  {uploaderBlock}
                </>
              )}
            </div>

          </>
        ) : (
          /* ================= อนุมัติแล้ว (สมาชิก) ================= */
          <>
            <div className="msechead">สมาชิก (Members) {seatsUsed}/{g.max_slots}</div>
            <div className="mroster">
            {g.members.map(m => {
              // จ่ายรอบนี้แล้ว หรือ (ยังไม่ถึงช่วงเก็บเงิน + เคยจ่าย/settled) → ถือว่า "จ่ายแล้ว"
              const paid = m.role === 'Host' || m.leaving
                || DB.paidCurrentCycleFor(gid, m.user_id)
                || (!canUpload && DB.isSettled(gid, m.user_id));
              const isMe = m.user_id === me.user_id;
              return (
                <div className="mrow" key={m.member_id}>
                  <div className="mrow-l">
                    <Avatar name={m.user.display_name} pic={m.user.pic_user} />
                    <div>
                      <b>{m.user.display_name}{isMe ? ' (คุณ)' : ''}</b>
                      <span className="mrole">{m.role === 'Host' ? 'Host' : isMe ? 'Me' : 'Member'}</span>
                    </div>
                  </div>
                  <span className={'mstatus ' + (paid ? 'paid' : 'due')}>{paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}</span>
                </div>
              );
            })}
            </div>

            <BankInfoCard />

            {isLeaving ? (
              /* ================= กำลังจะออก (leaving) ================= */
              <>
                <div className="mdue leave">
                  <div className="mdue-top">{Icon.cal}<span>คุณแจ้งประสงค์ออกจากกลุ่มแล้ว</span></div>
                  <span className="mdue-sub">
                    ใช้งานได้ถึง {fmtDate(leaveEff)} · รอบสุดท้ายนี้ไม่ต้องชำระเพิ่ม ระบบนำเงินประกันที่คุณวางไว้ตอนแรกเข้ามาครอบคลุมให้เรียบร้อยแล้ว
                  </span>
                </div>
                <button className="mcancel" onClick={cancelLeave}>{Icon.back}ยกเลิกคำขอออก — อยู่กลุ่มต่อ</button>
              </>
            ) : (
              /* ================= สมาชิกปกติ (joined) ================= */
              <>
                {bill && (
                  <div className={'mdue flat' + (dc.urgent ? ' urgent' : '')}>
                    <div className="mdue-top">{Icon.cal}<span>{dc.text}</span></div>
                    {canUpload && !waiting && !rejected && !myPaid && (
                      <span className="mdue-sub">สามารถอัปโหลดสลิปชำระเงินในรอบถัดไปได้เลย</span>
                    )}
                  </div>
                )}

                {myPaid && !waiting && !rejected ? (
                  /* จ่ายรอบนี้แล้ว → ปิดการส่งสลิปซ้ำ (req 1) เปิดใหม่รอบถัดไปช่วง ≤3 วัน */
                  <div className="mpaidbox">
                    <div className="mpaidbox-row">
                      <span className="mpaidbox-ic">{MIcon.check}</span>
                      <b>ชำระรอบนี้เรียบร้อยแล้ว</b>
                    </div>
                    <span className="mpaidbox-note">ระบบจะเปิดให้ส่งสลิปรอบถัดไปช่วง 3 วันก่อนวันครบกำหนด</span>
                    {latestSlip && (
                      <div className="mpaidbox-slip">
                        <span className="tag">สลิปที่ส่งไปแล้ว</span>
                        <img src={latestSlip} alt="สลิปที่ส่งไปแล้ว" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="verify" style={{ paddingTop: 18 }}>
                    <div style={{ textAlign: 'center' }}>
                      <h2 style={{ fontSize: 20 }}>ส่งหลักฐานการชำระเงิน</h2>
                      <p className="sub" style={{ marginTop: 4 }}>
                        {waiting
                          ? 'ส่งสลิปแล้ว — รอโฮสต์ตรวจสอบ'
                          : rejected
                            ? 'กรุณาแนบสลิปใหม่เพื่อยืนยันการโอนอีกครั้ง'
                            : canUpload
                              ? (oweFull ? 'รอบนี้ชำระเต็ม (ค่าบริการ + เติมเงินประกัน) แนบสลิปได้เลย' : 'ใกล้ถึงรอบชำระแล้ว แนบสลิปเพื่อยืนยันการโอนได้เลย')
                              : 'ยังไม่ถึงกำหนดชำระ ระบบจะเปิดให้ส่งสลิปเมื่อเหลือ ≤ 3 วัน'}
                      </p>
                    </div>

                    {oweFull && !waiting && (
                      <div className="mowe">{MIcon.warn}รอบถัดไปต้องชำระเต็ม (ค่าบริการ + เติมเงินประกันคืน) เนื่องจากยกเลิกคำขอออกหลังใช้เงินประกันไปแล้ว</div>
                    )}

                    {waiting ? (
                      waitingBlock
                    ) : (rejected || canUpload) ? (
                      uploaderBlock
                    ) : (
                      <div className="sliplocked" style={{ marginTop: 16 }} aria-disabled="true">
                        <div className="lockhead">{MIcon.upload}<span>ยังไม่ถึงกำหนดส่งสลิป</span></div>
                        {latestSlip
                          ? <div className="lockslip"><img src={latestSlip} alt="สลิปล่าสุด" /><span>สลิปเดือนล่าสุด</span></div>
                          : <div className="lockph">{MIcon.imgph}ยังไม่มีสลิปล่าสุด</div>}
                      </div>
                    )}
                  </div>
                )}

                <button className="mleave" onClick={() => setLeaveConfirm(true)}>
                  แจ้งความประสงค์ออกจากกลุ่ม คลิกที่นี่{MIcon.chevron}
                </button>

                {import.meta.env.DEV && (
                  <div className="simrow" style={{ marginTop: 12 }}>
                    <button className="verify-sim" onClick={newCycleSim}>▶︎ จำลอง: โฮสต์ขึ้นรอบบิลใหม่</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <BottomSheet open={leaveConfirm} onClose={() => setLeaveConfirm(false)}>
        <ConfirmBody
          tone="danger"
          title="ยืนยันการออกจากกลุ่ม?"
          message="เมื่อออกจากกลุ่ม คุณจะยังใช้บริการได้จนสิ้นสุดรอบบิลปัจจุบัน จากนั้นระบบจะนำคุณออกอัตโนมัติ และเงินประกันเป็นไปตามนโยบายของกลุ่ม"
          confirmLabel="แจ้งออกจากกลุ่ม"
          onConfirm={doLeave}
          onCancel={() => setLeaveConfirm(false)}
        />
      </BottomSheet>

      <ResultOverlay
        open={leaveDone}
        variant="success"
        title="แจ้งประสงค์ออกจากกลุ่มแล้ว"
        message="ระบบแจ้งโฮสต์เรียบร้อยแล้ว คุณยังใช้งานได้จนถึงวันมีผล และรอบสุดท้ายใช้เงินประกันครอบคลุมให้"
        action={{ label: 'รับทราบ', onClick: () => setLeaveDone(false) }}
        onClose={() => setLeaveDone(false)}
      />

      <NavBar current="group" />
      {toast}
    </div>
  );
}
