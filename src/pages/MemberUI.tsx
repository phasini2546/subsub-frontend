/* =====================================================================
   SubSub · ชิ้นส่วน UI ฝั่ง Member · pages/MemberUI.tsx
   ---------------------------------------------------------------------
   พอร์ตจากคอมโพเนนต์เวอร์ชัน 25 ส.ค. (PaymentBits/SlipUploader/
   BottomSheet/ResultOverlay) — โครง & สำเนาเดิม, สไตล์ตาม App.css
   ===================================================================== */
import { useRef, useState, type ReactNode } from 'react';
import { useToast } from '../ui';
import { payee } from '../memberMock';

/* ---------- ไอคอนเฉพาะฝั่ง Member ---------- */
export const MIcon = {
  info: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" /></svg>
  ),
  alert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>
  ),
  arrow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  help: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
  ),
  landmark: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M4 10h16M5 6l7-3 7 3M6 10v11M10 10v11M14 10v11M18 10v11" /></svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  upload: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
  ),
  imageup: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M14 4h6M17 1v6M4 16l4-4a2 2 0 0 1 2.8 0L15 16" /><circle cx="9" cy="9" r="1.4" /></svg>
  ),
  filecheck: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  check: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  ),
  xbig: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  logout: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
  ),
  warn: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
  ),
  chevron: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
  ),
  imgph: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
  ),
};

/* ---------- การ์ดบัญชีธนาคาร + ปุ่มคัดลอกเลขบัญชี ---------- */
export function BankInfoCard() {
  const { show, node } = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(payee.accountNo.replace(/-/g, '')); } catch { /* clipboard ถูกบล็อก */ }
    show('คัดลอกเลขบัญชีแล้ว');
  };
  return (
    <div className="bankcard">
      <div className="bankcard-top">
        <span className="bankcard-ic">{MIcon.landmark}</span>
        <div>
          <b>{payee.bankName}</b>
          <span>ชื่อบัญชี: {payee.accountName}</span>
        </div>
      </div>
      <div className="bankcard-no">
        <div>
          <div className="k">เลขที่บัญชี</div>
          <div className="v">{payee.accountNo}</div>
        </div>
        <button className="bankcopy" onClick={copy}>{MIcon.copy}คัดลอก</button>
      </div>
      {node}
    </div>
  );
}

/* ---------- อัปโหลดสลิป (dashed drop-zone → พรีวิว) ---------- */
export function SlipUploader({ onChange }: { onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');

  const pick = () => inputRef.current?.click();
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name);
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : 'doc');
    onChange(file);
  };
  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null); setName('');
    if (inputRef.current) inputRef.current.value = '';
    onChange(null);
  };

  return (
    <div className="slipbox">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,application/pdf"
        style={{ display: 'none' }} onChange={handleFile} />
      {!preview ? (
        <button type="button" className="slipdrop" onClick={pick}>
          <span className="up">{MIcon.imageup}</span>
          <span className="u1">เลือกรูปภาพสลิปจากเครื่องของคุณ</span>
          <span className="u2">รองรับไฟล์ JPG, PNG หรือ PDF (สูงสุด 5MB)</span>
        </button>
      ) : (
        <div className="slippreview">
          {preview === 'doc'
            ? <span className="doc">{MIcon.filecheck}</span>
            : <img src={preview} alt="สลิป" />}
          <div className="meta">
            <b>{name || 'slip.jpg'}</b>
            <span>แนบไฟล์เรียบร้อยแล้ว</span>
          </div>
          <button className="rm" aria-label="ลบไฟล์" onClick={clear}>{MIcon.x}</button>
        </div>
      )}
    </div>
  );
}

/* ---------- bottom sheet ---------- */
export function BottomSheet({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="sheet-veil">
      <div className="bg" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grip" />
        {children}
      </div>
    </div>
  );
}

/* ---------- confirm body (เนื้อหาในชีตยืนยัน) ---------- */
export function ConfirmBody({ tone, title, message, confirmLabel, onConfirm, onCancel }: {
  tone: 'neutral' | 'danger'; title: string; message: string;
  confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const danger = tone === 'danger';
  return (
    <div className="confirm">
      <div className={'cic ' + tone}>{danger ? MIcon.logout : MIcon.warn}</div>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="confirm-acts">
        {danger
          ? <button className="danger" onClick={onConfirm}>{MIcon.logout}{confirmLabel}</button>
          : <button className="ink" onClick={onConfirm}>{confirmLabel}</button>}
        <button className="mghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    </div>
  );
}

/* ---------- result overlay (สำเร็จ / ไม่สำเร็จ) ---------- */
export function ResultOverlay({ open, variant = 'success', title, message, children, action, onClose }: {
  open: boolean; variant?: 'success' | 'error'; title: string; message?: string;
  children?: ReactNode; action?: { label: string; onClick: () => void }; onClose: () => void;
}) {
  if (!open) return null;
  const err = variant === 'error';
  return (
    <div className="result-veil">
      <div className="bg" onClick={onClose} />
      <div className="result">
        <div className={'result-ic ' + (err ? 'err' : 'ok')}>
          <div className="in">{err ? MIcon.xbig : MIcon.check}</div>
        </div>
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        {children && <div className="result-extra">{children}</div>}
        {action && <button className="cta" onClick={action.onClick}>{action.label}</button>}
      </div>
    </div>
  );
}

/* ---------- ย่อรูปสลิปเป็น data URL ขนาดเล็ก (กัน localStorage เต็ม → สลิปหาย) ---------- */
export const compressImage = (file: File, max = 900, quality = 0.7): Promise<string> =>
  new Promise(resolve => {
    if (!file.type.startsWith('image/')) { resolve(''); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) { resolve(''); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(cv.toDataURL('image/jpeg', quality)); } catch { resolve(''); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });

/* ---------- ตรวจไฟล์สลิป: ชนิด + ขนาด (ข้อ 4) ---------- */
export const SLIP_ACCEPT = 'image/jpeg,image/png,application/pdf';
export const SLIP_MAX_MB = 5;
export function validateSlip(file: File | null): { ok: boolean; reason?: string } {
  if (!file) return { ok: false, reason: 'กรุณาแนบไฟล์สลิปก่อนส่งหลักฐาน' };
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    return { ok: false, reason: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF เท่านั้น กรุณาเลือกไฟล์ใหม่' };
  }
  if (file.size > SLIP_MAX_MB * 1024 * 1024) {
    return { ok: false, reason: `ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${SLIP_MAX_MB}MB) กรุณาเลือกไฟล์ที่เล็กลง` };
  }
  return { ok: true };
}

/* ---------- ผลลัพธ์แบบฝังในหน้า (แทน pop-up) — ข้อ 4,7 ---------- */
export function InlineResult({
  variant, title, message, waiting, primary, retry,
}: {
  variant: 'success' | 'error';
  title: string;
  message?: string;
  waiting?: string;                                   // ข้อความแถบ "รอการอนุมัติ"
  primary?: { label: string; onClick: () => void };   // ปุ่มหลัก (สำเร็จ)
  retry?: { label: string; onClick: () => void };     // ปุ่มลองใหม่ (ไม่สำเร็จ)
}) {
  const err = variant === 'error';
  return (
    <div className={'mresult ' + (err ? 'err' : 'ok')}>
      <div className="mresult-ic">
        <div className="in">{err ? MIcon.xbig : MIcon.check}</div>
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {waiting && (
        <div className="mresult-wait"><span className="dot" />{waiting}</div>
      )}
      {primary && <button className="cta" onClick={primary.onClick}>{primary.label}</button>}
      {retry && (
        <button className="retry" onClick={retry.onClick}>{MIcon.upload}{retry.label}</button>
      )}
    </div>
  );
}

/* ---------- format ยอดเงิน 2 ตำแหน่ง ---------- */
export const th2 = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });
