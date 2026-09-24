/* =====================================================================
   SubSub · หน้าแก้ไขข้อมูลกลุ่ม · pages/EditPage.tsx
   reuse ฟอร์มแบบ CreatePage — prefill ข้อมูลเดิม แล้ว DB.updateGroup()
   แก้ได้ทุก field ยกเว้นรหัสเชิญ (invite_code)
   ===================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB, splitBankDT } from '../db';
import type { Category, GroupDetail, MemberWithDetail } from '../types';
import { Icon, useToast, CategoryPicker, ReminderAlert } from '../ui';
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

export default function EditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { show, node: toast } = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [category, setCategory] = useState<Category | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seatsUsed, setSeatsUsed] = useState(1);   // สมาชิก Active ปัจจุบัน (กัน max_slots ต่ำเกิน)
  const [orig, setOrig] = useState({ price: '', slots: '' });   // ค่าเดิม ไว้เช็คว่าราคา/ช่องเปลี่ยนไหม
  const [members, setMembers] = useState<MemberWithDetail[]>([]);       // สมาชิกในกลุ่ม (สำหรับจัดการ/นำออก)
  const [removing, setRemoving] = useState<MemberWithDetail | null>(null); // เป้าหมายที่จะนำออก (ยืนยันก่อน)

  /* prefill จากข้อมูลกลุ่มเดิม */
  useEffect(() => {
    (async () => {
      const g: GroupDetail | null = await DB.getGroup(id);
      if (!g) { setLoading(false); return; }
      const cyc: Cycle = g._billing_cycle === 'yearly' ? 'yearly' : 'monthly';
      const bank = splitBankDT(g.bankDT);
      setCycle(cyc);
      setCategory(g.category);
      setSeatsUsed(g.members.filter(m => m.status === 'Active').length);
      setMembers(g.members);
      setOrig({ price: String(Number(g.total_price)), slots: String(g.max_slots) });
      setForm({
        service_name: g.service_name,
        total_price: String(Number(g.total_price)),
        max_slots: String(g.max_slots),
        billing_day: cyc === 'monthly' ? String(new Date(g.billing_date).getDate()) : '',
        billing_date_full: cyc === 'yearly' ? g.billing_date : '',
        bank: bank.bank, account: bank.account, holder: bank.holder,
      });
      setLoading(false);
    })();
  }, [id]);

  const set = (k: keyof Form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  /* โหลดรายชื่อสมาชิกใหม่หลังนำออก (ไม่แตะฟอร์ม กันข้อมูลที่กำลังแก้หาย) */
  const reloadMembers = async () => {
    const g = await DB.getGroup(id);
    if (g) { setMembers(g.members); setSeatsUsed(g.members.filter(m => m.status === 'Active').length); }
  };

  /* โฮสต์นำสมาชิกออกจากกลุ่ม (soft-delete ใส่ left_date — เก็บประวัติไว้คิดยอดย้อนหลัง) */
  const doRemove = async () => {
    if (!removing) return;
    const name = removing.user.display_name;
    await DB.removeMember(id, removing.user_id);
    setRemoving(null);
    await reloadMembers();
    show('นำ ' + name + ' ออกจากกลุ่มแล้ว — ที่นั่งว่างสำหรับคนใหม่');
  };

  /* validation: เหมือนตอนสร้าง + กัน max_slots ต่ำกว่าสมาชิกที่มีอยู่ */
  const validate = useCallback((): string | null => {
    const e: Record<string, string> = {};
    let firstBad: string | null = null;
    const fail = (k: string, msg: string) => { e[k] = msg; if (!firstBad) firstBad = k; };

    if (!form.service_name) fail('service_name', 'กรุณากรอกชื่อบริการ');
    if (!form.total_price || Number(form.total_price) <= 0) fail('total_price', 'กรุณากรอกราคาที่มากกว่า 0');
    if (!form.max_slots || Number(form.max_slots) < 2) fail('max_slots', 'จำนวนสมาชิกต้องอย่างน้อย 2 คน');
    else if (Number(form.max_slots) < seatsUsed) fail('max_slots', `ลดไม่ได้ — ตอนนี้มีสมาชิกอยู่แล้ว ${seatsUsed} คน`);
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
  }, [form, cycle, category, seatsUsed]);

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
    let billing_date: string;
    if (cycle === 'monthly') {
      const now = new Date();
      const day = String(form.billing_day).padStart(2, '0');
      billing_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`;
    } else billing_date = form.billing_date_full;

    const updated = await DB.updateGroup(id, {
      service_name: form.service_name,
      total_price: Number(form.total_price).toFixed(2),
      max_slots: Number(form.max_slots),
      billing_date,
      category: category as Category,
      bankDT: `${form.bank} ${form.account} ${form.holder}`,
      billing_cycle: cycle,   // [M3]
    });
    setConfirm(false);
    if (!updated) { show('ไม่พบกลุ่มนี้ (อาจถูกลบไปแล้ว)'); return; }
    const priceOrSlotsChanged = Number(orig.price) !== Number(form.total_price) || Number(orig.slots) !== Number(form.max_slots);
    show(priceOrSlotsChanged
      ? 'บันทึกแล้ว — ราคา/จำนวนช่องใหม่จะมีผลตั้งแต่เดือนถัดไป (บิลเดือนนี้และย้อนหลังคงเดิม)'
      : 'บันทึกการแก้ไข “' + updated.service_name + '” เรียบร้อย');
    setTimeout(() => navigate('/group/' + id), 900);
  }

  if (loading) return <div className="phone"><main className="screen"><div className="form"><div className="skel" style={{ height: 120 }} /></div></main></div>;

  return (
    <div className="phone">
      <header className="topbar">
        <button className="back" onClick={() => navigate('/group/' + id)} aria-label="ย้อนกลับ">{Icon.back}</button>
        <h1>แก้ไขข้อมูลกลุ่ม</h1>
      </header>

      <main className="screen">
        <div className="form">
          <h2>แก้ไขรายละเอียด<br />กลุ่ม</h2>

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
            <p className="hint">ปัจจุบันมีสมาชิกอยู่ {seatsUsed} คน — ลดต่ำกว่านี้ไม่ได้</p>
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
            <CategoryPicker value={category}
              onChange={c => { setCategory(c); setErrors(e => { const n = { ...e }; delete n.category; return n; }); }} />
            {errors.category && <p className="err">{errors.category}</p>}
          </div>

          <ReminderAlert text="ระบบจะช่วยเตือนคุณก่อนถึงวันตัดรอบบิล 3 วัน" />

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

          <h3 className="subhead">จัดการสมาชิก</h3>
          {members.filter(m => m.role !== 'Host').length === 0 ? (
            <p className="hint" style={{ marginTop: 0 }}>ยังไม่มีสมาชิกอื่นในกลุ่ม</p>
          ) : (
            <div className="rows" style={{ marginBottom: 18 }}>
              {members.filter(m => m.role !== 'Host').map(m => (
                <div className="row" key={m.member_id}>
                  <div className={'av' + (m.status === 'Active' ? ' filled' : '')}>{m.status === 'Active' ? null : Icon.person}</div>
                  <div className="who">
                    <b>{m.user.display_name}</b>
                    <span>{m.leaving ? 'ประสงค์ออก' : m.status === 'Pending' ? 'รอตรวจสลิป' : 'สมาชิก'}</span>
                  </div>
                  <button type="button" className="pill"
                    style={{ color: 'var(--red)', border: '1px solid var(--red)', background: '#fff' }}
                    onClick={() => setRemoving(m)}>นำออก</button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn primary" onClick={askSave}>บันทึกการแก้ไข</button>
          <div style={{ height: 24 }} />
        </div>
      </main>

      {confirm && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setConfirm(false); }}>
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>ยืนยันการแก้ไข</h3>
            <p className="sub">ตรวจสอบข้อมูลให้ครบถ้วน ก่อนบันทึกทับข้อมูลเดิม</p>
            <div className="modal-actions">
              <button className="btn primary" onClick={doSave}>Confirm</button>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ===== ยืนยันนำสมาชิกออก ===== */}
      {removing && (
        <div className="veil" onClick={e => { if (e.target === e.currentTarget) setRemoving(null); }}>
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>นำ {removing.user.display_name} ออกจากกลุ่ม?</h3>
            <p className="sub">
              ที่นั่งจะว่างทันที สมาชิกจะไม่เห็นกลุ่มนี้อีก — ประวัติการจ่ายยังถูกเก็บไว้<br />
              เรื่องคืน/หักเงินประกัน ให้ตกลงกับสมาชิกเอง ระบบไม่คืนอัตโนมัติ
            </p>
            <div className="modal-actions two">
              <button className="btn ghost" onClick={() => setRemoving(null)}>ยกเลิก</button>
              <button className="btn solid-danger" onClick={doRemove}>นำออก</button>
            </div>
          </div>
        </div>
      )}

      {toast}
    </div>
  );
}