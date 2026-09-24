/* =====================================================================
   SubSub · หน้ารายละเอียดกลุ่ม · pages/DetailPage.tsx
   แปลงจาก detail.html + detail.js — ครบทุก flow ฝั่งโฮสต์
   ===================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB, deriveStatus, priceInfo } from '../db';
import type { GroupDetail, MemberWithDetail, BillingInfo, UiStatus } from '../types';
import { Icon, NavBar, useToast, CATEGORY_ICON, baht, baht2 } from '../ui';

const UI_STATUS: Record<UiStatus, { text: string; pill: string; cls: string }> = {
  paid:    { text: 'ชำระเงินเรียบร้อยแล้ว', pill: 'จ่ายแล้ว',   cls: 'paid' },
  review:  { text: 'รอการตรวจสอบสลิป',       pill: 'ตรวจสอบสลิป', cls: 'review' },
  unpaid:  { text: 'ยังไม่ได้ชำระเงิน',        pill: 'เตือนสมาชิก', cls: 'unpaid' },
  leaving: { text: 'ประสงค์ออก',              pill: 'ไม่ต้องจ่าย',  cls: 'leaving' },
};
const REJECT_REASONS = ['ยอดเงินไม่ตรง', 'รูปสลิปไม่ชัด', 'สลิปซ้ำกับรายการก่อน', 'อื่น ๆ'];

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
};

type SlipTarget = { userId: string; kind: 'member' | 'request'; name: string; payment: MemberWithDetail['currentPayment'] } | null;

export default function DetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [g, setG] = useState<GroupDetail | null>(null);
  const [bill, setBill] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // modal states
  const [slip, setSlip] = useState<SlipTarget>(null);        // ดูสลิปเพื่ออนุมัติ/ปฏิเสธ
  const [approved, setApproved] = useState<MemberWithDetail | null>(null); // ดูสลิปที่อนุมัติแล้ว
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [delGroup, setDelGroup] = useState(false);

  const reload = useCallback(async () => {
    const data = await DB.getGroup(id);
    setG(data);
    setBill(DB.billingInfo(id));
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  /* Role guard: หน้านี้เป็นของ Host เท่านั้น — ถ้าไม่ใช่โฮสต์ของกลุ่มนี้ ส่งไปหน้า Member (อ่านอย่างเดียว) */
  useEffect(() => {
    if (g && DB.me().user_id !== g.user_id) navigate('/member/group/' + id, { replace: true });
  }, [g, id, navigate]);

  if (loading) return <div className="phone"><main className="screen"><div className="wrap"><div className="skel" style={{ height: 120 }} /></div></main></div>;
  if (!g) return (
    <div className="phone"><main className="screen">
      <div className="wrap" style={{ paddingTop: 80, textAlign: 'center', color: 'var(--ink-2)' }}>
        ไม่พบกลุ่มนี้ (อาจถูกลบไปแล้ว)<br /><br />
        <button className="btn primary" style={{ maxWidth: 200, margin: '0 auto' }} onClick={() => navigate('/groups')}>กลับหน้ากลุ่ม</button>
      </div></main></div>
  );

  const seatsUsed = g.members.filter(m => m.status === 'Active').length;
  const freeSeats = g.max_slots - seatsUsed;
  const pInfo = priceInfo(g);   // ราคาที่มีผลตอนนี้ + ราคาที่ตั้งไว้ให้มีผลเดือนหน้า (ถ้ามี)
  const thMonthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${MON[m - 1]} ${y + 543}`;
  };

  /* ---------- actions ---------- */
  const copyCode = () => { navigator.clipboard?.writeText(g.invite_code); show('คัดลอกรหัส #' + g.invite_code + ' แล้ว ส่งให้เพื่อนทาง LINE ได้เลย'); };
  const remind = (m: MemberWithDetail) => show('ส่งข้อความเตือน ' + m.user.display_name + ' ทาง LINE แล้ว');

  const openSlip = (m: MemberWithDetail, kind: 'member' | 'request') =>
    setSlip({ userId: m.user_id, kind, name: m.user.display_name, payment: m.currentPayment });

  const approveSlip = async () => {
    if (!slip) return;
    await DB.approvePayment(g.group_id, slip.userId);
    const wasReq = slip.kind === 'request';
    setSlip(null);
    await reload();
    show(wasReq ? 'อนุมัติแล้ว — สมาชิกใหม่เข้ากลุ่ม แจ้งทาง LINE เรียบร้อย' : 'อนุมัติแล้ว — แจ้งสมาชิกทาง LINE เรียบร้อย');
  };

  const doReject = async () => {
    if (!slip || !reason) { show('เลือกเหตุผลก่อนกดยืนยัน'); return; }
    await DB.rejectPayment(g.group_id, slip.userId, reason);
    setRejecting(false); setSlip(null); setReason(null);
    await reload();
    show('ปฏิเสธแล้ว ("' + reason + '") — แจ้งให้ส่งสลิปใหม่ทาง LINE');
  };

  const doDeleteGroup = async () => {
    await DB.deleteGroup(g.group_id);
    setDelGroup(false);
    show('ลบกลุ่มแล้ว — แจ้งสมาชิกทุกคนทาง LINE เรียบร้อย');
    setTimeout(() => navigate('/groups'), 900);
  };

  /* ---------- test buttons ---------- */
  const simJoin = async () => { await DB.createJoinRequest(g.group_id, 'ผู้ขอเข้า ' + String.fromCharCode(65 + g.requests.length + g.members.length)); await reload(); show('มีคนขอเข้ากลุ่มใหม่ (จำลอง) — เลื่อนลงไปดู “คำขอเข้า”'); };
  const simMonthly = async () => {
    const t = g.members.find(m => m.role !== 'Host' && !m.leaving && deriveStatus(m) === 'unpaid');
    if (!t) { show('ไม่มีสมาชิกที่ค้างจ่ายรอบนี้ — ลองกด “ขึ้นรอบบิลใหม่” ก่อน'); return; }
    await DB.payMonthly(g.group_id, t.user_id); await reload();
    show(t.user.display_name + ' แนบสลิปรอบเดือนแล้ว — กด “ตรวจสอบสลิป” เพื่ออนุมัติ');
  };
  
  const simLeave = async () => {
  const t = g.members.find(m => m.role !== 'Host' && !m.leaving && !m.left_date);
  if (!t) { show('ไม่มีสมาชิกให้ทดสอบขอออก — ต้องมีสมาชิก (ไม่ใช่โฮสต์) ในกลุ่มก่อน'); return; }
  await DB.requestLeave(g.group_id, t.user_id); await reload();
  show(t.user.display_name + ' กดขอออกแล้ว — รอบนี้ไม่ต้องจ่าย เดือนหน้ากด "ขึ้นรอบบิลใหม่" จะถูกนำออกอัตโนมัติ');
  };
  const simCycle = async () => { const c = await DB.startNewCycle(g.group_id); await reload(); show(`ขึ้นรอบบิลที่ ${c?.period} แล้ว — สมาชิกทุกคนกลับเป็น “ยังไม่ชำระ” (ยอด ${baht(c?.price ?? 0)} บาท/คน)`); };

  /* ---------- render helpers ---------- */
  const avatar = (m: MemberWithDetail, filled: boolean) =>
    m.user.pic_user ? <div className="av"><img src={m.user.pic_user} alt="" /></div>
      : <div className={'av' + (filled ? ' filled' : '')}>{filled ? null : Icon.person}</div>;

  const dueTone = (d: number) => d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 3 ? 'soon' : 'ok';
  const dueMsg = (b: BillingInfo) => {
    const dt = new Date(b.next_due).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' });
    if (b.days_until < 0) return `เลยกำหนดชำระมาแล้ว ${Math.abs(b.days_until)} วัน`;
    if (b.days_until === 0) return 'ครบกำหนดชำระวันนี้';
    return `ครบกำหนด ${dt} · อีก ${b.days_until} วัน`;
  };

  /* แสดงสลิป: ถ้าเป็นรูปจริง (data URL ที่สมาชิกอัปมา) โชว์รูปจริง, ไม่งั้น placeholder (สลิปทดสอบ) */
  const slipView = (url?: string | null) =>
    url && url.startsWith('data:')
      ? (
        <div className="slip" style={{ padding: 0, background: 'none', minHeight: 0 }}>
          <img src={url} alt="สลิปการโอนเงิน" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
        </div>
      )
      : <div className="slip"><div className="sl m" /><div className="sl l" /><div className="sl s" /><div className="sl l" /><div className="sl m" /><div className="sl s" /></div>;

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/groups')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>รายละเอียดกลุ่ม</h1>
      </header>

      <main className="screen">
        <div className="wrap">
          <div className="card hero">
            <div className="hero-top">
              <div className="logo">{CATEGORY_ICON[g.category] || '📦'}</div>
              <div>
                <div className="hero-name">{g.service_name}</div>
                <div className="status"><i className="dot" /><span>ACTIVE</span></div>
              </div>
            </div>
            <div className="hero-bot">
              <div>
                <div className="label">ค่าบริการต่อเดือน</div>
                <div className="price"><b>{baht(pInfo.now)}</b><i>บาท</i></div>
              </div>
              <div className="codechip">
                <span>#{g.invite_code}</span>
                <button onClick={copyCode} aria-label="คัดลอกรหัสเชิญ">{Icon.copy}</button>
              </div>
            </div>
            {bill && (
              <div className={'due-banner ' + dueTone(bill.days_until)}>
                {Icon.cal}<span>{dueMsg(bill)}</span>
              </div>
            )}
            {pInfo.upcoming && (
              <div className="due-banner soon">
                {Icon.info}<span>ราคาใหม่ {baht(pInfo.upcoming.price)} บาท{pInfo.upcoming.slots !== pInfo.slotsNow ? ` · สมาชิกสูงสุด ${pInfo.upcoming.slots} คน` : ''} จะมีผล {thMonthLabel(pInfo.upcoming.from)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="sechead"><h2>สมาชิก (Members) {seatsUsed}/{g.max_slots}</h2></div>
        <div className="rows">
          {g.members.map(m => {
            if (m.role === 'Host') {
             return (
            <div className="row" key={m.member_id}>
              {avatar(m, true)}
              <div className="who"><b>{m.user.display_name}</b><span>โฮสต์ · ตัดบัตรอัตโนมัติ</span></div>
              <span className="pill paid">โฮสต์</span>
            </div>
            );
            }
            const st = deriveStatus(m);
            const s = UI_STATUS[st];
            const filled = st === 'paid' || st === 'review';
            const tap = st === 'paid';
            const RowTag = tap ? 'button' : 'div';
            return (
              <RowTag key={m.member_id} className={`row ${tap ? 'tappable' : ''} ${st === 'leaving' ? 'muted' : ''}`}
                {...(tap ? { onClick: () => setApproved(m) } : {})}>
                {avatar(m, filled)}
                <div className="who"><b>{m.user.display_name}</b><span>{
                  st === 'leaving' && m._leave_effective
                    ? `ประสงค์ออก · ที่นั่งว่าง ${new Date(m._leave_effective).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} (เตรียมหาคนใหม่ได้)`
                    : s.text
                }</span></div>
                {st === 'review' ? (
                  <button className="pill review" onClick={e => { e.stopPropagation(); openSlip(m, 'member'); }}>{s.pill}</button>
                ) : st === 'unpaid' ? (
                  <button className="pill unpaid" onClick={e => { e.stopPropagation(); remind(m); }}>{Icon.bell}{s.pill}</button>
                ) : (
                  <span className={'pill ' + s.cls}>{s.pill}</span>
                )}
              </RowTag>
            );
          })}
          {freeSeats > 0 && (
            <div className="row muted" style={{ justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              ที่นั่งว่าง {freeSeats} ที่ — แชร์รหัส #{g.invite_code} เพื่อชวนคนใหม่
            </div>
          )}
        </div>

        {g.requests.length > 0 && (
          <>
            <div className="sechead"><h2>คำขอเข้า</h2></div>
            <div className="rows">
              {g.requests.map(r => (
                <div className="row" key={r.member_id}>
                  {avatar(r, true)}
                  <div className="who"><b>{r.user.display_name}</b><span>รอการตรวจสอบสลิป</span></div>
                  <button className="pill review" onClick={() => openSlip(r, 'request')}>ตรวจสอบสลิป</button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="note">{Icon.info}
          <p>กรณีสมาชิกมีความประสงค์ยกเลิกการเป็นสมาชิก จะไม่มีการเรียกเก็บเงินเดือนสุดท้าย เนื่องจากค่าดังกล่าวได้ครอบคลุมอยู่ในเงินประกันที่ชำระไว้เมื่อเข้าใช้งานในเดือนแรกเรียบร้อยแล้ว</p>
        </div>

        <div className="actions">
          <button className="btn danger" onClick={() => setDelGroup(true)}>ลบรายการ</button>
          <button className="btn primary" style={{ borderRadius: 10, height: 46 }} onClick={() => navigate('/group/' + g.group_id + '/edit')}>แก้ไขข้อมูล</button>
        </div>

        {/* แผงทดสอบชั่วคราว */}
        <div className="testpanel">
          <div className="testpanel-h">🧪 เครื่องมือทดสอบ (ลบออกเมื่อระบบจริงเสร็จ)</div>
          <button onClick={simJoin}>มีคนขอเข้ากลุ่ม + แนบสลิป (แรกเข้า)</button>
          <button onClick={simMonthly}>สมาชิกจ่ายค่าบริการรอบเดือน + แนบสลิป</button>
          <button onClick={simCycle}>ขึ้นรอบบิลใหม่ (reset สถานะสมาชิก)</button>
          <button onClick={simLeave}>สมาชิกกดขอออก (ประสงค์ออก)</button>
        </div>
      </main>

      <NavBar current="group" />

      {/* ===== modal: ตรวจสลิป ===== */}
      {slip && !rejecting && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setSlip(null); }}>
          <div className="modal">
            <div className="modal-head"><h3>ตรวจสอบสลิป</h3>
              <button className="x" onClick={() => setSlip(null)} aria-label="ปิด">{Icon.close}</button></div>
            {slipView(slip.payment?.slip_url)}
            <div className="slipmeta">
              <div className="av filled" />
              <div className="who"><b>{slip.name}</b><span>อัปโหลดเมื่อ {slip.payment ? fmtDateTime(slip.payment.paid_at) : '-'}</span></div>
            </div>
            <div className="due">
              <span>{slip.kind === 'request' ? 'ยอดที่ควรได้รับ (ค่าบริการ + เงินประกัน)' : 'ยอดที่ควรได้รับรอบนี้'}</span>
              <b>{slip.payment ? baht2(slip.payment.amount) : '-'} บาท</b>
            </div>
            <div className="modal-actions">
              <button className="btn primary" style={{ height: 46, borderRadius: 10, padding: 0 }} onClick={approveSlip}>อนุมัติการชำระเงิน</button>
              <button className="btn danger" onClick={() => { setRejecting(true); setReason(null); }}>ปฏิเสธรายการ</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== modal: เลือกเหตุผลปฏิเสธ ===== */}
      {slip && rejecting && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) { setRejecting(false); } }}>
          <div className="modal">
            <div className="modal-head"><h3>ปฏิเสธรายการ</h3>
              <button className="x" onClick={() => setRejecting(false)} aria-label="ปิด">{Icon.close}</button></div>
            <p className="sub">เลือกเหตุผลเพื่อให้ระบบแจ้งสมาชิกทาง LINE — สมาชิกจะอัปโหลดสลิปใหม่ได้ทันที</p>
            <div className="reasons">
              {REJECT_REASONS.map(r => (
                <button key={r} className="reason" aria-pressed={reason === r} onClick={() => setReason(r)}>
                  <span className="rd" />{r}
                </button>
              ))}
            </div>
            <div className="modal-actions two">
              <button className="btn ghost" onClick={() => setRejecting(false)}>ยกเลิก</button>
              <button className="btn solid-danger" onClick={doReject}>ยืนยันปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== modal: ดูสลิปที่อนุมัติแล้ว ===== */}
      {approved && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setApproved(null); }}>
          <div className="modal">
            <div className="modal-head"><h3>สลิปที่อนุมัติแล้ว</h3>
              <button className="x" onClick={() => setApproved(null)} aria-label="ปิด">{Icon.close}</button></div>
            {slipView(approved.currentPayment?.slip_url)}
            <div className="slipmeta">
              <div className="av filled" />
              <div className="who"><b>{approved.user.display_name}</b><span>ยืนยันแล้วเมื่อ {approved.currentPayment ? fmtDateTime(approved.currentPayment.paid_at) : '-'}</span></div>
              <span className="pill paid">จ่ายแล้ว</span>
            </div>
            <div className="due"><span>ยอดที่ได้รับ</span><b>{approved.currentPayment ? baht2(approved.currentPayment.amount) : '-'} บาท</b></div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setApproved(null)}>ปิด</button></div>
          </div>
        </div>
      )}

      {/* ===== modal: ยืนยันลบกลุ่ม ===== */}
      {delGroup && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setDelGroup(false); }}>
          <div className="modal">
            <h3>ลบกลุ่ม {g.service_name}</h3>
            <p className="sub">
              สมาชิก {g.members.length} คนจะถูกนำออกทั้งหมด ระบบไม่คืนเงินอัตโนมัติ — ตกลงเรื่องเงินกับสมาชิกให้เรียบร้อยก่อนลบ<br /><br />
              การลบนี้ย้อนกลับไม่ได้ ประวัติสลิปทั้งหมดจะหายไปด้วย
            </p>
            <div className="modal-actions two">
              <button className="btn ghost" onClick={() => setDelGroup(false)}>ยกเลิก</button>
              <button className="btn solid-danger" onClick={doDeleteGroup}>ลบกลุ่ม</button>
            </div>
          </div>
        </div>
      )}

      {toast}
    </div>
  );
}