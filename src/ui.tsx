/* =====================================================================
   SubSub · shared UI helpers · ui.tsx
   ไอคอน SVG + hook แสดง toast — ใช้ร่วมกันทุกหน้า
   ===================================================================== */
import { useState, useCallback } from 'react';

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
  person: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" /></svg>
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
  return (
    <nav className="nav">
      <button aria-current={current === 'service' ? 'page' : undefined}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
        บริการ
      </button>
      <button aria-current={current === 'group' ? 'page' : undefined}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M17 14c2.2 0 3.8 1.5 3.8 3.5" /></svg>
        กลุ่ม
      </button>
      <button aria-current={current === 'overview' ? 'page' : undefined}>
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

/* ---------- map หมวดหมู่ → ไอคอน ---------- */
export const CATEGORY_ICON: Record<string, string> = {
  Entertainment: '🎬', Music: '🎵', Productivity: '💼', Other: '📦',
};

/* ---------- format เงิน ---------- */
export const baht = (n: string | number) =>
  Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 });
export const baht2 = (n: string | number) =>
  Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });