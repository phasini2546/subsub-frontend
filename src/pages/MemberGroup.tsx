/* =====================================================================
   SubSub · กลุ่มที่เข้าร่วม (Member) · pages/MemberGroup.tsx
   ---------------------------------------------------------------------
   หน้ารายละเอียดกลุ่มฝั่งสมาชิก — สถานะทั้งหมดมาจาก DB.myBill() (lib/billing.ts)
   ซึ่งเป็นฟังก์ชันเดียวกับที่หน้า Host ใช้ → สองฝั่งเห็นตรงกันเสมอ [B5]
     • pending  : แรกเข้า รอโฮสต์ตรวจสลิป (จองที่นั่งแล้ว) — แก้สลิป/ยกเลิกคำขอได้
     • window   : 3 วันก่อนครบกำหนด → ส่งสลิปรอบใหม่ล่วงหน้าได้          [B3]
     • due      : ถึงกำหนด (D0–D+4) ยังไม่จ่าย → ส่งสลิปได้
     • overdue  : ค้างชำระ (D+5–D+9) → การ์ดนับถอยหลัง + Pop-up ทันที   [B2]
     • settled  : จ่ายรอบนี้แล้ว → ล็อกการส่งซ้ำ เปิดใหม่ 3 วันก่อนรอบหน้า
     • leaving  : แจ้งออกแล้ว ใช้งานได้ถึงบิลรอบหน้า                     [B13]
     • ถูกนำออก : แสดงเหตุผล (ค้างชำระ/โฮสต์นำออก/ครบกำหนดออก)
   ===================================================================== */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB, priceInfo, dueText } from '../db';
import type { GroupDetail, BillStatus, Category } from '../types';
import { Icon, useToast, NavBar, baht, CATEGORY_ICON } from '../ui';
import { todayTH } from '../lib/clock';
import { fmtDateTH, fmtDateTimeTH } from '../lib/date';
import { DevPanels } from '../dev';
import {
  MIcon, BankInfoCard, SlipUploader, BottomSheet, ConfirmBody, ResultOverlay, KickCountdown,
  validateSlip, compressImage, th2,
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

type CardState = 'pending' | 'rejected' | 'joined' | 'due' | 'overdue' | 'leaving';
const STATE_LABEL: Record<CardState, string> = {
  pending: 'รออนุมัติ', rejected: 'ถูกปฏิเสธ', joined: 'เข้าร่วมแล้ว',
  due: 'ยังไม่ชำระ', overdue: 'ค้างชำระ', leaving: 'แจ้งออกแล้ว',
};
const LEFT_REASON: Record<string, string> = {
  overdue: 'ค้างชำระเกิน 10 วัน ระบบจึงนำคุณออกจากกลุ่มอัตโนมัติ',
  host: 'โฮสต์นำคุณออกจากกลุ่ม',
  left: 'ครบกำหนดตามที่คุณแจ้งประสงค์ออกจากกลุ่ม',
  closed: 'โฮสต์ปิดกลุ่มนี้แล้ว',
  cancelled: 'คุณยกเลิกคำขอเข้าร่วมกลุ่มนี้แล้ว',
};

export default function MemberGroup() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [gid, setGid] = useState<string>('');
  const [g, setG] = useState<GroupDetail | null>(null);
  const [bill, setBill] = useState<BillStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [slip, setSlip] = useState<File | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveDone, setLeaveDone] = useState<string | null>(null);
  const [overduePopup, setOverduePopup] = useState(false);

  const reload = useCallback(async (targetId: string) => {
    const detail = await DB.getGroup(targetId);
    const b = DB.myBill(targetId);
    setG(detail);
    setBill(b);
    setLoading(false);
    return b;
  }, []);

  useEffect(() => {
    (async () => {
      let target = routeId || '';
      if (!target) {
        const mine = await DB.getMemberGroups();
        target = mine[0]?.group_id || '';
      }
      setGid(target);
      if (!target) { setLoading(false); return; }
      const b = await reload(target);
      // [B2] เข้าหน้ากลุ่มขณะค้างชำระ → Pop-up เตือนให้จ่ายทันที
      if (b?.phase === 'overdue') setOverduePopup(true);
    })();
  }, [routeId, reload]);

  if (loading) {
    return <div className="phone"><main className="mscreen"><div className="skel" style={{ height: 160, marginTop: 20 }} /></main></div>;
  }

  const ended = gid ? DB.myMembershipEnd(gid) : null;
  if (!g || !gid || !bill) {
    return (
      <div className="phone">
        <header className="topbar">
          <button className="back" onClick={() => navigate('/groups')} aria-label="ย้อนกลับ">{Icon.back}</button>
          <h1>รายละเอียดกลุ่ม</h1>
        </header>
        <main className="mscreen">
          {ended ? (
            <div className="mdue over" style={{ marginTop: 24 }}>
              <div className="mdue-top">{MIcon.alert}<span>คุณไม่ได้เป็นสมาชิกกลุ่มนี้แล้ว</span></div>
              <span className="mdue-sub">
                {LEFT_REASON[ended.reason] ?? 'คุณออกจากกลุ่มแล้ว'} · มีผล {fmtDateTH(ended.date)}
                {ended.depositForfeited ? ' · เงินประกันถูกใช้เป็นค่าบริการรอบที่ค้าง' : ''}
              </span>
            </div>
          ) : (
            <div className="empty" style={{ minHeight: 240 }}><p>ยังไม่พบกลุ่มที่คุณเข้าร่วม</p></div>
          )}
        </main>
        <NavBar current="group" />
        {toast}
      </div>
    );
  }

  const me = DB.me();
  const today = todayTH();
  const isPending = bill.phase === 'pending';
  const waiting = bill.slip === 'Waiting';
  const rejected = bill.slip === 'Rejected';
  const isLeaving = !!g.members.find(m => m.user_id === me.user_id)?.leaving;
  const oweFull = DB.myOweFull(gid);
  const reminder = DB.myReminder(gid);
  const latestSlip = DB.myLatestSlip(gid);

  const cardState: CardState =
    isPending ? (rejected ? 'rejected' : 'pending')
      : bill.phase === 'overdue' ? 'overdue'
        : bill.phase === 'due' ? 'due'
          : isLeaving ? 'leaving' : 'joined';

  const info = priceInfo(g, today);
  const slots = Math.max(1, info.slotsNow);
  const share = info.now / slots;

  /* ---------- actions (กันกดซ้ำด้วย busy) ---------- */
  const guard = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const submitSlip = () => guard(async () => {
    const v = validateSlip(slip);
    if (!v.ok) { show(v.reason || 'ไฟล์ไม่ถูกต้อง'); return; }
    const dataUrl = slip ? await compressImage(slip) : '';
    if (!dataUrl) { show('อ่านรูปสลิปไม่ได้ กรุณาเลือกรูป JPG/PNG ใหม่'); return; }
    const r = DB.submitMemberSlip(gid, dataUrl);
    setSlip(null); setUploaderKey(k => k + 1);
    await reload(gid);
    show(r === 'ok' ? 'ส่งหลักฐานแล้ว — รอโฮสต์ตรวจสอบ' : 'ตอนนี้ยังส่งสลิปไม่ได้ (ยังไม่ถึงช่วงชำระ หรือมีสลิปรอตรวจอยู่)');
  });
  const cancelSlip = () => guard(async () => {
    DB.cancelSlip(gid);
    setSlip(null); setUploaderKey(k => k + 1);
    await reload(gid);
    show('ยกเลิกการส่งหลักฐานแล้ว — อัปโหลดสลิปใหม่ได้เลย');
  });
  const cancelJoin = () => guard(async () => {
    DB.cancelJoin(gid);
    show('ยกเลิกคำขอเข้ากลุ่มแล้ว — ปล่อยที่นั่งคืนให้กลุ่ม');
    setTimeout(() => navigate('/groups'), 400);
  });
  const doLeave = () => guard(async () => {
    setLeaveConfirm(false);
    const plan = await DB.requestLeave(gid, me.user_id);
    await reload(gid);
    if (plan) setTimeout(() => setLeaveDone(plan.effective), 200);
  });
  const cancelLeave = () => guard(async () => {
    const r = await DB.cancelLeave(gid, me.user_id);
    await reload(gid);
    show(r.oweFull
      ? 'ยกเลิกการแจ้งออกแล้ว — รอบถัดไปต้องชำระค่าบริการ + เติมเงินประกันคืน'
      : 'ยกเลิกการแจ้งออกแล้ว — คุณยังเป็นสมาชิกกลุ่มตามปกติ');
  });
  const scrollToUpload = () => {
    setOverduePopup(false);
    setTimeout(() => document.getElementById('slip-upload')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  /* ---------- blocks ---------- */
  const uploaderBlock = (
    <div id="slip-upload">
      <div style={{ marginTop: 16 }}><SlipUploader key={uploaderKey} onChange={setSlip} /></div>
      <button className="mbtn green" disabled={!slip || busy} onClick={submitSlip}>
        {MIcon.shield}ยืนยันการส่งหลักฐาน {bill.amount > 0 ? `(${th2(bill.amount)} บาท)` : ''}
      </button>
    </div>
  );

  const waitingBlock = (
    <>
      <div className="verify-slip" style={{ marginTop: 16 }}>
        <span className="verify-badge">UPLOADED SLIP</span>
        <div className="verify-img">
          {latestSlip ? <img src={latestSlip} alt="สลิป" /> : <span className="ph">{MIcon.imgph}สลิปที่อัปโหลด</span>}
        </div>
      </div>
      <button className="mcancel" onClick={cancelSlip} disabled={busy}>{Icon.edit}แก้ไขการส่งหลักฐาน</button>
    </>
  );

  const rejectNote = rejected && bill.payment?._reject_reason ? (
    <div className="mowe">{MIcon.warn}โฮสต์ปฏิเสธสลิปล่าสุด: “{bill.payment._reject_reason}” กรุณาส่งสลิปใหม่</div>
  ) : null;

  /* ข้อความสถานะการชำระ (ใต้ State) */
  const dueCard = (() => {
    if (bill.phase === 'overdue') {
      return <KickCountdown daysLate={bill.daysLate} kickInDays={bill.kickInDays}
        kickDate={bill.kickDate ? fmtDateTH(bill.kickDate, { year: false }) : null} waiting={waiting} />;
    }
    if (bill.daysUntilDue === null) return null;
    const dt = dueText(bill.daysUntilDue);
    return (
      <div className={'mdue flat' + (dt.urgent ? ' urgent' : '')}>
        <div className="mdue-top">{Icon.cal}<span>{dt.text}{bill.dueDate ? ` (${fmtDateTH(bill.dueDate, { year: false })})` : ''}</span></div>
        {bill.phase === 'due' && bill.kickInDays !== null && (
          <span className="mdue-sub">หากเลยกำหนด 5 วันจะเป็น “ค้างชำระ” และครบ 10 วันจะถูกนำออกจากกลุ่ม ({fmtDateTH(bill.kickDate, { year: false })})</span>
        )}
        {bill.phase === 'window' && !waiting && (
          <span className="mdue-sub">ส่งสลิปของรอบใหม่ล่วงหน้าได้แล้ว</span>
        )}
      </div>
    );
  })();

  const payable = bill.phase === 'window' || bill.phase === 'due' || bill.phase === 'overdue';

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
              <div className="k">ราคาเต็ม/รอบ</div>
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
          <div className="verify">
            {rejected ? (
              <>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: 20 }}>ส่งหลักฐานของคุณอีกครั้ง</h2>
                  <p className="sub" style={{ marginTop: 4 }}>กรุณาแนบรูปภาพสลิปธนาคารที่เห็นยอดเงินและวันที่ชัดเจน</p>
                </div>
                {rejectNote}
                <BankInfoCard bankDT={g.bankDT} />
                {uploaderBlock}
                <button className="mcancel danger" onClick={cancelJoin} disabled={busy}>{MIcon.logout}ยกเลิกการสมัครเข้ากลุ่ม</button>
              </>
            ) : waiting ? (
              <>
                <h2>รอการอนุมัติจากโฮสต์</h2>
                <p className="sub">โฮสต์กำลังตรวจสอบสลิปของคุณ — ที่นั่งของคุณถูกจองไว้แล้ว</p>
                {waitingBlock}
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: 20 }}>ส่งหลักฐานของคุณ</h2>
                  <p className="sub" style={{ marginTop: 4 }}>กรุณาแนบรูปภาพสลิปธนาคารที่เห็นยอดเงินและวันที่ชัดเจน</p>
                </div>
                <BankInfoCard bankDT={g.bankDT} />
                {uploaderBlock}
                <button className="mcancel danger" onClick={cancelJoin} disabled={busy}>{MIcon.logout}ยกเลิกการสมัครเข้ากลุ่ม</button>
              </>
            )}
          </div>
        ) : (
          /* ================= อนุมัติแล้ว (สมาชิก) ================= */
          <>
            {dueCard}

            {reminder && payable && !waiting && (
              <div className="mowe">{Icon.bell}โฮสต์ส่งการแจ้งเตือนให้ชำระเมื่อ {fmtDateTimeTH(reminder)}</div>
            )}

            <div className="msechead">สมาชิก (Members) {g.seatsUsed}/{g.max_slots}</div>
            <div className="mroster">
              {g.members.map(m => {
                // [B4] ใช้สถานะบิลเดียวกับหน้า Host (ไม่เดาจาก payment ล่าสุดอีกแล้ว)
                const ph = m.bill.phase;
                const label = m.role === 'Host' ? 'โฮสต์'
                  : ph === 'overdue' ? 'ค้างชำระ'
                    : ph === 'due' ? 'ยังไม่จ่าย'
                      : ph === 'leaving' || m.leaving ? 'แจ้งออก'
                        : ph === 'window' && m.bill.slip !== 'Waiting' ? 'รอบใหม่'
                          : m.bill.slip === 'Waiting' && ph !== 'settled' ? 'รอตรวจ'
                            : 'จ่ายแล้ว';
                const cls = label === 'ค้างชำระ' ? 'over' : label === 'ยังไม่จ่าย' || label === 'รอบใหม่' ? 'due'
                  : label === 'แจ้งออก' || label === 'รอตรวจ' ? 'waived' : 'paid';
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
                    <span className={'mstatus ' + cls}>{label}</span>
                  </div>
                );
              })}
              {g.requests.length > 0 && (
                <div className="mrow"><span className="mrole">มีผู้ขอเข้ากลุ่มรออนุมัติ {g.requests.length} คน (จองที่นั่งแล้ว)</span></div>
              )}
            </div>

            <BankInfoCard bankDT={g.bankDT} />

            {isLeaving && !payable ? (
              /* ================= แจ้งออกแล้ว ================= */
              <>
                <div className="mdue leave">
                  <div className="mdue-top">{Icon.cal}<span>คุณแจ้งประสงค์ออกจากกลุ่มแล้ว</span></div>
                  <span className="mdue-sub">
                    ใช้งานได้ถึงบิลรอบหน้า ({fmtDateTH(bill.leaveEffective)}) · ไม่ต้องชำระรอบสุดท้าย
                    เพราะใช้เงินประกันที่วางไว้ตอนแรกเข้าแทน · ที่นั่งจะว่างในวันนั้น
                  </span>
                </div>
                <button className="mcancel" onClick={cancelLeave} disabled={busy}>{Icon.back}ยกเลิกการแจ้งออก — อยู่กลุ่มต่อ</button>
              </>
            ) : (
              <>
                {bill.phase === 'settled' ? (
                  /* จ่ายรอบนี้แล้ว → ปิดการส่งสลิปซ้ำ เปิดใหม่ 3 วันก่อนรอบหน้า */
                  <div className="mpaidbox">
                    <div className="mpaidbox-row">
                      <span className="mpaidbox-ic">{MIcon.check}</span>
                      <b>ชำระรอบนี้เรียบร้อยแล้ว</b>
                    </div>
                    <span className="mpaidbox-note">
                      ระบบจะเปิดให้ส่งสลิปรอบถัดไปตั้งแต่ 3 วันก่อนวันครบกำหนด{bill.dueDate ? ` (${fmtDateTH(bill.dueDate, { year: false })})` : ''}
                    </span>
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
                          : `ค่าบริการรอบ ${fmtDateTH(bill.target, { year: false })} · ยอด ${th2(bill.amount)} บาท`}
                      </p>
                    </div>
                    {isLeaving && (
                      <div className="mowe">{MIcon.warn}คุณแจ้งออกแล้ว แต่ยังต้องชำระรอบนี้ให้ครบก่อน (รอบถัดไปใช้เงินประกันแทน)</div>
                    )}
                    {oweFull && !waiting && (
                      <div className="mowe">{MIcon.warn}รอบนี้ชำระเต็ม (ค่าบริการ + เติมเงินประกันคืน) เนื่องจากยกเลิกการแจ้งออกหลังใช้เงินประกันไปแล้ว</div>
                    )}
                    {rejectNote}
                    {waiting ? waitingBlock : bill.canUpload ? uploaderBlock : null}
                  </div>
                )}

                {!isLeaving && (
                  <button className="mleave" onClick={() => setLeaveConfirm(true)}>
                    แจ้งความประสงค์ออกจากกลุ่ม คลิกที่นี่{MIcon.chevron}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {DevPanels && (
          <Suspense fallback={null}>
            <DevPanels.MemberGroup groupId={gid} show={show} reload={async () => { await reload(gid); }} />
          </Suspense>
        )}
      </main>

      {/* ===== ยืนยันการแจ้งออก [B13] ===== */}
      <BottomSheet open={leaveConfirm} onClose={() => setLeaveConfirm(false)}>
        <ConfirmBody
          tone="danger"
          title="ยืนยันการแจ้งออกจากกลุ่ม?"
          message="คุณยังต้องชำระรอบบิลปัจจุบันตามปกติ จากนั้นใช้งานต่อได้ถึงบิลรอบหน้าโดยไม่ต้องจ่ายเพิ่ม (ใช้เงินประกันแทน) แล้วระบบจะนำคุณออกและปล่อยที่นั่งให้อัตโนมัติ — เปลี่ยนใจได้ก่อนถึงวันนั้น"
          confirmLabel="แจ้งออกจากกลุ่ม"
          onConfirm={doLeave}
          onCancel={() => setLeaveConfirm(false)}
        />
      </BottomSheet>

      <ResultOverlay
        open={!!leaveDone}
        variant="success"
        title="แจ้งประสงค์ออกจากกลุ่มแล้ว"
        message={`ระบบแจ้งโฮสต์เรียบร้อยแล้ว คุณใช้งานได้ถึง ${fmtDateTH(leaveDone)} (บิลรอบหน้า) โดยรอบสุดท้ายใช้เงินประกันแทน`}
        action={{ label: 'รับทราบ', onClick: () => setLeaveDone(null) }}
        onClose={() => setLeaveDone(null)}
      />

      {/* ===== [B2] Pop-up ค้างชำระ: แสดงทันทีที่เปิดหน้า ===== */}
      <ResultOverlay
        open={overduePopup}
        variant="error"
        title={`ค้างชำระ ${bill.daysLate} วัน`}
        message={waiting
          ? 'คุณส่งสลิปแล้ว กำลังรอโฮสต์ตรวจสอบ'
          : `กรุณาชำระ ${th2(bill.amount)} บาท ภายใน ${bill.kickInDays ?? 0} วัน (ก่อน ${fmtDateTH(bill.kickDate)}) มิฉะนั้นระบบจะนำคุณออกจากกลุ่มอัตโนมัติ และเงินประกันจะถูกใช้เป็นค่าบริการรอบที่ค้าง`}
        action={{ label: waiting ? 'รับทราบ' : 'ชำระเงินตอนนี้', onClick: waiting ? () => setOverduePopup(false) : scrollToUpload }}
        onClose={() => setOverduePopup(false)}
      />

      <NavBar current="group" />
      {toast}
    </div>
  );
}
