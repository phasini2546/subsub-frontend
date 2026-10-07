/* =====================================================================
   SubSub · shared UI helpers · ui.tsx
   ไอคอน SVG + hook แสดง toast — ใช้ร่วมกันทุกหน้า
   ===================================================================== */
import { useState, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Category } from './types';
import logoUrl from './assets/logo.png';

/* ---------- โลโก้แบรนด์ (มุมซ้ายบนของหน้าหลัก) ---------- */
export function BrandLogo() {
  return <img src={logoUrl} alt="SubSub" className="brand-logo" />;
}

/* ---------- ไอคอน SVG (เหมือนดีไซน์ Figma) ---------- */
export const Icon = {
  back: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
  ),
  copy: (
    <svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  add: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  bell: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
  ),
  info: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" /></svg>
  ),
  bang: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 7v6" /><path d="M12 17h.01" /></svg>
  ),
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>
  ),
  person: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" /></svg>
  ),
  people: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  cal: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  ),
};

/* ---------- nav bar (บริการ / กลุ่ม / ภาพรวม) ---------- */
export function NavBar({ current = 'group' }: { current?: string }) {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <button aria-current={current === 'service' ? 'page' : undefined} onClick={() => navigate('/service')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
        บริการ
      </button>
      <button aria-current={current === 'group' ? 'page' : undefined} onClick={() => navigate('/groups')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M17 14c2.2 0 3.8 1.5 3.8 3.5" /></svg>
        กลุ่ม
      </button>
      <button aria-current={current === 'overview' ? 'page' : undefined} onClick={() => navigate('/dashboard')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
        ภาพรวม
      </button>
    </nav>
  );
}

/* ---------- hook แสดง toast ---------- */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2600);
  }, []);
  const node = <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>;
  return { show, node };
}


/* ---------- format เงิน ---------- */
export const baht = (n: string | number) =>
  Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const baht2 = (n: string | number) =>
  Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* ---------- ตัวเลือกหมวดหมู่แบบแถว (ดีไซน์ Figma ใหม่) ---------- */
const CAT_ICON: Record<Category, ReactNode> = {
  Entertainment: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" /><path d="m3.5 8 3-4 3.2 3.4M9.7 3.4l3.2 3.4M15.6 3.1l3 3.5" /></svg>
  ),
  Music: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
  ),
  Productivity: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
  ),
  Other: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
  ),
};
/* ---------- ไอคอนหมวดหมู่ (SVG ไล่เฉดเขียว-ทอง) — ใช้ในการ์ด/หัวข้อ ---------- */
const CAT_PATHS: Record<Category, ReactNode> = {
  Entertainment: (<><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" /><path d="m3.5 8 3-4 3.2 3.4M9.7 3.4l3.2 3.4M15.6 3.1l3 3.5" /></>),
  Music: (<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>),
  Productivity: (<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>),
  Other: (<><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></>),
};
export function CategoryIcon({ category }: { category: Category }) {
  const fillMode = category === 'Other';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24"
      fill={fillMode ? 'url(#catGrad)' : 'none'}
      stroke={fillMode ? 'none' : 'url(#catGrad)'}
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="catGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="1.5%" stopColor="#77C200" />
          <stop offset="99.5%" stopColor="#E5A000" />
        </linearGradient>
      </defs>
      {CAT_PATHS[category] ?? CAT_PATHS.Other}
    </svg>
  );
}

const CAT_ROWS: { key: Category; label: string }[] = [
  { key: 'Entertainment', label: 'บันเทิง' },
  { key: 'Music', label: 'เพลง' },
  { key: 'Productivity', label: 'งาน' },
  { key: 'Other', label: 'อื่น ๆ' },
];

export function CategoryPicker({ value, onChange }: {
  value: Category | ''; onChange: (c: Category) => void;
}) {
  return (
    <div className="catlist">
      {CAT_ROWS.map(c => (
        <button type="button" key={c.key} className="catrow"
          aria-pressed={value === c.key} onClick={() => onChange(c.key)}>
          <span className="catic">{CAT_ICON[c.key]}</span>
          <span className="catlbl">{c.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- กล่องแจ้งเตือน (เส้นขอบ + ไอคอน !) ---------- */
export function ReminderAlert({ text }: { text: string }) {
  return (
    <div className="remind" role="note">
      <span className="remind-ic">{Icon.bang}</span>
      <span>{text}</span>
    </div>
  );
}
