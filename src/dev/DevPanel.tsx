/* =====================================================================
   SubSub · แผงเครื่องมือทดสอบ (DEV ONLY) · dev/DevPanel.tsx          [B11]
   ---------------------------------------------------------------------
   รวมปุ่มทดสอบที่เคยฝังอยู่ในหน้า Services / Detail / MemberGroup / Dashboard
   หน้าเหล่านั้นโหลดไฟล์นี้ผ่าน src/dev/index.ts (lazy + __DEV_TOOLS__) เท่านั้น
   ===================================================================== */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayTH } from '../lib/clock';
import { fmtDateTH } from '../lib/date';
import {
  devClock, devReset, ensureDemoDisney, ensureDemoFull, ensureMidCycleDemo,
  devApproveMine, devRejectMine, devResubmitMine, devExpireMyLeave, simJoinRequest, simMemberPay, simMemberResubmit, simLeave,
  devSeedPrevMonthCompare, devClearPrevMonthCompare,
} from './devDb';
import { DEMO_CODE, DEMO_FULL_CODE } from './mock';

export interface DevProps {
  reload: () => void | Promise<void>;
  show: (msg: string) => void;
  groupId?: string;
}

/* ---------- นาฬิกาจำลอง: เลื่อนวันเพื่อทดสอบขึ้นรอบใหม่ / ค้างชำระ / เตะออก ---------- */
export function DevClockBar({ reload, show }: DevProps) {
  const [off, setOff] = useState(devClock.get());
  const shift = async (d: number) => {
    const n = d === 0 ? (devClock.reset(), 0) : devClock.shift(d);
    setOff(n);
    await reload();
    show(`⏱ วันจำลอง: ${fmtDateTH(todayTH())} (${n >= 0 ? '+' : ''}${n} วัน)`);
  };
  return (
    <div className="devclock">
      <div className="devclock-h">⏱ วันจำลอง <b>{fmtDateTH(todayTH())}</b> <span>({off >= 0 ? '+' : ''}{off} วัน)</span></div>
      <div className="devclock-btns">
        <button onClick={() => shift(-1)}>−1</button>
        <button onClick={() => shift(1)}>+1</button>
        <button onClick={() => shift(3)}>+3</button>
        <button onClick={() => shift(5)}>+5</button>
        <button onClick={() => shift(10)}>+10</button>
        <button onClick={() => shift(30)}>+30</button>
        <button onClick={() => shift(0)}>วันจริง</button>
      </div>
    </div>
  );
}

/* ---------- หน้า Services ---------- */
export function ServicesDevPanel(props: DevProps) {
  const navigate = useNavigate();
  const { reload, show } = props;
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); } catch { /* blocked */ } };
  return (
    <div className="testpanel" style={{ margin: '26px 0 0' }}>
      <div className="testpanel-h">🧪 โหมดทดสอบ (เฉพาะ dev — ไม่ถูก build ขึ้น production)</div>
      <DevClockBar {...props} />
      <button onClick={async () => { ensureDemoDisney(); await copy(DEMO_CODE); navigate('/join'); }}>
        ① เข้าร่วมกลุ่มสาธิต — รหัส {DEMO_CODE} (คัดลอกแล้ว)
      </button>
      <button onClick={async () => { ensureDemoFull(); await copy(DEMO_FULL_CODE); show(`สร้างกลุ่มเต็มแล้ว · รหัส ${DEMO_FULL_CODE} (คัดลอกแล้ว)`); }}>
        ② กลุ่มเต็ม (มีคนรออนุมัติจองที่นั่ง) — รหัส {DEMO_FULL_CODE}
      </button>
      <button onClick={async () => { const g = ensureMidCycleDemo(); await copy(g.invite_code); show('กลุ่มเข้ากลางรอบ · รหัส ' + g.invite_code + ' (คัดลอกแล้ว)'); }}>
        ③ กลุ่มเข้ากลางรอบ (คิดเงินตามวัน) — รหัส SPOTIFY-7
      </button>
      <button onClick={async () => { const n = await devApproveMine(); await reload(); show(n ? `โฮสต์อนุมัติสลิปของคุณ ${n} รายการ` : 'ไม่มีสลิปรอตรวจ'); }}>
        ④ จำลอง: โฮสต์อนุมัติสลิปที่รอตรวจของฉัน
      </button>
      <button onClick={async () => { const n = await devRejectMine(); await reload(); show(n ? `โฮสต์ปฏิเสธสลิปของคุณ ${n} รายการ` : 'ไม่มีสลิปรอตรวจ'); }}>
        ⑤ จำลอง: โฮสต์ปฏิเสธสลิปที่รอตรวจของฉัน
      </button>
      <button onClick={async () => { const s = devResubmitMine(); await reload(); show(s ? `ส่งสลิปใหม่ของ ${s} แล้ว — รอโฮสต์ตรวจอีกครั้ง` : 'ยังไม่มีสลิปที่ถูกปฏิเสธให้ส่งใหม่ (กด ⑤ ก่อน)'); }}>
        ↻ จำลอง: ส่งสลิปใหม่หลังถูกปฏิเสธ
      </button>
      <button onClick={async () => { const n = devExpireMyLeave(); await reload(); show(n ? 'ถึงวันออกจริงแล้ว — slot ว่าง' : 'ยังไม่มีคำขอออก'); }}>
        ⑥ จำลอง: ถึงวันออกจริงของคำขอออก
      </button>
      <button onClick={async () => { devReset(); await reload(); show('รีเซ็ตข้อมูลทดสอบ + นาฬิกาแล้ว'); }}>
        ♻︎ รีเซ็ตข้อมูลทดสอบทั้งหมด
      </button>
    </div>
  );
}

/* ---------- หน้า Member: รายละเอียดกลุ่ม ---------- */
export function MemberGroupDevPanel(props: DevProps) {
  const { reload, show, groupId } = props;
  return (
    <div className="testpanel" style={{ margin: '16px 0 0' }}>
      <div className="testpanel-h">🧪 จำลอง (dev)</div>
      <DevClockBar {...props} />
      <button onClick={async () => { const n = await devApproveMine(groupId); await reload(); show(n ? 'โฮสต์อนุมัติแล้ว' : 'ไม่มีสลิปรอตรวจ'); }}>▶︎ โฮสต์อนุมัติสลิปของฉัน</button>
      <button onClick={async () => { const n = await devRejectMine(groupId); await reload(); show(n ? 'โฮสต์ปฏิเสธสลิป — ส่งใหม่ได้' : 'ไม่มีสลิปรอตรวจ'); }}>▶︎ โฮสต์ปฏิเสธสลิปของฉัน</button>
      <button onClick={async () => { const s = devResubmitMine(groupId); await reload(); show(s ? 'ส่งสลิปใหม่แล้ว — รอโฮสต์ตรวจอีกครั้ง' : 'ยังไม่มีสลิปที่ถูกปฏิเสธให้ส่งใหม่'); }}>▶︎ ส่งสลิปใหม่หลังถูกปฏิเสธ</button>
    </div>
  );
}

/* ---------- หน้า Host: รายละเอียดกลุ่ม ---------- */
export function DetailDevPanel(props: DevProps) {
  const { reload, show, groupId = '' } = props;
  return (
    <div className="testpanel">
      <div className="testpanel-h">🧪 เครื่องมือทดสอบ (dev)</div>
      <DevClockBar {...props} />
      <button onClick={async () => { const r = simJoinRequest(groupId); await reload(); show(r === 'ok' ? 'มีคนขอเข้ากลุ่ม (จองที่นั่งแล้ว) — ดู “คำขอเข้า”' : 'ที่นั่งเต็มแล้ว (รวมคนที่รออนุมัติ)'); }}>
        มีคนขอเข้ากลุ่ม + แนบสลิปแรกเข้า
      </button>
      <button onClick={async () => { const n = simMemberPay(groupId); await reload(); show(n ? `${n} ส่งสลิปรอบนี้แล้ว — กด “ตรวจสอบสลิป”` : 'ยังไม่มีใครอยู่ในช่วงส่งสลิป — ลองเลื่อนวัน +'); }}>
        สมาชิกส่งสลิปรอบบิล (คนแรกที่ถึงกำหนด)
      </button>
      <button onClick={async () => { const s = simMemberResubmit(groupId); await reload(); show(s ? `${s} ส่งสลิปใหม่แล้ว — กด “ตรวจสอบสลิป” อีกครั้ง` : 'ยังไม่มีสลิปที่ถูกปฏิเสธในกลุ่มนี้ (กดปฏิเสธสลิปในการ์ดสมาชิกก่อน)'); }}>
        สมาชิกส่งสลิปใหม่ (หลังโฮสต์ปฏิเสธ)
      </button>
      <button onClick={async () => { const n = await simLeave(groupId); await reload(); show(n ? `${n} แจ้งออกแล้ว` : 'ไม่มีสมาชิกให้ทดสอบ'); }}>
        สมาชิกแจ้งประสงค์ออก
      </button>
    </div>
  );
}

/* ---------- หน้า Dashboard ---------- */
export function DashboardDevPanel({ reload, show }: DevProps) {
  const sim = async (dir: 'up' | 'down' | 'clear') => {
    if (dir === 'clear') devClearPrevMonthCompare(); else devSeedPrevMonthCompare(dir);
    await reload();
    show(dir === 'clear' ? 'ล้างข้อมูลจำลองแล้ว' : dir === 'up' ? 'จำลอง: เดือนนี้แพงกว่าเดือนก่อน' : 'จำลอง: เดือนนี้ถูกกว่าเดือนก่อน');
  };
  return (
    <div className="testpanel" style={{ margin: '8px 0 0' }}>
      <div className="testpanel-h">🔧 ทดสอบป้ายเทียบเดือนก่อน (dev)</div>
      <button onClick={() => sim('up')}>↑ เดือนนี้แพงกว่า</button>
      <button onClick={() => sim('down')}>↓ เดือนนี้ถูกกว่า</button>
      <button onClick={() => sim('clear')}>ล้างข้อมูลจำลอง</button>
    </div>
  );
}
