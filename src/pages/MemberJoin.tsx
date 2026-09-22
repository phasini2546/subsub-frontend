/* =====================================================================
   SubSub · เข้าร่วมกลุ่ม (Member) · pages/MemberJoin.tsx
   ---------------------------------------------------------------------
   พอร์ตจากหน้าจอ 02/03/04/08 (25 ส.ค.) — กรอกรหัสคำเชิญ
   • DISNEY-99  → ไปหน้าชำระเงิน /member/pay
   • NFLX-2026  → กลุ่มเต็ม
   • รหัสอื่น    → รหัสไม่ถูกต้อง
   ===================================================================== */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../ui';
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

  const normalized = code.replace(/[#\s]/g, '').toUpperCase();

  const submit = () => {
    if (!normalized) { setError('กรุณากรอกรหัสคำเชิญก่อนเข้าร่วม'); return; }
    if (normalized === FULL_CODE.replace(/-/g, '') || normalized === FULL_CODE) {
      setError('ขออภัยในความไม่สะดวก ขณะนี้กลุ่มมีจำนวนสมาชิกเต็มแล้ว'); return;
    }
    if (normalized === VALID_CODE.replace(/-/g, '') || normalized === VALID_CODE) {
      navigate('/member/pay'); return;
    }
    setError('กรุณาตรวจสอบความถูกต้องของรหัสผ่านแล้วลองใหม่อีกครั้ง');
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
