/* =====================================================================
   SubSub · หน้าบริการ (Services) · pages/ServicesPage.tsx
   ---------------------------------------------------------------------
   แท็บ "บริการ" — สรุปค่าใช้จ่าย + ตัวกรอง + รายการที่ใช้งานอยู่
   การ์ดกลุ่ม: แสดงบทบาท (Host/Member) · จำนวนสมาชิก · State · วันครบกำหนด
   นำทางตามบทบาท: Host → /group/:id (จัดการได้) · Member → /member/group/:id (อ่านอย่างเดียว)
   สีไอคอน/ป้าย แยกตามหมวดหมู่ (ไม่ใช้เขียวทุกหมวด)
   ===================================================================== */
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB, CATEGORY_LABEL, priceInfo, dueText } from '../db';
import type { GroupRow, Subscription, Category, Role } from '../types';
import type { MemberCardState, MemberGroupRow } from '../db';
import { todayTH } from '../lib/clock';
import { DevPanels } from '../dev';
import { Icon, NavBar, useToast, CategoryIcon, baht2, BrandLogo } from '../ui';
import AddServiceForm from './AddServiceForm';

type DueMeta = { text: string; urgent: boolean; days: number };
type GState = 'host' | MemberCardState;
type Row =
  | { kind: 'group'; id: string; name: string; category: Category; amount: number;
      role: Role; state: GState; memberCount: number; maxSlots: number; due: DueMeta; group: GroupRow }
  | { kind: 'solo'; id: string; name: string; category: Category; amount: number; due: DueMeta; sub: Subscription };

type Filter = Category | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'Entertainment', label: 'บันเทิง' },
  { key: 'Music', label: 'เพลง' },
  { key: 'Productivity', label: 'ทำงาน' },
  { key: 'Other', label: 'อื่น ๆ' },
];

/* ป้ายสถานะกลุ่ม (อ้างอิงชุดสี state เดียวกับหน้า Member/Host) */
const STATE_BADGE: Record<GState, { cls: string; text: string }> = {
  host:     { cls: 'gbadge-active',  text: 'ACTIVE' },
  joined:   { cls: 'gbadge-active',  text: 'เข้าร่วมแล้ว' },
  due:      { cls: 'gbadge-wait',    text: 'ถึงกำหนดชำระ' },
  overdue:  { cls: 'gbadge-overdue', text: 'ค้างชำระ' },
  pending:  { cls: 'gbadge-wait',    text: 'รออนุมัติ' },
  rejected: { cls: 'gbadge-reject',  text: 'ถูกปฏิเสธ' },
  leaving:  { cls: 'gbadge-leave',   text: 'แจ้งออกแล้ว' },
};

/* วันครบกำหนด (มาตรฐานเดียวกับหน้า Member) — [B6/B7] คำนวณจากรอบบิลตามเวลาไทย */
const dueMetaOf = (src: Parameters<typeof DB.upcomingDue>[0]): DueMeta => dueText(DB.upcomingDue(src).days);
const memberDue = (m: MemberGroupRow): DueMeta => ({ text: m.dueText, urgent: m.dueUrgent, days: m.bill.daysUntilDue ?? 0 });

export default function ServicesPage() {
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [yearTotal, setYearTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [groups, memberGroups, subs, dash] = await Promise.all([
      DB.getMyGroups(),            // กลุ่มที่ฉันเป็น Host/Member (+role)
      DB.getMemberGroups(),        // สถานะฝั่งสมาชิก (pending/joined/leaving...)
      DB.getMySubscriptions(),     // รายจ่ายส่วนตัว (เดี่ยว)
      DB.getDashboard(),           // ยอดรวมรายปี
    ]);
    const mRows = new Map(memberGroups.map(m => [m.group_id, m]));
    const groupRows: Row[] = groups.map(g => {
      const pi = priceInfo(g, todayTH());                       // ราคา/ช่องที่มีผลจริง (ตรงกับหน้า Member)
      const mr = mRows.get(g.group_id);
      return {
        kind: 'group', id: g.group_id, name: g.service_name, category: g.category,
        amount: pi.now / Math.max(1, pi.slotsNow),              // ส่วนของคุณ (หารต่อหัว)
        role: g.role, state: g.role === 'Host' ? 'host' : (mr?.state ?? 'pending'),
        memberCount: g.memberCount, maxSlots: g.max_slots,
        due: mr ? memberDue(mr) : dueMetaOf(g), group: g,
      } as Row;
    });
    const soloRows: Row[] = subs.filter(s => !s.end_date).map(s => ({
      kind: 'solo', id: s.sub_id, name: s.service_name, category: s.category,
      amount: Number(s.price), due: dueMetaOf(s), sub: s,
    }));
    const all = [...groupRows, ...soloRows];
    setRows(all);
    setMonthTotal(all.reduce((sum, r) => sum + r.amount, 0));
    setYearTotal(dash.yearTotal);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'all' ? rows : rows.filter(r => r.category === filter);

  /* นำทางตามบทบาท: Host จัดการกลุ่ม, Member ดูอย่างเดียว, เดี่ยวไปหน้าแก้ไข/ลบ */
  const goto = (r: Row) => {
    if (r.kind === 'solo') { navigate('/sub/' + r.id); return; }
    navigate(r.role === 'Host' ? '/group/' + r.id : '/member/group/' + r.id);
  };

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
            visible.map(r => (
              <div key={r.id} className="gcard" tabIndex={0} role="button"
                onClick={() => goto(r)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goto(r); } }}>
                <div className="gtop">
                  <div className={'logo cat-' + r.category}><CategoryIcon category={r.category} /></div>
                  <div className="gname">
                    <b>{r.name}</b>
                    <div className="svc-tags">
                      <span className={'ktag' + (r.kind === 'group' ? '' : ' solo')}>
                        {r.kind === 'group' ? Icon.people : Icon.person}
                        {r.kind === 'group' ? 'กลุ่ม' : 'เดี่ยว'}
                      </span>
                      {r.kind === 'group' && (
                        <span className={'rolechip ' + (r.role === 'Host' ? 'host' : 'member')}>
                          {r.role === 'Host' ? 'Host' : 'Member'}
                        </span>
                      )}
                    </div>
                    <span className={'duechip' + (r.due.urgent ? ' u' : '')}>{Icon.cal}{r.due.text}</span>
                  </div>
                  <span className={'badge cat-' + r.category}>{CATEGORY_LABEL[r.category]}</span>
                </div>
                <div className="gbot">
                  <span className="seats">
                    {r.kind === 'group'
                      ? <>สมาชิก <b>{r.memberCount}/{r.maxSlots}</b> คน
                          <span className={'statechip ' + STATE_BADGE[r.state].cls}>{STATE_BADGE[r.state].text}</span></>
                      : <>รายจ่ายส่วนตัว · ชำระเอง</>}
                  </span>
                  <span className="amt">{baht2(r.amount)} บาท</span>
                </div>
              </div>
            ))
          )}

          {!loading && DevPanels && (
            <Suspense fallback={null}>
              <DevPanels.Services show={show} reload={load} />
            </Suspense>
          )}
        </div>
      </main>

      {!loading && (
        <button className="fab" onClick={() => setAdding(true)}>
          {Icon.add}<span>เพิ่มบริการใหม่</span>
        </button>
      )}

      <NavBar current="service" />
      {toast}

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
