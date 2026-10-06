/* =====================================================================
   SubSub · รายละเอียดรายจ่ายส่วนตัว (เดี่ยว) · pages/SubDetailPage.tsx
   ---------------------------------------------------------------------
   เปิดจากการแตะการ์ด "เดี่ยว" ในหน้าบริการ (interaction เดียวกับการ์ดกลุ่ม)
   ปุ่ม แก้ไข / ลบ ย้ายมาอยู่ในหน้านี้
   ===================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB, CATEGORY_LABEL } from '../db';
import type { Subscription } from '../types';
import { Icon, NavBar, useToast, CATEGORY_ICON, baht2 } from '../ui';
import AddServiceForm from './AddServiceForm';
import { fmtDateTH } from '../lib/date';

/* [B6] แสดงวันที่ตามเวลาไทย + วันครบกำหนดถัดไป */
const thDate = (iso: string) => fmtDateTH(iso);

export default function SubDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSub(await DB.getSubscription(id));
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const doDelete = async () => {
    if (!sub) return;
    const name = sub.service_name;
    await DB.deleteSubscription(sub.sub_id);
    setConfirmDel(false);
    show('ลบ “' + name + '” แล้ว');
    setTimeout(() => navigate('/service'), 700);
  };

  if (loading) {
    return (
      <div className="phone">
        <header className="topbar"><button className="back" onClick={() => navigate('/service')}>{Icon.back}</button><h1>รายละเอียด</h1></header>
        <main className="screen"><div className="wrap"><div className="skel" style={{ height: 150 }} /></div></main>
      </div>
    );
  }
  if (!sub) {
    return (
      <div className="phone">
        <header className="topbar"><button className="back" onClick={() => navigate('/service')}>{Icon.back}</button><h1>รายละเอียด</h1></header>
        <main className="screen"><div className="empty"><p>ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)</p></div></main>
        <NavBar current="service" />
      </div>
    );
  }

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/service')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>รายละเอียดบริการ</h1>
      </header>

      <main className="screen">
        <div className="wrap">
          {/* hero */}
          <div className="hero" style={{ background: '#fff', border: '1.5px solid var(--green-line)', borderRadius: 16, padding: 20 }}>
            <div className="hero-top">
              <div className="logo">{CATEGORY_ICON[sub.category] || '📦'}</div>
              <div>
                <div className="hero-name">{sub.service_name}</div>
                <div className="status">
                  <span className="ktag solo" style={{ marginTop: 0 }}>{Icon.person}เดี่ยว</span>
                  <span className="badge" style={{ marginLeft: 6 }}>{CATEGORY_LABEL[sub.category]}</span>
                </div>
              </div>
            </div>
            <div className="hero-bot">
              <div>
                <div className="label">ยอดที่ต้องจ่าย (ชำระเอง)</div>
                <div className="price"><b>{baht2(sub.price)}</b><i>บาท / เดือน</i></div>
              </div>
            </div>
          </div>

          {/* info card */}
          <div className="dash-card" style={{ marginTop: 20 }}>
            <div className="dash-card-title">ข้อมูลรายการ</div>
            <div className="due"><span>หมวดหมู่</span><b>{CATEGORY_LABEL[sub.category]}</b></div>
            <div className="due"><span>รอบบิล</span><b>{sub._billing_cycle === 'yearly' ? 'รายปี' : `รายเดือน · ทุกวันที่ ${sub._billing_day ?? Number(sub.billing_date.slice(8, 10))}`}</b></div>
            <div className="due" style={{ marginBottom: 0 }}><span>ครบกำหนดถัดไป</span><b>{thDate(DB.upcomingDue(sub).date)}</b></div>
          </div>

          {/* actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
            <button className="btn primary" onClick={() => setEditing(true)}>{Icon.edit}แก้ไขรายการ</button>
            <button className="btn danger" onClick={() => setConfirmDel(true)}>{Icon.trash}ลบรายการ</button>
          </div>
        </div>
      </main>

      <NavBar current="service" />
      {toast}

      {/* แก้ไข — ใช้ฟอร์มเดียวกับตอนเพิ่ม (prefill) */}
      {editing && (
        <AddServiceForm
          editing={sub}
          onClose={() => setEditing(false)}
          onSaved={async (name) => { setEditing(false); await load(); show('บันทึกการแก้ไข “' + name + '” เรียบร้อย'); }}
        />
      )}

      {/* ยืนยันการลบ */}
      {confirmDel && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setConfirmDel(false); }}>
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>ลบรายการนี้?</h3>
            <p className="sub">“{sub.service_name}” จะถูกลบออกจากรายการของคุณ</p>
            <div className="modal-actions">
              <button className="btn solid-danger" onClick={doDelete}>ลบรายการ</button>
              <button className="btn ghost" onClick={() => setConfirmDel(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
