/* =====================================================================
   SubSub · หน้าวิธีใช้งาน (How to use) · pages/HowToPage.tsx
   เปิดจากไอคอน ! มุมขวาบนของหน้าบริการ
   ===================================================================== */
import { useNavigate } from 'react-router-dom';
import { Icon, NavBar } from '../ui';

const SECTIONS: { title: string; steps: string[] }[] = [
  {
    title: 'บริการของคุณ (หน้าบริการ)',
    steps: [
      'ดูค่าใช้จ่ายรวมของเดือนนี้และรายปีได้จากการ์ดด้านบน',
      'กรองรายการตามหมวดหมู่ด้วยแถบชิปด้านล่างการ์ดสรุป',
      'กด “+ เพิ่มบริการใหม่” เพื่อบันทึกรายจ่ายส่วนตัว (บริการที่คุณจ่ายคนเดียว)',
      'รายการแบบเดี่ยวสามารถกด “แก้ไข” หรือ “ลบ” ได้ ส่วนกลุ่มให้แตะการ์ดเพื่อดูรายละเอียด',
    ],
  },
  {
    title: 'เข้าร่วมกลุ่ม (สมาชิก)',
    steps: [
      'ขอรหัสคำเชิญจากโฮสต์ของกลุ่ม',
      'ไปที่แท็บ “กลุ่ม” → สลับไป MEMBER → กดปุ่ม “เข้าร่วมกลุ่ม”',
      'กรอกรหัสแล้วกดเข้าร่วม ระบบจะส่งคำขอไปให้โฮสต์อนุมัติ',
      'เมื่อโฮสต์อนุมัติสลิป สถานะของคุณจะเปลี่ยนเป็น “จ่ายแล้ว”',
    ],
  },
  {
    title: 'สร้างกลุ่ม (โฮสต์)',
    steps: [
      'ไปที่แท็บ “กลุ่ม” → HOST → “สร้างกลุ่มใหม่”',
      'กรอกรายละเอียดบริการ ราคา จำนวนสมาชิก หมวดหมู่ และบัญชีธนาคาร',
      'แชร์รหัสคำเชิญให้เพื่อน แล้วอนุมัติ/ปฏิเสธสลิปในหน้ารายละเอียดกลุ่ม',
    ],
  },
  {
    title: 'การแจ้งเตือน',
    steps: [
      'ระบบจะช่วยเตือนคุณก่อนถึงวันตัดรอบบิล 3 วัน',
      'ดูภาพรวมค่าใช้จ่ายและแนวโน้มย้อนหลังได้ที่แท็บ “ภาพรวม”',
    ],
  },
];

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
          <div className="remind" style={{ marginTop: 0, marginBottom: 20 }}>
            <span className="remind-ic">{Icon.bang}</span>
            <span>SubSub ช่วยคุณแชร์ค่าบริการกับเพื่อน และติดตามรายจ่ายสมัครสมาชิกทั้งหมดในที่เดียว</span>
          </div>

          {SECTIONS.map((s, i) => (
            <div className="dash-card" key={i}>
              <div className="dash-card-title">{s.title}</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s.steps.map((t, j) => (
                  <li key={j} style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{t}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </main>

      <NavBar current="service" />
    </div>
  );
}
