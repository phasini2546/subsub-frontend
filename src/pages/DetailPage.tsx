/* =====================================================================
   SubSub · หน้ารายละเอียดกลุ่ม (Host) · pages/DetailPage.tsx
   ---------------------------------------------------------------------
   [B5] สถานะสมาชิกทุกคนมาจาก memberBillStatus ตัวเดียวกับฝั่ง Member
        → เห็น "ค้างชำระ" + นับถอยหลังทันที และมีปุ่ม 🔔 แจ้งเตือนให้รีบจ่าย
   [B8] แตะสมาชิกเพื่อดู "สลิปจริง" ที่อัปโหลด + ประวัติสลิปทุกรอบ
   [B10] อนุมัติ/ปฏิเสธอ้างอิง payment_id ของใบที่เปิดดูอยู่เท่านั้น
   ===================================================================== */
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB, deriveStatus, priceInfo } from '../db';
import type { GroupDetail, MemberWithDetail, BillingInfo, UiStatus, Payment } from '../types';
import { Icon, NavBar, useToast, CATEGORY_ICON, baht, baht2 } from '../ui';
import { todayTH } from '../lib/clock';
import { fmtDateTH, fmtDateTimeTH } from '../lib/date';
import { DevPanels } from '../dev';

const UI_STATUS: Record<UiStatus, { pill: string; cls: string }> = {
  paid:     { pill: 'จ่ายแล้ว',     cls: 'paid' },
  review:   { pill: 'ตรวจสอบสลิป', cls: 'review' },
  rejected: { pill: 'แจ้งเตือน',    cls: 'unpaid' },
  upcoming: { pill: 'แจ้งเตือน',    cls: 'soon' },
  unpaid:   { pill: 'แจ้งเตือน',    cls: 'unpaid' },
  overdue:  { pill: 'แจ้งเตือน',    cls: 'overdue' },
  leaving:  { pill: 'ไม่ต้องจ่าย',  cls: 'leaving' },
};
const REJECT_REASONS = ['ยอดเงินไม่ตรง', 'รูปสลิปไม่ชัด', 'สลิปซ้ำกับรายการก่อน', 'อื่น ๆ'];
const PAY_STATUS_TH: Record<Payment['status'], string> = { Verified: 'อนุมัติแล้ว', Waiting: 'รอตรวจ', Rejected: 'ปฏิเสธ' };

/* ข้อความใต้ชื่อสมาชิก ตามสถานะบิล */
function statusText(m: MemberWithDetail, st: UiStatus): string {
  const b = m.bill;
  const d = (iso: string | null) => fmtDateTH(iso, { month: 'short', year: false });
  switch (st) {
    case 'paid':     return 'ชำระรอบนี้เรียบร้อยแล้ว';
    case 'review':   return `รอตรวจสลิป${b.target ? ' · รอบ ' + d(b.target) : ''}${b.daysLate >= 5 ? ` · ค้าง ${b.daysLate} วัน` : ''}`;
    case 'rejected': return `สลิปถูกปฏิเสธ · รอส่งใหม่${b.daysLate > 0 ? ` · เลยกำหนด ${b.daysLate} วัน` : ''}`;
    case 'upcoming': return `ครบกำหนด ${d(b.dueDate)} · ส่งสลิปล่วงหน้าได้แล้ว`;
    case 'unpaid':   return b.daysLate === 0 ? 'ครบกำหนดวันนี้ · ยังไม่ชำระ' : `ยังไม่ชำระ · เลยกำหนด ${b.daysLate} วัน`;
    case 'overdue':  return `ค้างชำระ ${b.daysLate} วัน · จะถูกนำออกใน ${b.kickInDays ?? 0} วัน (${d(b.kickDate)})`;
    case 'leaving':  return `แจ้งออก · ใช้ได้ถึงบิลรอบหน้า (${d(b.leaveEffective)}) — ที่นั่งว่างวันนั้น`;
  }
}

type SlipTarget = { member: MemberWithDetail; kind: 'member' | 'request' } | null;

export default function DetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [g, setG] = useState<GroupDetail | null>(null);
  const [bill, setBill] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // modal states
  const [slip, setSlip] = useState<SlipTarget>(null);              // ดูสลิป/ประวัติ (+อนุมัติ/ปฏิเสธถ้ารอตรวจ)
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
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

  /* Role guard: หน้านี้เป็นของ Host เท่านั้น — ไม่ใช่โฮสต์ → หน้า Member (อ่านอย่างเดียว) */
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

  const today = todayTH();
  const freeSeats = g.max_slots - g.seatsUsed;
  const pInfo = priceInfo(g, today);
  const overdueCount = g.members.filter(m => m.bill.phase === 'overdue').length;

  /* ---------- actions ---------- */
  const guard = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const copyCode = () => { navigator.clipboard?.writeText(g.invite_code); show('คัดลอกรหัส #' + g.invite_code + ' แล้ว ส่งให้เพื่อนทาง LINE ได้เลย'); };

  /* [B5] แจ้งเตือนสมาชิกที่ยังไม่จ่าย/ค้างชำระ */
  const remind = (m: MemberWithDetail) => guard(async () => {
    await DB.remindMember(g.group_id, m.user_id);
    await reload();
    show('ส่งแจ้งเตือนให้ ' + m.user.display_name + ' รีบชำระแล้ว');
  });

  const openSlip = (m: MemberWithDetail, kind: 'member' | 'request') => {
    setSlip({ member: m, kind });
    setViewPayment(m.bill.payment ?? m.payments[0] ?? null);
  };
  const closeSlip = () => { setSlip(null); setViewPayment(null); setRejecting(false); setReason(null); };

  const approveSlip = () => guard(async () => {
    if (!slip || !viewPayment) return;
    const r = await DB.approvePayment(viewPayment.payment_id);
    const wasReq = slip.kind === 'request';
    closeSlip();
    await reload();
    show(r === 'ok'
      ? (wasReq ? 'อนุมัติแล้ว — สมาชิกใหม่เข้ากลุ่ม แจ้งทาง LINE เรียบร้อย' : 'อนุมัติแล้ว — แจ้งสมาชิกทาง LINE เรียบร้อย')
      : r === 'not_waiting' ? 'สลิปนี้ถูกยกเลิก/ตรวจไปแล้ว — โหลดข้อมูลล่าสุดให้แล้ว'
        : r === 'full' ? 'อนุมัติไม่ได้ — ที่นั่งเต็มแล้ว' : 'ไม่พบสลิปนี้');
  });

  const doReject = () => guard(async () => {
    if (!viewPayment || !reason) { show('เลือกเหตุผลก่อนกดยืนยัน'); return; }
    const r = await DB.rejectPayment(viewPayment.payment_id, reason);
    closeSlip();
    await reload();
    show(r === 'ok' ? 'ปฏิเสธแล้ว ("' + reason + '") — แจ้งให้ส่งสลิปใหม่ทาง LINE' : 'สลิปนี้ถูกยกเลิก/ตรวจไปแล้ว');
  });

  const doDeleteGroup = () => guard(async () => {
    await DB.deleteGroup(g.group_id);
    setDelGroup(false);
    show('ปิดกลุ่มแล้ว — แจ้งสมาชิกทุกคนทาง LINE เรียบร้อย');
    setTimeout(() => navigate('/groups'), 900);
  });

  /* ---------- render helpers ---------- */
  const avatar = (m: MemberWithDetail, filled: boolean) =>
    m.user.pic_user ? <div className="av"><img src={m.user.pic_user} alt="" /></div>
      : <div className={'av' + (filled ? ' filled' : '')}>{filled ? null : Icon.person}</div>;

  const dueTone = (d: number) => d === 0 ? 'today' : d <= 3 ? 'soon' : 'ok';
  const dueMsg = (b: BillingInfo) =>
    b.days_until === 0 ? 'วันนี้เป็นวันตัดรอบบิล' : `รอบบิลถัดไป ${fmtDateTH(b.next_due, { year: false })} · อีก ${b.days_until} วัน`;

  /* [B8] สลิปจริง (data URL ที่สมาชิกอัปโหลด) — ข้อมูลเก่าที่ไม่มีรูปแสดง placeholder */
  const slipView = (url?: string | null) =>
    url && url.startsWith('data:')
      ? (
        <a className="slip" href={url} target="_blank" rel="noreferrer" style={{ padding: 0, background: 'none', minHeight: 0 }}>
          <img src={url} alt="สลิปการโอนเงิน" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
        </a>
      )
      : <div className="slip"><div className="sl m" /><div className="sl l" /><div className="sl s" /><div className="sl l" /><div className="sl m" /><div className="sl s" /></div>;

  const cycleLabel = (p: Payment) =>
    p._kind === 'join' ? 'แรกเข้า (ค่าบริการ + เงินประกัน)' : p._cycle ? 'รอบ ' + fmtDateTH(p._cycle, { month: 'short' }) : 'รอบบิล';

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
                <div className="label">ค่าบริการต่อรอบ</div>
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
            {overdueCount > 0 && (
              <div className="due-banner overdue">
                {Icon.bell}<span>มีสมาชิกค้างชำระ {overdueCount} คน — กด “แจ้งเตือน” เพื่อเตือนให้รีบจ่าย</span>
              </div>
            )}
            {pInfo.upcoming && (
              <div className="due-banner soon">
                {Icon.info}<span>ราคาใหม่ {baht(pInfo.upcoming.price)} บาท{pInfo.upcoming.slots !== pInfo.slotsNow ? ` · สมาชิกสูงสุด ${pInfo.upcoming.slots} คน` : ''} มีผลตั้งแต่รอบบิล {fmtDateTH(pInfo.upcoming.from)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="sechead"><h2>สมาชิก (Members) {g.seatsUsed}/{g.max_slots}</h2></div>
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
            const hasSlip = m.payments.length > 0;
            const canRemind = st === 'unpaid' || st === 'overdue' || st === 'rejected' || st === 'upcoming';
            return (
              <div key={m.member_id}
                className={`row ${hasSlip ? 'tappable' : ''} ${st === 'leaving' ? 'muted' : ''} ${st === 'overdue' ? 'row-overdue' : ''}`}
                role={hasSlip ? 'button' : undefined} tabIndex={hasSlip ? 0 : undefined}
                onClick={hasSlip ? () => openSlip(m, 'member') : undefined}>
                {avatar(m, filled)}
                <div className="who">
                  <b>{m.user.display_name}</b>
                  <span>{statusText(m, st)}</span>
                  {canRemind && m._reminded_at && <span className="reminded">แจ้งเตือนล่าสุด {fmtDateTimeTH(m._reminded_at)}</span>}
                </div>
                {st === 'review' ? (
                  <button className="pill review" onClick={e => { e.stopPropagation(); openSlip(m, 'member'); }}>{s.pill}</button>
                ) : canRemind ? (
                  <button className={'pill ' + s.cls} disabled={busy} onClick={e => { e.stopPropagation(); remind(m); }}>{Icon.bell}{s.pill}</button>
                ) : (
                  <span className={'pill ' + s.cls}>{s.pill}</span>
                )}
              </div>
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
            <div className="sechead"><h2>คำขอเข้า (จองที่นั่งแล้ว)</h2></div>
            <div className="rows">
              {g.requests.map(r => (
                <div className="row" key={r.member_id}>
                  {avatar(r, true)}
                  <div className="who"><b>{r.user.display_name}</b><span>{
                    r.bill.slip === 'Waiting' ? 'รอการตรวจสอบสลิปแรกเข้า'
                      : r.bill.slip === 'Rejected' ? 'สลิปถูกปฏิเสธ · รอส่งใหม่' : 'ยังไม่ได้ส่งสลิป'
                  }</span></div>
                  <button className="pill review" onClick={() => openSlip(r, 'request')}>
                    {r.bill.slip === 'Waiting' ? 'ตรวจสอบสลิป' : 'ดูสลิป'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="note">{Icon.info}
          <p>สมาชิกที่แจ้งออก ไม่ต้องชำระรอบสุดท้าย (ใช้เงินประกันที่วางไว้ตอนแรกเข้าแทน) · สมาชิกที่ค้างชำระเกิน 10 วันจะถูกนำออกอัตโนมัติ และเงินประกันถูกใช้เป็นค่าบริการรอบที่ค้าง</p>
        </div>

        <div className="actions">
          <button className="btn danger" onClick={() => setDelGroup(true)}>ลบรายการ</button>
          <button className="btn primary" style={{ borderRadius: 10, height: 46 }} onClick={() => navigate('/group/' + g.group_id + '/edit')}>แก้ไขข้อมูล</button>
        </div>

        {DevPanels && (
          <Suspense fallback={null}>
            <DevPanels.Detail groupId={g.group_id} show={show} reload={reload} />
          </Suspense>
        )}
      </main>

      <NavBar current="group" />

      {/* ===== modal: ดูสลิปจริง + ประวัติ + อนุมัติ/ปฏิเสธ [B8/B10] ===== */}
      {slip && !rejecting && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) closeSlip(); }}>
          <div className="modal">
            <div className="modal-head"><h3>สลิปของ {slip.member.user.display_name}</h3>
              <button className="x" onClick={closeSlip} aria-label="ปิด">{Icon.close}</button></div>
            {viewPayment ? (
              <>
                {slipView(viewPayment.slip_url)}
                <div className="slipmeta">
                  <div className="av filled" />
                  <div className="who"><b>{cycleLabel(viewPayment)}</b><span>อัปโหลดเมื่อ {fmtDateTimeTH(viewPayment.paid_at)}</span></div>
                  <span className={'pill ' + (viewPayment.status === 'Verified' ? 'paid' : viewPayment.status === 'Waiting' ? 'review' : 'unpaid')}>
                    {PAY_STATUS_TH[viewPayment.status]}
                  </span>
                </div>
                <div className="due">
                  <span>{viewPayment._kind === 'join' ? 'ยอดที่ควรได้รับ (ค่าบริการ + เงินประกัน)' : 'ยอดที่ควรได้รับรอบนี้'}</span>
                  <b>{baht2(viewPayment.amount)} บาท</b>
                </div>
                {viewPayment.status === 'Rejected' && viewPayment._reject_reason && (
                  <p className="sub">เหตุผลที่ปฏิเสธ: {viewPayment._reject_reason}</p>
                )}
              </>
            ) : <p className="sub">ยังไม่มีสลิป</p>}

            {slip.member.payments.length > 1 && (
              <div className="sliphist">
                <div className="sliphist-h">ประวัติสลิป</div>
                {slip.member.payments.map(p => (
                  <button key={p.payment_id} className="sliphist-row" aria-pressed={viewPayment?.payment_id === p.payment_id}
                    onClick={() => setViewPayment(p)}>
                    <span>{cycleLabel(p)}</span>
                    <span>{baht2(p.amount)} · {PAY_STATUS_TH[p.status]}</span>
                  </button>
                ))}
              </div>
            )}

            {viewPayment?.status === 'Waiting' ? (
              <div className="modal-actions">
                <button className="btn primary" style={{ height: 46, borderRadius: 10, padding: 0 }} disabled={busy} onClick={approveSlip}>อนุมัติการชำระเงิน</button>
                <button className="btn danger" onClick={() => { setRejecting(true); setReason(null); }}>ปฏิเสธรายการ</button>
              </div>
            ) : (
              <div className="modal-actions"><button className="btn ghost" onClick={closeSlip}>ปิด</button></div>
            )}
          </div>
        </div>
      )}

      {/* ===== modal: เลือกเหตุผลปฏิเสธ ===== */}
      {slip && rejecting && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setRejecting(false); }}>
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
              <button className="btn solid-danger" disabled={busy} onClick={doReject}>ยืนยันปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== modal: ยืนยันลบ (ปิด) กลุ่ม ===== */}
      {delGroup && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setDelGroup(false); }}>
          <div className="modal">
            <h3>ลบกลุ่ม {g.service_name}</h3>
            <p className="sub">
              สมาชิก {g.members.length - 1} คนและคำขอเข้า {g.requests.length} รายการจะถูกนำออกทั้งหมด ระบบไม่คืนเงินอัตโนมัติ — ตกลงเรื่องเงินกับสมาชิกให้เรียบร้อยก่อนลบ<br /><br />
              กลุ่มจะหายจากรายการของทุกคน (ประวัติค่าใช้จ่ายย้อนหลังใน “ภาพรวม” ยังอยู่)
            </p>
            <div className="modal-actions two">
              <button className="btn ghost" onClick={() => setDelGroup(false)}>ยกเลิก</button>
              <button className="btn solid-danger" disabled={busy} onClick={doDeleteGroup}>ลบกลุ่ม</button>
            </div>
          </div>
        </div>
      )}

      {toast}
    </div>
  );
}
