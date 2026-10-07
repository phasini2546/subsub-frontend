/* =====================================================================
   SubSub · หน้าวิธีใช้งาน (How to use) · pages/HowToPage.tsx
   ดีไซน์ใหม่: การ์ดขั้นตอนแบบมีไอคอนภาพประกอบ ข้อความสั้น อ่านง่าย
   เปิดจากไอคอน ! มุมขวาบนของหน้าบริการ
   ===================================================================== */
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon, NavBar } from '../ui';

/* ---- ไอคอนภาพประกอบ (เส้นไล่เฉดเขียว→ทอง เข้าธีมแบรนด์) ---- */
const gi = (d: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#htGrad)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const G = {
  people: gi(<><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M3 19c0-3 2-4.6 5-4.6s5 1.6 5 4.6M13.4 14.6c2.7.2 4.6 1.8 4.6 4.4" /></>),
  money: gi(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.4" /><path d="M5 10v4M19 10v4" /></>),
  filter: gi(<path d="M4 5h16l-6 7v5l-4-2v-3z" />),
  add: gi(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  tap: gi(<><rect x="3" y="4" width="13" height="13" rx="2" /><circle cx="16.5" cy="16.5" r="3.4" /><path d="M19 19l2 2" /></>),
  key: gi(<><circle cx="8" cy="8" r="4" /><path d="M11 11l8 8M16 18l2-2M19 15l-2 2" /></>),
  toggle: gi(<><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" /><circle cx="16" cy="12" r="4.4" fill="url(#htGrad)" stroke="none" /></>),
  code: gi(<><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7.5 12h.01M12 12h.01M16.5 12h.01" /></>),
  check: gi(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>),
  addppl: gi(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5" /><path d="M18 7v6M15 10h6" /></>),
  form: gi(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  share: gi(<><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="M8.3 10.9l6.4-3.6M8.3 13.1l6.4 3.6" /></>),
  bell: gi(<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></>),
  chart: gi(<><path d="M5 20V11M11 20V5M17 20v-6" /><path d="M3 20h18" /></>),
};
type GKey = keyof typeof G;
type Step = { ic: GKey; tx: string; sub?: string };
type Flow = { tag: string; title: string; steps: Step[] };

const FLOWS: Flow[] = [
  {
    tag: 'บริการ', title: 'ดูค่าใช้จ่ายของคุณ', steps: [
      { ic: 'money', tx: 'ดูยอดรวมเดือน/ปี', sub: 'จากการ์ดด้านบน' },
      { ic: 'filter', tx: 'กรองตามหมวดหมู่', sub: 'แตะชิปหมวด' },
      { ic: 'add', tx: 'เพิ่มบริการที่จ่ายเดี่ยว', sub: 'ปุ่ม + เพิ่มบริการ' },
      { ic: 'tap', tx: 'แตะการ์ดดูรายละเอียด', sub: 'แก้ไข / ลบ ได้' },
    ],
  },
  {
    tag: 'สมาชิก', title: 'เข้าร่วมกลุ่ม', steps: [
      { ic: 'key', tx: 'ขอรหัสจากโฮสต์' },
      { ic: 'toggle', tx: 'แท็บกลุ่ม → MEMBER', sub: 'กด "เข้าร่วมกลุ่ม"' },
      { ic: 'code', tx: 'กรอกรหัส ส่งคำขอ' },
      { ic: 'check', tx: 'โฮสต์อนุมัติ = จ่ายแล้ว' },
    ],
  },
  {
    tag: 'โฮสต์', title: 'สร้างกลุ่มใหม่', steps: [
      { ic: 'addppl', tx: 'แท็บกลุ่ม → HOST', sub: 'กด "สร้างกลุ่มใหม่"' },
      { ic: 'form', tx: 'กรอกบริการ ราคา บัญชี' },
      { ic: 'share', tx: 'แชร์รหัส + ตรวจสลิป' },
    ],
  },
];

const NOTES: Step[] = [
  { ic: 'bell', tx: 'เตือนล่วงหน้า 3 วัน', sub: 'ก่อนถึงวันตัดรอบ' },
  { ic: 'chart', tx: 'ดูแนวโน้มที่แท็บ "ภาพรวม"' },
];

function StepRow({ s, n, sm }: { s: Step; n?: number; sm?: boolean }) {
  return (
    <div className="ht-step">
      {n !== undefined && <span className="ht-n">{n}</span>}
      <span className={'ht-ic' + (sm ? ' sm' : '')}>{G[s.ic]}</span>
      <span className="ht-tx">{s.tx}{s.sub && <small>{s.sub}</small>}</span>
    </div>
  );
}

export default function HowToPage() {
  const navigate = useNavigate();
  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/service')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>วิธีใช้งาน</h1>
      </header>

      <main className="screen">
        <div className="wrap">
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <defs>
              <linearGradient id="htGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="1.5%" stopColor="#77C200" />
                <stop offset="99.5%" stopColor="#E5A000" />
              </linearGradient>
            </defs>
          </svg>

          <div className="ht-hero">
            <span className="ht-hero-ic">{G.people}</span>
            <div><b>แชร์ค่าสมาชิกกับเพื่อน</b><p>ติดตามรายจ่ายทั้งหมดในที่เดียว</p></div>
          </div>

          {FLOWS.map((f, i) => (
            <section className="ht-flow" key={i}>
              <div className="ht-flow-h"><span className="ht-tag">{f.tag}</span><h2>{f.title}</h2></div>
              <div className="ht-steps">
                {f.steps.map((s, j) => <StepRow key={j} s={s} n={j + 1} />)}
              </div>
            </section>
          ))}

          <div className="ht-note">
            {NOTES.map((s, j) => <StepRow key={j} s={s} sm />)}
          </div>
        </div>
      </main>

      <NavBar current="service" />
    </div>
  );
}
