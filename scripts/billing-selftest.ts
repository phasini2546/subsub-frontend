/* SubSub · self-test ของกฎรอบบิล (lib/billing.ts) — รัน: npm run test:billing  (Node 22.6+)
   ทดสอบ B2/B3/B6/B7/B9/B12 แบบไม่ต้องเปิดเบราว์เซอร์ */
/* eslint-disable @typescript-eslint/no-explicit-any -- fixture แบบย่อเพื่อความกระชับของเทสต์ */
import { firstBillingDate, cycleStart, cycleIndexAt, nextCycleStart, memberBillStatus, planLeave, memberQuote, pricingAt, upcomingDue } from '../src/lib/billing.ts';
import { toISODateTH, addMonthsKeepDay } from '../src/lib/date.ts';
const eq=(a:any,b:any,msg:string)=>{ const ok=JSON.stringify(a)===JSON.stringify(b); console.log((ok?'PASS':'FAIL')+' '+msg+(ok?'':`  got=${JSON.stringify(a)} want=${JSON.stringify(b)}`)); if(!ok) process.exitCode=1; };
// B6
eq(toISODateTH(new Date('2026-10-04T18:30:00Z')),'2026-10-05','B6 01:30 Bangkok = 5 Oct');
// B7
eq(firstBillingDate('2026-10-05',20),'2026-10-20','B7 create 5 Oct, day 20');
eq(firstBillingDate('2026-10-25',20),'2026-11-20','B7 create 25 Oct, day 20 -> Nov');
eq(firstBillingDate('2026-09-30',31),'2026-09-30','B7 day 31 in Sep -> 30 Sep (not 1 Oct)');
const g31:any={billing_date:'2027-01-31',_billing_day:31,_billing_cycle:'monthly',total_price:'400',max_slots:4};
eq([0,1,2,3].map(n=>cycleStart(g31,n)),['2027-01-31','2027-02-28','2027-03-31','2027-04-30'],'B7 no drift 31->28->31');
eq(addMonthsKeepDay('2028-01-31',1,31),'2028-02-29','leap year');
// cycles
const g:any={group_id:'g',billing_date:'2027-01-20',_billing_day:20,_billing_cycle:'monthly',total_price:'400',max_slots:4};
eq(cycleIndexAt(g,'2027-01-19'),-1,'before first');
eq(cycleIndexAt(g,'2027-02-20'),1,'on 2nd start');
eq(nextCycleStart(g,'2027-02-20'),'2027-03-20','next after start');
eq(upcomingDue(g,'2027-02-20'),{date:'2027-02-20',days:0},'due today');
// member joined 20 Jan (paid join), billing statuses for Feb 20 cycle
const m:any={member_id:'m',group_id:'g',user_id:'u',joined_date:'2027-01-20',role:'Member',status:'Active'};
const st=(today:string,pays:any[]=[] , mm:any=m)=>memberBillStatus(g,mm,pays,today);
const s=(t:string,p:any[]=[],mm:any=m)=>{const b=st(t,p,mm);return [b.phase,b.target,b.daysUntilDue,b.canUpload,b.kickInDays,b.amount];};
eq(s('2027-02-16'),['settled',null,4,false,null,100],'D-4 settled');
eq(s('2027-02-17'),['window','2027-02-20',3,true,null,100],'B3 D-3 window opens');
eq(s('2027-02-20'),['due','2027-02-20',0,true,10,100],'D0 due');
eq(s('2027-02-24'),['due','2027-02-20',-4,true,6,100],'D+4 still due');
eq(s('2027-02-25'),['overdue','2027-02-20',-5,true,5,100],'B2 D+5 overdue, kick in 5');
eq(s('2027-03-01'),['overdue','2027-02-20',-9,true,1,100],'D+9 kick in 1');
eq(st('2027-03-02').kickDate,'2027-03-02','D+10 kickDate = today');
const waiting=[{payment_id:'p',status:'Waiting',_kind:'cycle',_cycle:'2027-02-20',paid_at:'2027-02-26T03:00:00Z',amount:'100'}];
eq(s('2027-02-26',waiting),['overdue','2027-02-20',-6,false,null,100],'Waiting -> no kick, no upload');
const paidEarly=[{payment_id:'p',status:'Verified',_kind:'cycle',_cycle:'2027-02-20',paid_at:'2027-02-18T03:00:00Z',amount:'100'}];
eq(s('2027-02-21',paidEarly)[0],'settled','paid in window -> settled after start');
eq(s('2027-03-17',paidEarly),['window','2027-03-20',3,true,null,100],'B3 RENEWAL: next month window opens again');
const paidLate=[{payment_id:'p',status:'Verified',_kind:'cycle',_cycle:'2027-02-20',paid_at:'2027-02-27T03:00:00Z',amount:'100'}];
eq(s('2027-03-17',paidLate)[0],'window','paid late last month still gets new window (old bug B3)');
eq(s('2027-03-21',paidLate)[0],'due','unpaid March after due -> due (old bug B2/B4 showed paid/locked)');
// leave per user example: cycle Jan20, request leave Feb 5 -> must pay? joined Jan 20 so Jan cycle covered. use joined Dec
const m2:any={...m,joined_date:'2026-12-20'};
const gl:any={...g,billing_date:'2026-12-20'};
const plan=planLeave(gl,m2,[],'2027-02-05');
eq(plan,{waived:'2027-02-20',effective:'2027-03-20'},'B9.2 leave: waive Feb20, effective Mar20');
const m2l={...m2,leaving:true,_leave_effective:plan.effective,_waived_cycles:[plan.waived]};
const b1=memberBillStatus(gl,m2l,[],'2027-02-05');
eq([b1.phase,b1.target],['overdue','2027-01-20'],'leaving but Jan cycle unpaid -> still overdue (must pay Jan)');
const janPaid=[{payment_id:'j',status:'Verified',_kind:'cycle',_cycle:'2027-01-20',paid_at:'2027-01-21T03:00:00Z',amount:'100'}];
eq(memberBillStatus(gl,m2l,janPaid,'2027-02-18').phase,'leaving','leaving + Jan paid -> no window for waived Feb');
eq(memberBillStatus(gl,m2l,janPaid,'2027-03-05').phase,'leaving','during waived cycle -> leaving');
// pro-rata
const q=memberQuote(g,'2027-02-13');
eq([q.usedDays,q.daysInCycle,q.firstAmount,q.totalDue,q.nextDue],[7,31,22.58,122.58,'2027-02-20'],'pro-rata 7/31 days (Jan20-Feb20 = 31 days)');
eq(memberQuote(g,'2027-02-20').prorated,false,'join on cycle start = full');
// B12 pricing by cycle
const gp:any={...g,_pricing_history:[{from:'1970-01',price:'400',max_slots:4},{from:'2027-02-20',price:'600',max_slots:4}]};
eq([pricingAt(gp,'2027-02-01').price,pricingAt(gp,'2027-02-19').price,pricingAt(gp,'2027-02-20').price],[400,400,600],'B12 price switches at cycle start');
eq(memberBillStatus(gp,m,[],'2027-02-17').amount,150,'B12 window pays NEW cycle price');
