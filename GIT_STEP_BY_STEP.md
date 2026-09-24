# คู่มือ Git ทีละขั้น — นำ 2 ฟังก์ชันเข้าเป็น 2 Branch แยกกัน

repo: https://github.com/phasini2546/subsub-frontend
- โปรเจกต์หลัก: `C:\Users\Admin\Desktop\subsub-frontend`
- โฟลเดอร์งานแยก 2 อัน (บน Desktop):
  - `Frontend - Member Page`     → branch `frontend-member-function`
  - `Frontend - Main Menu Page`  → branch `frontend-service-function`

> ใช้ **Git Bash** (คลิกขวาในโฟลเดอร์โปรเจกต์ → "Git Bash Here") จะพิมพ์ path แบบ /c/... ได้
> ทุก branch แตกจาก `main` จุดเดียวกัน แล้วค่อย copy ไฟล์ของฟังก์ชันนั้นเข้ามา → ไม่ปะปนกัน

────────────────────────────────────────
## ขั้น 0) สำรองงานที่ค้าง + เคลียร์ให้พร้อมสลับ branch
────────────────────────────────────────
```bash
cd "/c/Users/Admin/Desktop/subsub-frontend"

git status                       # ดูว่ามีไฟล์ค้าง (แดง/เขียว) ไหม
git add -A                       # เก็บงานที่ค้างทั้งหมด
git commit -m "backup: งานค้างก่อนแตก branch"   # commit ไว้กัน main ไม่สะอาด (ถ้าไม่มีอะไรค้างจะเตือนแล้วข้ามได้)
```
> ถ้าไม่อยากเก็บงานค้างเข้า commit ให้ใช้ `git stash -u` แทน (พักไว้ชั่วคราว)

────────────────────────────────────────
## ขั้น 1) อัปเดต Branch main ให้ล่าสุด (ตัวตั้งต้น)
────────────────────────────────────────
```bash
git checkout main                # สลับไป main
git pull origin main             # ดึงเวอร์ชันล่าสุดจาก GitHub
git status                       # ต้องขึ้น "nothing to commit, working tree clean"
```

────────────────────────────────────────
## ขั้น 2) Branch งาน MEMBER → frontend-member-function
────────────────────────────────────────
```bash
git checkout main
git checkout -b frontend-member-function     # สร้าง+สลับเข้า branch member (แตกจาก main)
```

### 👉 จังหวะ COPY ไฟล์ (จากโฟลเดอร์ "Frontend - Member Page" → เข้าโปรเจกต์)
รันทีละบรรทัด (Git Bash):
```bash
M="/c/Users/Admin/Desktop/Frontend - Member Page"

# ไฟล์ของฟังก์ชัน Member (เจ้าของโดยตรง)
cp "$M/src/memberMock.ts"            src/memberMock.ts
cp "$M/src/pages/MemberJoin.tsx"     src/pages/MemberJoin.tsx
cp "$M/src/pages/MemberPay.tsx"      src/pages/MemberPay.tsx
cp "$M/src/pages/MemberGroup.tsx"    src/pages/MemberGroup.tsx
cp "$M/src/pages/MemberUI.tsx"       src/pages/MemberUI.tsx
cp "$M/src/pages/GroupsPage.tsx"     src/pages/GroupsPage.tsx

# ไฟล์ที่ใช้ร่วม (จาก _shared) — วางกลับตำแหน่งจริง
cp "$M/_shared (do-not-overwrite)/db.ts"     src/db.ts
cp "$M/_shared (do-not-overwrite)/types.ts"  src/types.ts
cp "$M/_shared (do-not-overwrite)/ui.tsx"    src/ui.tsx
cp "$M/_shared (do-not-overwrite)/main.tsx"  src/main.tsx
cp "$M/_shared (do-not-overwrite)/App.css"   src/App.css
```
> ทำมือก็ได้: เปิด File Explorer ลากไฟล์จากโฟลเดอร์ Member มาวางทับในโปรเจกต์ตามตำแหน่งเดียวกัน

### ตรวจ → commit → push
```bash
npm run build                    # ให้ tsc/vite ผ่านก่อน (สำคัญ)
git status                       # เห็นไฟล์ member ที่เปลี่ยน
git add -A
git commit -m "feat(member): หน้า Member + flow เข้า/ออกกลุ่ม (join/pay/leave/state)"
git push -u origin frontend-member-function     # อัปขึ้น GitHub เป็น branch ใหม่
```

────────────────────────────────────────
## ขั้น 3) สลับกลับมา main เพื่อตั้งหลักใหม่
────────────────────────────────────────
```bash
git checkout main                # กลับ main (สะอาด เพราะงาน member ถูก commit ไว้อีก branch แล้ว)
git status                       # ต้อง clean
git pull origin main             # sync อีกครั้งเผื่อมีคนอัปเดต
```

────────────────────────────────────────
## ขั้น 4) Branch งาน SERVICE (Main Menu) → frontend-service-function
────────────────────────────────────────
```bash
git checkout main
git checkout -b frontend-service-function    # สร้าง+สลับเข้า branch service (แตกจาก main จุดเดียวกับ member)
```

### 👉 จังหวะ COPY ไฟล์ (จากโฟลเดอร์ "Frontend - Main Menu Page" → เข้าโปรเจกต์)
```bash
S="/c/Users/Admin/Desktop/Frontend - Main Menu Page"

# ไฟล์ของฟังก์ชัน Service/Main Menu (เจ้าของโดยตรง)
cp "$S/src/pages/ServicesPage.tsx"    src/pages/ServicesPage.tsx
cp "$S/src/pages/AddServiceForm.tsx"  src/pages/AddServiceForm.tsx
cp "$S/src/pages/SubDetailPage.tsx"   src/pages/SubDetailPage.tsx

# ไฟล์ที่ใช้ร่วม (จาก _shared)
cp "$S/_shared (do-not-overwrite)/db.ts"                 src/db.ts
cp "$S/_shared (do-not-overwrite)/types.ts"              src/types.ts
cp "$S/_shared (do-not-overwrite)/ui.tsx"                src/ui.tsx
cp "$S/_shared (do-not-overwrite)/main.tsx"              src/main.tsx
cp "$S/_shared (do-not-overwrite)/App.css"               src/App.css
cp "$S/_shared (do-not-overwrite)/components/DatePicker.tsx" src/components/DatePicker.tsx
```

### ตรวจ → commit → push
```bash
npm run build
git add -A
git commit -m "feat(service): หน้าบริการ (Main Menu) + การ์ด role/state/due + รายจ่ายส่วนตัว"
git push -u origin frontend-service-function
```

────────────────────────────────────────
## หลัง push แล้ว
────────────────────────────────────────
- เปิด GitHub → จะเห็น 2 branch ใหม่ → กด "Compare & pull request" ทีละอันเพื่อขอ merge เข้า main
- Merge ทีละอัน (member ก่อน แล้ว service) — เสร็จอันแรก ให้ `git checkout main && git pull` ก่อนทำอันถัดไป

## หมายเหตุสำคัญ
- ไฟล์ `_shared` (db.ts, types.ts, ui.tsx, main.tsx, App.css) เป็นโค้ดที่ทั้ง 2 ฟังก์ชันใช้ร่วม
  เนื่องจากพัฒนามาด้วยกัน เนื้อหาจึงเหมือนกันทั้ง 2 branch → ตอน merge เข้ามักไม่ conflict
- ถ้า merge แล้วชน (ปกติที่ db.ts / App.css / main.tsx) ให้ **เก็บทั้งสองฝั่ง (both)** เพราะเป็นการเพิ่มบล็อกคนละที่
- ทุก branch ต้อง `npm run build` ผ่านก่อน push เสมอ
