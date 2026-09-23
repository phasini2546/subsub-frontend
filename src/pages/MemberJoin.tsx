/* =====================================================================
   SubSub · เข้าร่วมกลุ่ม (Member) · pages/MemberJoin.tsx
   ---------------------------------------------------------------------
   กรอกรหัสคำเชิญ แล้วค้นหากลุ่มจาก DB จริง (รองรับรหัสจากกลุ่มที่โฮสต์สร้าง
   และรหัสสาธิต DISNEY-99). ถ้าพบ → ไปหน้าชำระเงิน /member/pay?gid=<id>
     • เป็นสมาชิกอยู่แล้ว → ไปหน้ารายละเอียดกลุ่ม
     • กลุ่มเต็ม / ไม่พบรหัส → แจ้ง error
   ===================================================================== */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../ui';
import { DB } from '../db';
import { MIcon } from './MemberUI';
import { codeInstructions, VALID_CODE, FULL_CODE } from '../memberMock';

export default function MemberJoin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('err') ? '#NFLX-2026' : '');
  const [error, setError] = useState(
    params.get('err') === 'full'
      ? 'ขออภัยในความไม่สะดวก ขณะนี้กลุ่มมีจำนวนสมาชิกเต็มแล้ว'
      : params.get('err') === 'wrong'
        ? 'กรุณาตรวจสอบความถูกต้องของรหัสผ่านแล้วลองใหม่อีกครั้ง'
        : '',
  );

  const submit = () => {
    const normalized = code.replace(/[#\s]/g, '').toUpperCase();
    if (!normalized) { setError('กรุณากรอกรหัสคำเชิญก่อนเข้าร่วม'); return; }

    // รหัสสาธิต "กลุ่มเต็ม"
    if (normalized === FULL_CODE.replace(/-/g, '')) {
      setError('ขออภัยในความไม่สะดวก ขณะนี้กลุ่มมีจำนวนสมาชิกเต็มแล้ว'); return;
    }
    // รหัสสาธิต DISNEY-99 → สร้าง/หา กลุ่มสาธิตใน DB ก่อน
    if (normalized === VALID_CODE.replace(/-/g, '')) {
      const g = DB.ensureDemoDisney();
      routeToGroup(g.group_id);
      return;
    }
    // รหัสจริงจากกลุ่มที่โฮสต์สร้าง
    const g = DB.findGroupByCode(normalized);
    if (!g) { setError('กรุณาตรวจสอบความถูกต้องของรหัสผ่านแล้วลองใหม่อีกครั้ง'); return; }
    routeToGroup(g.group_id);
  };

  const routeToGroup = (gid: string) => {
    const st = DB.memberJoinStatus(gid);
    if (st === 'already') { navigate('/member/group/' + gid); return; }
    if (st === 'full') { setError('ขออภัยในความไม่สะดวก ขณะนี้กลุ่มมีจำนวนสมาชิกเต็มแล้ว'); return; }
    navigate('/member/pay?gid=' + gid);
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
          <button className="joinbtn" onClick={submit}>เข้าร่วมเลย{MIcon.arrow}</button>
          <p className="joinhint">ตัวอย่างรหัสที่ใช้ได้: <b>{VALID_CODE}</b></p>
        </div>

        {/* วิธีรับรหัสจากโฮสต์ */}
        <div className="howcard">
          <div className="howcard-h">
            <span className="howcard-ic">{MIcon.help}</span>
            <div style={{ flex: 1 }}>
              <h3>วิธีรับรหัสจากโฮสต์</h3>
              <ol className="howsteps">
                {codeInstructions.map((step, i) => (
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
