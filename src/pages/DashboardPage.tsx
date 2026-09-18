/* =====================================================================
   SubSub · หน้าภาพรวม (Dashboard) · pages/DashboardPage.tsx
   อ้างอิงดีไซน์ Figma — การ์ดสรุป + แถบหมวดหมู่ + โดนัท + กราฟแท่งย้อนหลัง
   ต่อ DB จริง (ทาง B) — ไม่ใช้ mock, รายปีคิดตามเดือนสะสมจริง
   ===================================================================== */
import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import { DB } from '../db';
import type { DashboardData, Category } from '../types';
import { NavBar, useToast, baht, baht2 } from '../ui';


/* สีแต่ละหมวด (คงตามดีไซน์ Figma) */
const CAT_COLOR: Record<Category, string> = {
  Entertainment: '#3FB24E',
  Music:         '#E5A81F',
  Productivity:  '#8A5A16',
  Other:         '#C9C9C9',
};

type History = { month: string; total: number }[];

export default function DashboardPage() {
  const { node: toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<History>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [d, h] = await Promise.all([DB.getDashboard(), DB.getSpendingHistory()]);
      setData(d); setHistory(h);
      setLoading(false);
    })();
  }, []);

  if (loading || !data) {
    return (
      <div className="phone">
        <header className="topbar"><h1>ภาพรวม</h1></header>
        <main className="screen"><div className="wrap">
          <div className="skel" style={{ height: 140, marginBottom: 20 }} />
          <div className="skel" style={{ height: 120 }} />
        </div></main>
        <NavBar current="overview" />
      </div>
    );
  }

  const total = view === 'monthly' ? data.monthTotal : data.yearTotal;
  const cats = data.byCategory;
  const donutData = cats.filter(c => c.percent > 0)
    .map(c => ({ label: c.label, amount: c.amount, color: CAT_COLOR[c.category], name: c.category }));

  return (
    <div className="phone">
      <header className="topbar"><h1>ภาพรวม</h1></header>

      <main className="screen">
        <div className="wrap">
          {/* การ์ดสรุป + ปุ่มสลับ รายเดือน/รายปี */}
          <div className="dash-hero">
            <div className="dash-hero-top">
              <span className="dash-hero-label">
                {view === 'monthly' ? 'ค่าใช้จ่ายเดือนนี้' : 'ค่าใช้จ่ายรายปี'}
              </span>
              <div className="dash-toggle">
                <button aria-pressed={view === 'monthly'} onClick={() => setView('monthly')}>รายเดือน</button>
                <button aria-pressed={view === 'yearly'} onClick={() => setView('yearly')}>รายปี</button>
              </div>
            </div>
            <div className="dash-hero-amount">{baht2(total)} <span>บาท</span></div>
            <div className="dash-hero-divider" />
            <div className="dash-hero-year">
              {view === 'monthly' ? 'ค่าใช้จ่ายรายปี' : 'ค่าใช้จ่ายเดือนนี้'}
              {' '}<b>{baht2(view === 'monthly' ? data.yearTotal : data.monthTotal)} บาท</b>
            </div>
          </div>

          {/* แถบแบ่งตามหมวดหมู่ */}
          <div className="dash-card">
            <div className="dash-card-title">แบ่งตามหมวดหมู่</div>
            {cats.map(c => (
              <div className="dash-bar-row" key={c.category}>
                <div className="dash-bar-head">
                  <span><i className="dot-cat" style={{ background: CAT_COLOR[c.category] }} />{c.label}</span>
                  <span className="dash-bar-val">{baht2(c.amount)} ({c.percent}%)</span>
                </div>
                <div className="dash-bar-track">
                  <div className="dash-bar-fill" style={{ width: c.percent + '%', background: CAT_COLOR[c.category] }} />
                </div>
              </div>
            ))}
          </div>

          {/* โดนัทชาร์ต (recharts) */}
          <div className="dash-card">
            <div className="dash-card-title">ภาพรวมค่าใช้จ่าย</div>
            {data.monthTotal > 0 ? (
              <>
                <div style={{ position: 'relative', width: '100%', height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} dataKey="amount" nameKey="label"
                        cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                        {donutData.map(d => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [baht(Number(v)), 'ยอดรวม']}
                        contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="dash-donut-center"><b>100%</b></div>
                </div>
                <div className="dash-legend">
                  {cats.filter(c => c.percent > 0).map(c => (
                    <div className="dash-legend-item" key={c.category}>
                      <div className="dash-legend-pct" style={{ color: CAT_COLOR[c.category] }}>{c.percent}%</div>
                      <div className="dash-legend-lbl"><i style={{ background: CAT_COLOR[c.category] }} />{c.label}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '30px 0' }}>
                ยังไม่มีค่าใช้จ่ายในเดือนนี้
              </div>
            )}
          </div>

          {/* กราฟแท่งย้อนหลัง 6 เดือน (recharts) */}
          <div className="dash-card">
            <div className="dash-card-head">
              <div className="dash-card-title" style={{ margin: 0 }}>แนวโน้มค่าใช้จ่ายย้อนหลัง</div>
              <span className="dash-card-sub">6 เดือนล่าสุด</span>
            </div>
            <div style={{ width: '100%', height: 180, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,.03)' }}
                    formatter={(v) => [baht(Number(v)), 'ยอดรวม']}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', fontSize: 13 }} />
                  <Bar dataKey="total" fill="#3FB24E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>

      <NavBar current="overview" />
      {toast}
    </div>
  );
}