/* =====================================================================
   SubSub · ฟอร์มเพิ่มบริการใหม่ (รายจ่ายส่วนตัว) · pages/AddServiceForm.tsx
   ---------------------------------------------------------------------
   มิเรอร์ UI/UX ของหน้า Host สร้างกลุ่ม (CreatePage) — form + validation
   + modal ยืนยัน — แต่บันทึกเป็น Subscription (เดี่ยว) ไม่ใช่ Group
   จึงตัด field ที่เป็นของกลุ่มออก (จำนวนสมาชิก / บัญชีธนาคาร)
   ===================================================================== */
import { useState } from 'react';
import { DB } from '../db';
import type { Category, Subscription } from '../types';
import { Icon, useToast, CategoryPicker, ReminderAlert } from '../ui';
import DatePicker from '../components/DatePicker';
import { billingDayOf } from '../lib/billing';

type Cycle = 'monthly' | 'yearly';
type Form = { service_name: string; price: string; billing_day: string; billing_date_full: string };
const EMPTY: Form = { service_name: '', price: '', billing_day: '', billing_date_full: '' };

export default function AddServiceForm({
  onClose, onSaved, editing,
}: { onClose: () => void; onSaved: (name: string) => void; editing?: Subscription | null }) {
  const { show, node: toast } = useToast();
  const isEdit = !!editing;
  const [form, setForm] = useState<Form>(editing
    ? {
        service_name: editing.service_name,
        price: String(Number(editing.price)),
        billing_day: String(billingDayOf(editing)),
        billing_date_full: editing._billing_cycle === 'yearly' ? editing.billing_date : '',
      }
    : EMPTY);
  const [cycle, setCycle] = useState<Cycle>(editing?._billing_cycle === 'yearly' ? 'yearly' : 'monthly');
  const [category, setCategory] = useState<Category | ''>(editing ? editing.category : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);

  const set = (k: keyof Form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  function validate(): string | null {
    const e: Record<string, string> = {};
    let firstBad: string | null = null;
    const fail = (k: string, msg: string) => { e[k] = msg; if (!firstBad) firstBad = k; };

    if (!form.service_name) fail('service_name', 'กรุณากรอกชื่อบริการ');
    if (!form.price || Number(form.price) <= 0) fail('price', 'กรุณากรอกราคาที่มากกว่า 0');
    if (cycle === 'monthly') {
      const d = Number(form.billing_day);
      if (!form.billing_day || d < 1 || d > 31) fail('billing_date', 'กรุณาระบุวันที่ 1–31');
    } else if (!form.billing_date_full) fail('billing_date', 'กรุณาเลือกวันตัดรอบบิล');
    if (!category) fail('category', 'กรุณาเลือกหมวดหมู่');

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
    // [B7] ส่งวันที่ที่เลือก — DB คำนวณวันครบกำหนดแรกจากวันนี้ (เวลาไทย) เอง
    const payload = {
      service_name: form.service_name,
      price: Number(form.price).toFixed(2),
      category: category as Category,
      _billing_cycle: cycle,
      _billing_day: cycle === 'monthly' ? Number(form.billing_day) : Number(form.billing_date_full.slice(8, 10)),
      ...(cycle === 'yearly' ? { billing_date: form.billing_date_full } : {}),
    };
    if (isEdit && editing) await DB.updateSubscription(editing.sub_id, payload);
    else await DB.addSubscription(payload);
    setConfirm(false);
    onSaved(form.service_name);
  }

  return (
    <div className="addsvc">
      <header className="topbar">
        <button className="back" onClick={onClose} aria-label="ปิด">{Icon.back}</button>
        <h1>{isEdit ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่'}</h1>
      </header>

      <main className="screen">
        <div className="form">
          <h2>{isEdit ? 'แก้ไขรายละเอียด' : 'รายละเอียด'}<br />บริการของคุณ</h2>

          <div className="field" data-field="service_name">
            <label>ชื่อบริการ</label>
            <input type="text" value={form.service_name} placeholder="เช่น Netflix, iCloud+"
              className={errors.service_name ? 'invalid' : ''} onChange={e => set('service_name', e.target.value)} />
            {errors.service_name && <p className="err">{errors.service_name}</p>}
          </div>

          <div className="field" data-field="price">
            <label>ราคา (บาท/เดือน)</label>
            <div className="inputmoney">
              <input type="number" value={form.price} placeholder="0.00" min={0} step="0.01"
                className={errors.price ? 'invalid' : ''} onChange={e => set('price', e.target.value)} />
              <span>THB</span>
            </div>
            {errors.price && <p className="err">{errors.price}</p>}
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
              <label>วันตัดรอบบิล (ระบุวันที่เริ่มใช้บริการ)</label>
              <DatePicker value={form.billing_date_full} invalid={!!errors.billing_date}
                onChange={v => set('billing_date_full', v)} />
              {errors.billing_date && <p className="err">{errors.billing_date}</p>}
            </div>
          )}

          <div className="field" data-field="category">
            <label>หมวดหมู่</label>
            <CategoryPicker value={category}
              onChange={c => { setCategory(c); setErrors(e => { const n = { ...e }; delete n.category; return n; }); }} />
            {errors.category && <p className="err">{errors.category}</p>}
          </div>

          <ReminderAlert text="ระบบจะช่วยเตือนคุณก่อนถึงวันตัดรอบบิล 3 วัน" />

          <p className="hint" style={{ marginTop: 14 }}>
            บริการแบบเดี่ยวคือรายจ่ายที่คุณชำระเอง ระบบจะนำไปรวมในสรุปค่าใช้จ่ายของคุณ
          </p>

          <button type="button" className="btn primary" onClick={askSave}>{isEdit ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}</button>
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
