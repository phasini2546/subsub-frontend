/* SubSub · ตรวจว่า build production ไม่มีโค้ด/ข้อมูลทดสอบหลุดไป [B11]
   รัน: npm run check:prod   (= vite build แล้วสแกนไฟล์ .js ใน dist/) */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['DISNEY-99', 'NFLX-2026', 'SPOTIFY-7', 'สมชาย ไดมอนด์', 'โหมดทดสอบ', 'devClock', 'subsub_dev_day_offset'];
const files = [];
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); } };
walk('dist');

let bad = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of MARKERS) if (src.includes(m)) { console.error(`✗ ${f} มี "${m}"`); bad++; }
}
if (bad) { console.error(`\nพบโค้ดทดสอบใน production ${bad} จุด`); process.exit(1); }
console.log(`✓ ตรวจ ${files.length} ไฟล์ .js — ไม่มีโค้ด/ข้อมูลทดสอบหลุดไป production`);
