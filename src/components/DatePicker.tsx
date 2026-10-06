/* =====================================================================
   SubSub · ปฏิทินเลือกวัน (ดีไซน์ Figma แบบ iOS) · components/DatePicker.tsx
   ---------------------------------------------------------------------
   ใช้แทน <input type="date"> ในโหมด "รายปี"
   props:
     value    — ค่าปัจจุบัน YYYY-MM-DD (หรือ '')
     onChange — คืนค่า YYYY-MM-DD เมื่อเลือกวัน
   ===================================================================== */
import { useState, useRef, useEffect } from 'react';
import { fmtDateTH } from '../lib/date';
import { todayTH } from '../lib/clock';

/* [B6] แปลง 'YYYY-MM-DD' เป็น Date แบบ local (ไม่ผ่าน UTC) → วันไม่เลื่อนในทุก timezone */
const localDate = (iso: string): Date => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function DatePicker({ value, onChange, invalid }: {
  value: string; onChange: (v: string) => void; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // วันที่ที่กำลังดู (ค่าเริ่มจาก value หรือวันนี้)
  const init = localDate(value || todayTH());
  const [viewY, setViewY] = useState(init.getFullYear());
  const [viewM, setViewM] = useState(init.getMonth());   // 0-11

  const selected = value ? localDate(value) : null;

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const firstDow = new Date(viewY, viewM, 1).getDay();   // 0=Sun

  const pick = (day: number) => {
    const mm = String(viewM + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewY}-${mm}-${dd}`);
    setOpen(false);
  };

  const isSelected = (day: number) =>
    selected && selected.getFullYear() === viewY && selected.getMonth() === viewM && selected.getDate() === day;

  // ข้อความในช่อง (แสดง d MMM yyyy หรือ placeholder)
  const label = value
    ? fmtDateTH(value)
    : 'เลือกวันที่';

  // เลื่อนเดือน
  const prevMonth = () => { if (viewM === 0) { setViewM(11); setViewY(y => y - 1); } else setViewM(m => m - 1); };
  const nextMonth = () => { if (viewM === 11) { setViewM(0); setViewY(y => y + 1); } else setViewM(m => m + 1); };

  const years = Array.from({ length: 11 }, (_, i) => viewY - 3 + i);

  return (
    <div className="dp" ref={wrapRef}>
      <button type="button" className={'dp-input' + (invalid ? ' invalid' : '') + (value ? '' : ' placeholder')}
        onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </button>

      {open && (
        <div className="dp-pop">
          <div className="dp-head">
            <div className="dp-sel">
              <select value={viewM} onChange={e => setViewM(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={viewY} onChange={e => setViewY(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="dp-nav">
              <button type="button" onClick={prevMonth} aria-label="เดือนก่อน">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button type="button" onClick={nextMonth} aria-label="เดือนถัดไป">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>

          <div className="dp-dow">
            {DOW.map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="dp-grid">
            {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <button type="button" key={day}
                className={'dp-day' + (isSelected(day) ? ' on' : '')}
                onClick={() => pick(day)}>
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}