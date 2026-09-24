/* =====================================================================
   SubSub · หน้ากลุ่ม (รายการ + empty) · pages/GroupsPage.tsx
   แปลงจาก groups.html + groups.js — รองรับ 2 โรล (host/member)
     • HOST   : กลุ่มที่ฉันเป็นเจ้าของ (จาก DB.getMyGroups)
     • MEMBER : การ์ดกลุ่มที่ฉันเข้าร่วม (จาก DB.getMemberGroups) —
                โชว์ราคาเต็ม + ราคาหารต่อหัว + สถานะ (รอตรวจสอบ/ACTIVE)  (ข้อ 6,8)
   ===================================================================== */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB, priceInfo, nextDueDate, daysUntilDue } from '../db';
import type { MemberGroupRow } from '../db';
import type { GroupRow, Role } from '../types';
import { Icon, NavBar, useToast, CATEGORY_ICON, baht, BrandLogo } from '../ui';

type TabRole = 'host' | 'member';

export default function GroupsPage() {
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [hostRows, setHostRows] = useState<GroupRow[]>([]);
  const [memberRows, setMemberRows] = useState<MemberGroupRow[]>([]);
  const [tab, setTab] = useState<TabRole>('host');

  /* โหลดกลุ่มของฉัน: HOST จาก DB, MEMBER จาก store ฝั่งสมาชิก */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const all = await DB.getMyGroups();          // GET /api/my-groups
      setHostRows(all.filter(g => g.role === ('Host' as Role)));
      setMemberRows(await DB.getMemberGroups());
      setLoading(false);
    })();
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    show('คัดลอกรหัส #' + code + ' แล้ว ส่งให้เพื่อนทาง LINE ได้เลย');
  };

  const isHost = tab === 'host';
  const isEmpty = isHost ? hostRows.length === 0 : memberRows.length === 0;

  return (
    <div className="phone">
      <header className="topbar"><BrandLogo /></header>

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'host'} onClick={() => setTab('host')}>HOST</button>
        <button role="tab" aria-selected={tab === 'member'} onClick={() => setTab('member')}>MEMBER</button>
      </div>

      <main className="screen">
        {loading ? (
          <div className="wrap">
            {[0, 1].map(i => (
              <div className="skel-card" key={i}>
                <div className="skel-row">
                  <div className="skel logo" />
                  <div style={{ flex: 1 }}>
                    <div className="skel line" style={{ width: '55%', marginBottom: 10 }} />
                    <div className="skel line" style={{ width: '35%', height: 11 }} />
                  </div>
                </div>
                <div className="skel line" style={{ width: '100%', height: 12 }} />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="empty">
            <p>{isHost
              ? 'ดูเหมือนว่าคุณยังไม่ได้สร้างกลุ่ม กรุณาสร้างกลุ่มเพื่อเริ่มต้นใช้งาน'
              : 'ดูเหมือนว่าคุณยังไม่ได้เข้าร่วมกลุ่ม กรุณาเข้าร่วมกลุ่มเพื่อเริ่มต้นใช้งาน'}</p>
          </div>
        ) : isHost ? (
          <div className="wrap">
            {hostRows.map(g => (
              <div
                key={g.group_id}
                className="gcard"
                tabIndex={0}
                role="button"
                onClick={() => navigate('/group/' + g.group_id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/group/' + g.group_id); } }}
              >
                <div className="gtop">
                  <div className={'logo cat-' + g.category}>{CATEGORY_ICON[g.category] || '📦'}</div>
                  <div className="gname">
                    <b>{g.service_name}</b>
                    <span className="codechip">
                      <span>#{g.invite_code}</span>
                      <button onClick={e => { e.stopPropagation(); copyCode(g.invite_code); }} aria-label="คัดลอกรหัสเชิญ">
                        {Icon.copy}
                      </button>
                    </span>
                  </div>
                  <span className="badge">ACTIVE</span>
                </div>
                <div className="gbot">
                  <span className="seats">สมาชิกปัจจุบัน <b>{g.memberCount}/{g.max_slots}</b> คน</span>
                  <span className="amt">{baht(priceInfo(g).now)} บาท</span>
                </div>
                {isHost && (() => {
                  const days = daysUntilDue(g.billing_date);
                  const dt = nextDueDate(g.billing_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' });
                  const msg = days < 0 ? `เลยกำหนดชำระ ${Math.abs(days)} วัน`
                    : days === 0 ? 'ครบกำหนดชำระวันนี้'
                    : `ครบกำหนด ${dt} · อีก ${days} วัน`;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10,
                      fontSize: 12, fontWeight: 600, color: days <= 3 ? 'var(--red)' : 'var(--ink-2)' }}>
                      {Icon.cal}<span>{msg}</span>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          /* ---- แท็บ MEMBER: กลุ่มที่เข้าร่วม (ราคาเต็ม + ราคาหาร + สถานะ) ---- */
          <div className="wrap">
            {memberRows.map(c => {
              const badge = c.state === 'joined'
                ? { cls: 'gbadge-active', text: 'เข้าร่วมแล้ว' }
                : c.state === 'leaving'
                  ? { cls: 'gbadge-leave', text: 'กำลังจะออก' }
                  : c.state === 'rejected'
                    ? { cls: 'gbadge-reject', text: 'ถูกปฏิเสธ' }
                    : { cls: 'gbadge-wait', text: 'รออนุมัติ' };
              return (
                <div
                  key={c.group_id}
                  className="gcard"
                  tabIndex={0}
                  role="button"
                  onClick={() => navigate('/member/group/' + c.group_id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/member/group/' + c.group_id); } }}
                >
                  <div className="gtop">
                    <div className={'logo cat-' + c.category}>{CATEGORY_ICON[c.category] || '📦'}</div>
                    <div className="gname">
                      <b>{c.service_name}</b>
                      <span className="mmeta"><span>สมาชิก {c.memberCount}/{c.max_slots} คน</span></span>
                      {c.state === 'joined' && (
                        <span className={'duechip' + (c.dueUrgent ? ' u' : '')}>{Icon.cal}{c.dueText}</span>
                      )}
                    </div>
                    <span className={'badge ' + badge.cls}>{badge.text}</span>
                  </div>
                  <div className="gbot">
                    <span className="seats">ยอดที่คุณต้องจ่าย/เดือน</span>
                    <span className="mshare">{baht(c.share)} <small>บาท</small></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ปุ่มลอย: host = สร้างกลุ่ม / member = เข้าร่วมกลุ่ม */}
      {!loading && (
        <button className="fab" onClick={() => navigate(isHost ? '/create' : '/join')}>
          {Icon.add}
          <span>{isHost ? 'สร้างกลุ่มใหม่' : 'เข้าร่วมกลุ่ม'}</span>
        </button>
      )}

      <NavBar current="group" />
      {toast}
    </div>
  );
}
