# SubSub — Project State Snapshot

LIFF (LINE) subscription cost-sharing app · โค้ดจริง `C:\Users\Admin\Desktop\subsub-frontend\`

## 1. Tech Stack & Libraries
- **Language:** TypeScript 6 (strict: no any, noUnusedLocals/Params)
- **Framework:** React 19 + Vite 8 · **Routing:** react-router-dom 7 (`createBrowserRouter`)
- **Charts:** recharts (Dashboard) · **LINE:** `@line/liff` (mock; `liff.init()` ยัง comment ใน `main.tsx`)
- **Styling:** design system เดียว `src/App.css` (ไม่ใช้ Tailwind) · tokens: `--gold --grad --green --ink --chip --radius`, Noto Sans Thai, phone shell 440px
- **Data:** `src/db.ts` = localStorage (mirror endpoint NestJS/Prisma อนาคต) · `src/types.ts` = โมเดลตาม Prisma
- **Build:** `npm run build` = `tsc -b && vite build` (ต้องรันบน Windows — node_modules มี native binding rolldown ของ win)

## 2. Project Structure & Flow
- `src/pages/` ทุกหน้า · `src/ui.tsx` Icon/NavBar/toast/CategoryPicker · `src/db.ts` `src/types.ts` `src/App.css` · `src/components/DatePicker.tsx`
- `src/lib/` = `date.ts` (วันที่เวลาไทย) · `clock.ts` (นาฬิกากลาง) · `billing.ts` (กฎรอบบิล/ค้างชำระ/ราคา — pure) · `store.ts` (localStorage)
- `src/dev/` = เครื่องมือทดสอบ/ข้อมูลสาธิตทั้งหมด (โหลดผ่าน `__DEV_TOOLS__` เท่านั้น — ไม่เข้า production)
- **Routes:** `/service` `/howto` `/sub/:id` `/groups` `/join` `/member/pay` `/member/group` `/member/group/:id` `/create` `/group/:id` `/group/:id/edit` `/dashboard`
- **Flow Member:** `/join` (รหัส) → `/member/pay` (ยอด pro-rata + สลิป) → `/member/group/:id` (สถานะ/สลิปรอบถัดไป/ออกกลุ่ม)
- **Flow Host:** `/groups` → `/create` `/group/:id` (จัดการสมาชิก/สลิป) `/edit` `/dashboard`
- **สถาปัตย์:** `db.ts` = single data layer, ทุกเมธอด map 1:1 กับ endpoint จริง; สถานะการจ่ายทุกที่มาจาก `memberBillStatus()` ตัวเดียว (Host = Member)

## 3. Completed Features
- **[fix/billing-cycle B1–B13]** บัญชีโอนจาก `group.bankDT` · เวลาไทยทั้งระบบ · วันเริ่มรอบแรก = วันที่สร้างกลุ่ม + วันที่เลือก (ไม่ไหล 31→1/28) · สถานะ window(D-3)/due/overdue(D+5)/เตะอัตโนมัติ(D+10) + Pop-up + นับถอยหลัง · Pending จองที่นั่ง · Host เห็นค้างชำระ + ปุ่มแจ้งเตือน + ดูสลิปจริง/ประวัติ · อนุมัติด้วย payment_id · ราคาใหม่มีผลตามรอบบิล · แยก dev tools ออกจาก production · self-test `npm run test:billing`
- **Data layer เดียว** — รวม/ลบ `memberMock.ts` เข้า `db.ts` ทั้งหมด (แยก host/member routing ตาม role)
- **Pro-rata "Mr.Sub"** (`computeJoinQuote`) — เข้าวันตัดรอบ = ส่วนแบ่งเต็ม (`total/slots`); กลางรอบ = (rate/วัน × วันคงเหลือ) + ล่วงหน้าเดือนถัดไป 1 ส่วน
- **Join validation** — `joinByCode`: `ok / notfound / full` (เต็มเช็ค active ≥ max_slots) พร้อมข้อความ UI
- **Slip upload** — จำกัด jpg/jpeg/png ≤ 5MB, error toast, มี disabled state (สีเทา)
- **Leave flow** — สมาชิกขอออก → โฮสต์อนุมัติ (`leave_approved`) → ยังอยู่จนขึ้นรอบใหม่ → `startNewCycle` นำออก + ที่นั่งว่าง
- **Permissions** — Member = read-only (ไป `/member/group/:id`); `DetailPage` gate ส่วนคำขอเข้า/แก้ไข/ลบ = โฮสต์เท่านั้น
- **Recurring payment (เดือน 2+)** — ใช้ `SlipUploader` + validation ชุดเดียวกับบิลแรก
- **Member statuses** — `paid/review/due/warned(เตือนสมาชิก)/pending_leave(ลบสมาชิก)/nopay(ไม่ต้องจ่าย)`; โฮสต์มี `warnMember` / `approveLeave`
- **Member group detail** — roster เห็นสมาชิกทั้งกลุ่ม+สถานะ · avatar = รูปโปรไฟล์ LINE (`pic_user`) ไม่มีก็ใช้อักษรแรกกลางวง · ราคาเต็ม + ยอดหารต่อหัว · ที่นั่งว่าง · กล่องอัปโหลดโชว์ตลอด (เทาเมื่อจ่ายแล้ว/ยังไม่ถึงกำหนด)
- **หน้าลิสต์ Member** — โชว์ทั้งราคาเต็มและราคาหาร + จำนวน slot ว่าง
- **UI** — สี `.duecard` ตรงกับ `.dash-hero` (Services); Host: groups/create/detail/edit/dashboard (donut + bar 6 เดือน)

## 4. Current In-Progress / ต้องต่อ
- **ยังไม่ต่อ backend จริง** (NestJS/Prisma) — `db.ts` เป็น facade พร้อม swap localStorage → HTTP
- **LIFF init ยัง comment** ใน `main.tsx` (mock ME = 'ฉัน') → เปิดจริง + `DB.setMe(profile)` + `.env` `VITE_LIFF_ID`
- **ไม่มี scheduler/push จริง** — การเตะอัตโนมัติ/ปล่อยที่นั่งทำใน `reconcile()` ตอนเปิดหน้า (backend ต้องทำเป็น cron รายวัน + LINE push แทนปุ่ม 🔔)
- **field ชั่วคราวยังไม่มีใน Prisma schema:** `Group._billing_cycle _billing_day _created_at _closed_at _deposit _pricing_history` · `Payment._kind _cycle _reject_reason _reviewed_at` · `Member.leaving _leave_effective _waived_cycles _owe_full _reminded_at _removed_reason left_date`
- **Dead code:** `pages/_deprecated/JoinPage.tsx.bak`
- **Lint:** `react-refresh/only-export-components` ที่ `MemberUI.tsx` (export `MIcon`/`th2`) — pre-existing, ไม่บล็อก build
- **รอตัดสินใจ (privacy):** ตอนนี้ roster โชว์สถานะการจ่ายของสมาชิกคนอื่นให้ member เห็น — จะซ่อนเฉพาะของคนอื่นไหม

## 5. Coding Rules (ห้ามเปลี่ยน)
- **TypeScript เท่านั้น** — ห้าม any / type error / import-ตัวแปรที่ไม่ได้ใช้ (`tsc -b` ต้องผ่าน)
- **ใช้ `App.css` design system กลางเท่านั้น** — ห้าม re-skin เป็น Tailwind
- **overwrite ไฟล์เดิมในเครื่องตรง ๆ** และ **อ่านไฟล์เวอร์ชันล่าสุดก่อนแก้เสมอ** (ห้ามสร้างไฟล์ copy/ทางเลือกใหม่)
- **import CSS ตรง case:** `import './App.css'` (Linux/Vercel case-sensitive)
- **`db.ts` แต่ละฟังก์ชัน map 1:1 กับ endpoint NestJS/Prisma; `types.ts` ตรง Prisma schema**
- **ให้โค้ดเต็มไฟล์เวลาแก้** (ไม่ตัดเป็น snippet) และ **ตอบเป็นภาษาไทย**
