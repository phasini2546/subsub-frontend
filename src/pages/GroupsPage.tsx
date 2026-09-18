/* =====================================================================
   SubSub · หน้ากลุ่ม (รายการ + empty) · pages/GroupsPage.tsx
   แปลงจาก groups.html + groups.js — รองรับ 2 โรล (host/member)
   ===================================================================== */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB, priceInfo } from '../db';
import type { GroupRow, Role } from '../types';
import { Icon, NavBar, useToast, CATEGORY_ICON, baht, BrandLogo } from '../ui';

type TabRole = 'host' | 'member';

export default function GroupsPage() {
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ host: GroupRow[]; member: GroupRow[] }>({ host: [], member: [] });
  const [tab, setTab] = useState<TabRole>('host');

  /* โหลดกลุ่มของฉัน แล้วแยกตาม role */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const all = await DB.getMyGroups();          // GET /api/my-groups
      setRows({
        host: all.filter(g => g.role === ('Host' as Role)),
        member: all.filter(g => g.role === ('Member' as Role)),
      });
      setLoading(false);
    })();
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    show('คัดลอกรหัส #' + code + ' แล้ว ส่งให้เพื่อนทาง LINE ได้เลย');
  };

  const list = rows[tab];
  const isHost = tab === 'host';

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
        ) : list.length === 0 ? (
          <div className="empty">
            <p>{isHost
              ? 'ดูเหมือนว่าคุณยังไม่ได้สร้างกลุ่ม กรุณาสร้างกลุ่มเพื่อเริ่มต้นใช้งาน'
              : 'ดูเหมือนว่าคุณยังไม่ได้เข้าร่วมกลุ่ม กรุณาเข้าร่วมกลุ่มเพื่อเริ่มต้นใช้งาน'}</p>
          </div>
        ) : (
          <div className="wrap">
            {list.map(g => (
              <div
                key={g.group_id}
                className="gcard"
                tabIndex={0}
                role="button"
                onClick={() => navigate('/group/' + g.group_id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/group/' + g.group_id); } }}
              >
                <div className="gtop">
                  <div className="logo">{CATEGORY_ICON[g.category] || '📦'}</div>
                  <div className="gname">
                    <b>{g.service_name}</b>
                    <span className="codechip">
                      <span>#{g.invite_code}</span>
                      {isHost && (
                        <button onClick={e => { e.stopPropagation(); copyCode(g.invite_code); }} aria-label="คัดลอกรหัสเชิญ">
                          {Icon.copy}
                        </button>
                      )}
                    </span>
                  </div>
                  <span className="badge">ACTIVE</span>
                </div>
                <div className="gbot">
                  <span className="seats">สมาชิกปัจจุบัน <b>{g.memberCount}/{g.max_slots}</b> คน</span>
                  <span className="amt">{baht(priceInfo(g).now)} บาท</span>
                </div>
              </div>
            ))}
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