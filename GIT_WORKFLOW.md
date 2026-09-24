# Git Workflow — subsub-frontend (ทีม 2 คน / 4 ฟังก์ชัน)

repo: https://github.com/phasini2546/subsub-frontend
- subsub : Member Function + Main Menu Function
- เพื่อน : Host Function + Dashboard Function

## จุดที่ conflict บ่อย (ไฟล์ shared ที่ทั้ง 4 ฟังก์ชันแตะ)
src/db.ts · src/App.css · src/main.tsx (routes) · src/types.ts · src/ui.tsx
> เคล็ดลับ: แต่ละฟีเจอร์เขียนเพิ่มในบล็อกคอมเมนต์ของตัวเอง (append-only) → conflict มักเป็นแบบ "เก็บทั้งสองฝั่ง" แก้ง่าย

## 0) สำรองงานก่อน (ทำทันที)
```
cd subsub-frontend
git status
git checkout -b backup/subsub-2026-09-23        # snapshot จาก branch ปัจจุบัน
git add -A
git commit -m "backup: Member + Main Menu (2026-09-23)"
git push -u origin backup/subsub-2026-09-23      # เก็บบน remote เผื่อพัง
```

## 1) ตั้งหลัก main ให้เป็น Base เดียวกัน
ให้ main เป็น "โครงกลางที่ build ผ่าน" (design system App.css, db.ts, types.ts, ui.tsx, main.tsx โครง route)
ทุก feature แตกจาก **commit เดียวกันของ main** เพื่อให้ไฟล์ shared ต่างกันน้อยที่สุด
```
git checkout main
git pull origin main
```

## 2) แตก branch ตามฟังก์ชัน (ทุกอันจาก main จุดเดียวกัน)
```
git checkout main && git checkout -b feature/main-menu   # subsub
git checkout main && git checkout -b feature/member       # subsub
git checkout main && git checkout -b feature/host         # เพื่อน
git checkout main && git checkout -b feature/dashboard     # เพื่อน
```

## 3) ระหว่างทำงาน — rebase บ่อย ๆ กัน drift
```
git fetch origin
git rebase origin/main        # ดึงของที่ merge เข้า main แล้วมาไว้ใต้ commit เรา
```

## 4) ลำดับ Merge (ไล่ทีละอัน ไม่ merge พร้อมกัน)
รวมทีละ branch แล้วให้ที่เหลือ rebase ตาม เพื่อให้ diff เล็กลงเรื่อย ๆ
1. feature/main-menu → main   (แตะ shared น้อยสุด: ServicesPage + บล็อก CSS ของตัวเอง)
2. feature/host      → main   (เพื่อน rebase ก่อน, resolve db.ts/App.css)
3. feature/member    → main   (rebase ก่อน — เป็นเจ้าของ member block ใน db.ts/App.css)
4. feature/dashboard → main   (rebase ก่อน)
> เปิดเป็น Pull Request ทีละอัน, review, merge, แล้วคนอื่น `git rebase origin/main` ทันที

## 5) เวลา conflict ที่ไฟล์ shared
- App.css / db.ts : ปกติเป็นการ "เพิ่มบล็อกใหม่คนละที่" → เลือก **เก็บทั้งสองฝั่ง** (both)
- main.tsx routes : เพิ่ม route คนละบรรทัด → เก็บทั้งสองฝั่ง
- types.ts        : ถ้าแก้ field ของ interface เดียวกัน → คุยกันก่อน commit
- แก้ signature ของเมธอด db.ts ที่ใช้ร่วม → แจ้งทีมก่อนเสมอ
```
# หลัง resolve
git add <file> ; git rebase --continue   # (หรือ git commit ถ้า merge)
npm run build                            # ต้องผ่าน tsc -b ก่อน push
```

## 6) กติกากันพังซ้ำ
- ทุก PR ต้อง `npm run build` ผ่าน (tsc -b && vite build)
- ห้าม force-push ทับ main; ใช้ backup/* เป็นเซฟพอยต์
