/* =====================================================================
   SubSub · หน้าบริการ (Services) · pages/ServicesPage.tsx
   ---------------------------------------------------------------------
   หน้าหลักแท็บ "บริการ" — สรุปค่าใช้จ่าย + ตัวกรองหมวดหมู่ +
   รายการที่ใช้งานอยู่ (กลุ่มที่ร่วม + รายจ่ายส่วนตัว) + ปุ่มเพิ่มบริการใหม่
   ต่อ DB จริงผ่าน db.ts (getMyGroups + getMySubscriptions + getDashboard)
   ดีไซน์ใช้ design system เดียวกับหน้า Host (app.css)
   ===================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB, CATEGORY_LABEL } from '../db';
import type { GroupRow, Subscription, Category } from '../types';
import { Icon, NavBar, useToast, CATEGORY_ICON, baht2, BrandLogo } from '../ui';
import AddServiceForm from './AddServiceForm';

type Row =
  | { kind: 'group'; id: string; name: string; category: Category; amount: number; group: GroupRow }
  | { kind: 'solo'; id: string; name: string; category: Category; amount: number; sub: Subscription };

type Filter = Category | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'Entertainment', label: 'บันเทิง' },
  { key: 'Music', label: 'เพลง' },
  { key: 'Productivity', label: 'ทำงาน' },
  { key: 'Other', label: 'อื่น ๆ' },
];

export default function ServicesPage() {
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [yearTotal, setYearTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);

  /* ---- Dev/Test helpers (ฝั่ง Member) ---- */
  const resetData = async () => { DB.reset(); await load(); show('รีเซ็ตข้อมูลทดสอบแล้ว'); };
  const seedDemo = async () => {
    const { code } = await DB.seedDemoGroup();
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard blocked */ }
    await load();
    show('สร้างกลุ่มสาธิตแล้ว · รหัส ' + code + ' (คัดลอกแล้ว) → ไปหน้าเข้าร่วมกลุ่ม');
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [groups, subs, dash] = await Promise.all([
      DB.getMyGroups(),            // กลุ่มที่ฉันเป็น Host/Member
      DB.getMySubscriptions(),     // รายจ่ายส่วนตัว (เดี่ยว)
      DB.getDashboard(),           // ยอดรวมรายปี (คิดตามเดือนสะสมจริง)
    ]);
    // amount = "ยอดที่ต้องจ่ายจริงของฉัน" — กลุ่ม: หารต่อหัว (total_price / max_slots), เดี่ยว: เต็มจำนวน
    const groupRows: Row[] = groups.map(g => ({
      kind: 'group', id: g.group_id, name: g.service_name,
      category: g.category, amount: Number(g.total_price) / Math.max(1, g.max_slots), group: g,
    }));
    const soloRows: Row[] = subs.filter(s => !s.end_date).map(s => ({
      kind: 'solo', id: s.sub_id, name: s.service_name,
      category: s.category, amount: Number(s.price), sub: s,
    }));
    const all = [...groupRows, ...soloRows];
    setRows(all);
    // ยอดรวมเดือนนี้ = ผลรวมของยอดที่ต้องจ่ายจริงทุกรายการ → คำนวณจาก rows ชุดเดียวกับที่แสดง
    // ทำให้ยอดรวม "อัปเดตตามการเพิ่ม/ลบเสมอ" และตรงกับผลรวมการ์ดที่เห็นบนจอ
    setMonthTotal(all.reduce((sum, r) => sum + r.amount, 0));
    setYearTotal(dash.yearTotal);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'all' ? rows : rows.filter(r => r.category === filter);

  return (
    <div className="phone">
      <header className="topbar" style={{ justifyContent: 'space-between' }}>
        <BrandLogo />
        <button className="back" aria-label="วิธีใช้งาน" style={{ color: 'var(--gold)' }}
          onClick={() => navigate('/howto')}>
          {Icon.bang}
        </button>
      </header>

      <main className="screen">
        <div className="wrap">
          {/* การ์ดสรุปค่าใช้จ่าย (ใช้สไตล์เดียวกับหน้าภาพรวม) */}
          {loading ? (
            <div className="skel" style={{ height: 132, marginBottom: 20 }} />
          ) : (
            <div className="dash-hero">
              <div className="dash-hero-label">ค่าใช้จ่ายเดือนนี้</div>
              <div className="dash-hero-amount">{baht2(monthTotal)} <span>บาท</span></div>
              <div className="dash-hero-divider" />
              <div className="dash-hero-year">ค่าใช้จ่ายรายปี <b>{baht2(yearTotal)} บาท</b></div>
            </div>
          )}

          {/* ตัวกรองหมวดหมู่ */}
          <div className="filterbar">
            {FILTERS.map(f => (
              <button key={f.key} className="chip" aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>

          <div className="sechead2">รายการที่ใช้งานอยู่</div>

          {loading ? (
            [0, 1].map(i => (
              <div className="skel-card" key={i}>
                <div className="skel-row">
                  <div className="skel logo" />
                  <div style={{ flex: 1 }}>
                    <div className="skel line" style={{ width: '55%', marginBottom: 10 }} />
                    <div className="skel line" style={{ width: '35%', height: 11 }} />
                  </div>
                </div>
              </div>
            ))
          ) : visible.length === 0 ? (
            <div className="empty" style={{ minHeight: 220 }}>
              <p>{rows.length === 0
                ? 'ยังไม่มีบริการที่ใช้งานอยู่\nกดปุ่ม “เพิ่มบริการใหม่” เพื่อเริ่มต้น'
                : 'ไม่มีรายการในหมวดหมู่นี้'}</p>
            </div>
          ) : (
            visible.map(r => {
              const to = r.kind === 'group' ? '/group/' + r.id : '/sub/' + r.id;
              return (
                <div key={r.id} className="gcard" tabIndex={0} role="button"
                  onClick={() => navigate(to)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(to); } }}>
                  <div className="gtop">
                    <div className="logo">{CATEGORY_ICON[r.category] || '📦'}</div>
                    <div className="gname">
                      <b>{r.name}</b>
                      <span className={'ktag' + (r.kind === 'group' ? '' : ' solo')}>
                        {r.kind === 'group' ? Icon.people : Icon.person}
                        {r.kind === 'group' ? 'กลุ่ม' : 'เดี่ยว'}
                      </span>
                    </div>
                    <span className="badge">{CATEGORY_LABEL[r.category]}</span>
                  </div>
                  <div className="gbot">
                    <span className="seats">
                      {r.kind === 'group'
                        ? <>ส่วนของคุณ · สมาชิก <b>{r.group.memberCount}/{r.group.max_slots}</b> คน</>
                        : <>รายจ่ายส่วนตัว · ชำระเอง</>}
                    </span>
                    <span className="amt">{baht2(r.amount)} บาท</span>
                  </div>
                </div>
              );
            })
          )}

          {!loading && (
            <div className="testpanel" style={{ margin: '26px 0 0' }}>
              <div className="testpanel-h">🧪 โหมดทดสอบ Member (Dev)</div>
              <button onClick={() => navigate('/join')}>① เข้าร่วมกลุ่ม — ใช้รหัส DISNEY-99 (เต็ม: NFLX-2026)</button>
              <button onClick={() => navigate('/member/pay')}>② หน้าชำระเงิน + อัปโหลดสลิป (232.80)</button>
              <button onClick={() => navigate('/member/group')}>③ กลุ่มที่ใช้งาน — ตรวจสอบสลิป / ออกจากกลุ่ม</button>
              <button onClick={seedDemo}>④ (DB) สร้างกลุ่มสาธิต + คัดลอกรหัสเชิญ</button>
              <button onClick={resetData}>♻︎ รีเซ็ตข้อมูลทดสอบทั้งหมด</button>
            </div>
          )}
        </div>
      </main>

      {/* ปุ่มลอย: เพิ่มบริการใหม่ (รายจ่ายส่วนตัว) */}
      {!loading && (
        <button className="fab" onClick={() => setAdding(true)}>
          {Icon.add}<span>เพิ่มบริการใหม่</span>
        </button>
      )}

      <NavBar current="service" />
      {toast}

      {/* ฟอร์มเพิ่มบริการใหม่ — มิเรอร์ UX หน้า Host สร้างกลุ่ม (CreatePage)
          (การแก้ไข/ลบ ย้ายเข้าไปอยู่ในหน้ารายละเอียด /sub/:id แล้ว) */}
      {adding && (
        <AddServiceForm
          onClose={() => setAdding(false)}
          onSaved={async (name) => {
            setAdding(false);
            await load();
            show('เพิ่มบริการ “' + name + '” เรียบร้อย');
          }}
        />
      )}
    </div>
  );
}
