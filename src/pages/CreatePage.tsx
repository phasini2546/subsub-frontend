/* =====================================================================
   SubSub · หน้าสร้างกลุ่มใหม่ · pages/CreatePage.tsx
   แปลงจาก create.html + create.js — validation + บันทึกลง DB
   ===================================================================== */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../db';
import type { Category } from '../types';
import { Icon, useToast } from '../ui';
import DatePicker from '../components/DatePicker';

type Cycle = 'monthly' | 'yearly';
type Form = {
  service_name: string; total_price: string; max_slots: string;
  billing_day: string; billing_date_full: string;
  bank: string; account: string; holder: string;
};
const EMPTY: Form = {
  service_name: '', total_price: '', max_slots: '',
  billing_day: '', billing_date_full: '', bank: '', account: '', holder: '',
};
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'Entertainment', label: 'ความบันเทิง' },
  { key: 'Music', label: 'เพลง' },
  { key: 'Productivity', label: 'งาน' },
  { key: 'Other', label: 'อื่น ๆ' },
];


export default function CreatePage() {
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [category, setCategory] = useState<Category | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);

  const set = (k: keyof Form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  /* validation: กันกรอกไม่ครบ */
  function validate(): string | null {
    const e: Record<string, string> = {};
    let firstBad: string | null = null;
    const fail = (k: string, msg: string) => { e[k] = msg; if (!firstBad) firstBad = k; };

    if (!form.service_name) fail('service_name', 'กรุณากรอกชื่อบริการ');
    if (!form.total_price || Number(form.total_price) <= 0) fail('total_price', 'กรุณากรอกราคาที่มากกว่า 0');
    if (!form.max_slots || Number(form.max_slots) < 2) fail('max_slots', 'จำนวนสมาชิกต้องอย่างน้อย 2 คน');
    if (cycle === 'monthly') {
      const d = Number(form.billing_day);
      if (!form.billing_day || d < 1 || d > 31) fail('billing_date', 'กรุณาระบุวันที่ 1–31');
    } else if (!form.billing_date_full) fail('billing_date', 'กรุณาเลือกวันตัดรอบบิล');
    if (!category) fail('category', 'กรุณาเลือกหมวดหมู่');
    if (!form.bank) fail('bank', 'กรุณากรอกธนาคาร/พร้อมเพย์');
    if (!form.account) fail('account', 'กรุณากรอกเลขบัญชี');
    if (!form.holder) fail('holder', 'กรุณากรอกชื่อบัญชี');

    setErrors(e);
    return firstBad;
  }

  function askSave() {
    const bad = validate();
    if (bad) {
      show('กรุณากรอกข้อมูลให้ครบก่อนบันทึก');
      document.querySelector<HTMLElement>(`[data-field="${bad}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setConfirm(true);
  }

  async function doSave() {
    // แปลง billing_date ตามรอบ
    let billing_date: string;
    if (cycle === 'monthly') {
      const now = new Date();
      const day = String(form.billing_day).padStart(2, '0');
      billing_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`;
    } else billing_date = form.billing_date_full;

    const created = await DB.createGroup({
      service_name: form.service_name,
      total_price: Number(form.total_price).toFixed(2),
      max_slots: Number(form.max_slots),
      billing_date,
      category: category as Category,
      bankDT: `${form.bank} ${form.account} ${form.holder}`,
      billing_cycle: cycle,   // [M3]
    });
    setConfirm(false);
    show('สร้างกลุ่ม “' + created.service_name + '” เรียบร้อย');
    setTimeout(() => navigate('/groups'), 900);
  }

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/groups')} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>สร้างกลุ่มใหม่</h1>
      </header>

      <main className="screen">
        <div className="form">
          <h2>รายละเอียด<br />การสร้างกลุ่ม</h2>

          <div className="field" data-field="service_name">
            <label>ชื่อบริการ</label>
            <input type="text" value={form.service_name} placeholder="ชื่อบริการ"
              className={errors.service_name ? 'invalid' : ''} onChange={e => set('service_name', e.target.value)} />
            {errors.service_name && <p className="err">{errors.service_name}</p>}
          </div>

          <div className="field" data-field="total_price">
            <label>ราคา (บาท/เดือน)</label>
            <div className="inputmoney">
              <input type="number" value={form.total_price} placeholder="0.00" min={0} step="0.01"
                className={errors.total_price ? 'invalid' : ''} onChange={e => set('total_price', e.target.value)} />
              <span>THB</span>
            </div>
            {errors.total_price && <p className="err">{errors.total_price}</p>}
          </div>

          <div className="field" data-field="max_slots">
            <label>จำนวนสมาชิก (รวม Host)</label>
            <input type="number" value={form.max_slots} placeholder="จำนวนสมาชิก" min={2} max={20}
              className={errors.max_slots ? 'invalid' : ''} onChange={e => set('max_slots', e.target.value)} />
            {errors.max_slots && <p className="err">{errors.max_slots}</p>}
          </div>

          <div className="field">
            <div className="toggle">
              <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>รายเดือน</button>
              <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>รายปี</button>
            </div>
          </div>

          {cycle === 'monthly' ? (
            <div className="field" data-field="billing_date">
              <label>วันที่เรียกเก็บเงิน</label>
              <input type="number" value={form.billing_day} placeholder="1-31" min={1} max={31}
                className={errors.billing_date ? 'invalid' : ''} onChange={e => set('billing_day', e.target.value)} />
              <p className="hint">หากเดือนใดไม่มีวันที่ท่านเลือก ระบบจะนับในวันสุดท้ายของเดือนนั้นแทน</p>
              {errors.billing_date && <p className="err">{errors.billing_date}</p>}
            </div>
          ) : (
            <div className="field" data-field="billing_date">
              <label>วันตัดรอบบิล (ระบุวันที่สมัคร)</label>
              <DatePicker value={form.billing_date_full}
                invalid={!!errors.billing_date}
                onChange={v => set('billing_date_full', v)} />
              {errors.billing_date && <p className="err">{errors.billing_date}</p>}
            </div>
          )}

          <div className="field" data-field="category">
            <label>หมวดหมู่</label>
            <div className="chips">
              {CATEGORIES.map(c => (
                <button type="button" key={c.key} className="chip"
                  aria-pressed={category === c.key}
                  onClick={() => { setCategory(c.key); setErrors(e => { const n = { ...e }; delete n.category; return n; }); }}>
                  {c.label}
                </button>
              ))}
            </div>
            {errors.category && <p className="err">{errors.category}</p>}
          </div>

          <h3 className="subhead">รายละเอียดบัญชีธนาคาร</h3>

          <div className="field" data-field="bank">
            <label>ธนาคาร (หากเป็นพร้อมเพย์ให้ระบุเป็นพร้อมเพย์)</label>
            <input type="text" value={form.bank} placeholder="Ex. กสิกรไทย (K-Bank)/พร้อมเพย์"
              className={errors.bank ? 'invalid' : ''} onChange={e => set('bank', e.target.value)} />
            {errors.bank && <p className="err">{errors.bank}</p>}
          </div>

          <div className="field" data-field="account">
            <label>เลขบัญชี</label>
            <input type="text" value={form.account} placeholder="xxx-x-xxxxx-x"
              className={errors.account ? 'invalid' : ''} onChange={e => set('account', e.target.value)} />
            {errors.account && <p className="err">{errors.account}</p>}
          </div>

          <div className="field" data-field="holder">
            <label>ชื่อบัญชี</label>
            <input type="text" value={form.holder} placeholder="ชื่อ นามสกุล ภาษาไทยหรืออังกฤษ"
              className={errors.holder ? 'invalid' : ''} onChange={e => set('holder', e.target.value)} />
            <p className="hint">ข้อมูลบัญชีธนาคารของคุณจะถูกแชร์ให้กับสมาชิกในกลุ่มเพื่อความสะดวกในการโอนเงินคืนเท่านั้น</p>
            {errors.holder && <p className="err">{errors.holder}</p>}
          </div>

          <button type="button" className="btn primary" onClick={askSave}>บันทึกข้อมูล</button>
          <div style={{ height: 24 }} />
        </div>
      </main>

      {confirm && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setConfirm(false); }}>
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>กรุณายืนยันการบันทึก</h3>
            <p className="sub">ตรวจสอบข้อมูลให้ครบถ้วน ก่อนทำการบันทึก</p>
            <div className="modal-actions">
              <button className="btn primary" onClick={doSave}>Confirm</button>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {toast}
    </div>
  );
}