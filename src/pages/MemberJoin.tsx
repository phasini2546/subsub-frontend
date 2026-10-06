/* =====================================================================
   SubSub · เข้าร่วมกลุ่ม (Member) · pages/MemberJoin.tsx
   ---------------------------------------------------------------------
   กรอกรหัสคำเชิญ แล้วค้นหากลุ่มจาก DB จริง ถ้าพบ → ไปหน้าชำระเงิน /member/pay?gid=<id>
     • เป็นสมาชิกอยู่แล้ว → ไปหน้ารายละเอียดกลุ่ม
     • กลุ่มเต็ม (นับคนที่รออนุมัติด้วย) / ไม่พบรหัส → แจ้ง error
   [B11] รหัสสาธิต (DISNEY-99 ฯลฯ) ทำงานเฉพาะตอน dev ผ่าน src/dev — production ไม่มีโค้ดนี้
   ===================================================================== */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui';
import { DB } from '../db';
import { MIcon } from './MemberUI';
import { DEV_TOOLS, resolveDemoCode } from '../dev';

/* ขั้นตอนขอรหัสจากโฮสต์ (ข้อความจริงของหน้า ไม่ใช่ mock) */
const CODE_INSTRUCTIONS = [
  'ติดต่อหัวหน้ากลุ่ม (Host) ที่คุณต้องการร่วมทีม',
  'ขอรหัสคำเชิญ 8 หลัก (รูปแบบ XXXX-XXXX) จากหน้ารายละเอียดกลุ่มของโฮสต์',
  'นำรหัสมากรอกในช่องด้านบนและกดปุ่มเข้าร่วม',
];
const MSG_FULL = 'ขออภัยในความไม่สะดวก ขณะนี้กลุ่มมีจำนวนสมาชิกเต็มแล้ว';
const MSG_WRONG = 'ไม่พบรหัสคำเชิญนี้ กรุณาตรวจสอบความถูกต้องแล้วลองใหม่อีกครั้ง';

export default function MemberJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const normalized = code.replace(/[#\s-]/g, '').toUpperCase();
    if (!normalized) { setError('กรุณากรอกรหัสคำเชิญก่อนเข้าร่วม'); return; }
    setBusy(true);
    try {
      // รหัสจริงจากกลุ่มที่โฮสต์สร้าง → (dev เท่านั้น) รหัสสาธิต
      const g = DB.findGroupByCode(normalized) ?? await resolveDemoCode(normalized);
      if (!g) { setError(MSG_WRONG); return; }
      const st = DB.memberJoinStatus(g.group_id);
      if (st === 'already') { navigate('/member/group/' + g.group_id); return; }
      if (st === 'full') { setError(MSG_FULL); return; }
      if (st === 'notfound') { setError(MSG_WRONG); return; }
      navigate('/member/pay?gid=' + g.group_id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/groups')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>เข้าร่วมกลุ่ม</h1>
      </header>

      <main className="mscreen">
        {/* กรอกรหัส */}
        <div className="joincard">
          <label>กรอกรหัสคำเชิญ</label>
          <input
            value={code}
            onChange={e => { setCode(e.target.value); if (error) setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="#XXXX-XXXX"
            className={'codeinput' + (error ? ' invalid' : '')}
          />
          {error && (
            <div className="joinerr">{MIcon.alert}<p>{error}</p></div>
          )}
          <button className="joinbtn" onClick={submit} disabled={busy}>เข้าร่วมเลย{MIcon.arrow}</button>
          {DEV_TOOLS && <p className="joinhint">(dev) รหัสสาธิต: <b>DISNEY-99</b> · เต็ม: <b>NFLX-2026</b> · กลางรอบ: <b>SPOTIFY-7</b></p>}
        </div>

        {/* วิธีรับรหัสจากโฮสต์ */}
        <div className="howcard">
          <div className="howcard-h">
            <span className="howcard-ic">{MIcon.help}</span>
            <div style={{ flex: 1 }}>
              <h3>วิธีรับรหัสจากโฮสต์</h3>
              <ol className="howsteps">
                {CODE_INSTRUCTIONS.map((step, i) => (
                  <li key={i}>
                    <span className="n">{i + 1}</span>
                    <span className="t">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
