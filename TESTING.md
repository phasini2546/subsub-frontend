# SubSub — Member testing guide (manual)

This guide walks through **every function in the Member flow** using the built-in
**Dev Test Panel** (on the บริการ/Services page) plus the normal UI. Everything is
mocked in `localStorage` via `src/db.ts` — no backend needed.

> **How the mock works (read this first).** There is one "current user" (`ME`) in
> `db.ts`. Because the mock has no auth, you can drive **both** the member side and
> the host side as `ME` — e.g. you can open a group you joined and approve your own
> request. That's intentional for local testing. (In production this becomes a
> role-aware screen; see README → recommendations.)

## 0. Start

```bash
npm install
npm run dev
```

Open the dev URL. The app lands on **บริการ (Services)**. Scroll to the bottom —
the dashed **“🧪 โหมดทดสอบ Member (Dev)”** panel is your control center.

Each localStorage table: `subsub_user`, `subsub_group`, `subsub_group_member`,
`subsub_payment`, `subsub_billing_cycle`, `subsub_subscription`. You can inspect
them in DevTools → Application → Local Storage at any time.

---

## 1. Solo subscription: add → edit → delete  (`Subscription`)

| Step | Action | Expected | Function |
| --- | --- | --- | --- |
| 1.1 | Services → **+ เพิ่มบริการใหม่** | Add-service form (mirrors Host create) | — |
| 1.2 | Fill name/price, pick a **หมวดหมู่** row, note the reminder alert, tap **บันทึกข้อมูล** → **Confirm** | Toast “เพิ่มบริการ …”, new **เดี่ยว** card appears | `DB.addSubscription` |
| 1.3 | On that solo card tap **แก้ไข**, change the price, save | Card shows new price | `DB.updateSubscription` |
| 1.4 | Tap **ลบ** → **ลบรายการ** | Card disappears | `DB.deleteSubscription` |
| 1.5 | Tap a **หมวดหมู่** chip in the filter bar | List filters to that category | client filter |

Check `subsub_subscription` in DevTools after each step.

---

## 2. Join a group by invite code  (`Member` becomes `Pending`)

| Step | Action | Expected | Function |
| --- | --- | --- | --- |
| 2.1 | Test panel → **① สร้างกลุ่มสาธิต + คัดลอกรหัสเชิญ** | Toast shows a code like `SUB-AB12` (already copied). Creates a group hosted by “โฮสต์ตัวอย่าง” with 1 active member + 1 pending request | `DB.seedDemoGroup` |
| 2.2 | Test panel → **② ไปหน้าเข้าร่วมกลุ่ม**, paste the code, **เข้าร่วมเลย** | Toast “ส่งคำขอเข้ากลุ่มเรียบร้อย…”, returns to Groups | `DB.joinByCode` |
| 2.3 | Groups → **MEMBER** tab | The seeded group now appears (you are a member) | `DB.getMyGroups` |

Edge cases to try in 2.2: paste a wrong code → “ไม่พบรหัสนี้…”; paste the same code
twice → “คุณอยู่ในกลุ่มนี้อยู่แล้ว”; a full group → “สมาชิกเต็มแล้ว”.

`joinByCode` also creates a **Waiting** payment (service + deposit) — this is the
mock's stand-in for “member paid the join amount / uploaded a slip.”

---

## 3. Host reviews the slip: approve / reject  (status changes)

Open the group: Groups → tap the seeded group card (or the MEMBER-tab card) → **DetailPage**.

| Step | Action | Expected | Function |
| --- | --- | --- | --- |
| 3.1 | In **คำขอเข้าร่วม (requests)**, tap **ผู้ขอเข้า B**’s review pill → **อนุมัติการชำระเงิน** | B moves to Members as **จ่ายแล้ว** (paid) | `DB.approvePayment` |
| 3.2 | Repeat for **your own** pending request → approve | Your status → **Active / จ่ายแล้ว** | `DB.approvePayment` |
| 3.3 | Instead of approving, open a slip → **ปฏิเสธ**, pick a reason | Member returns to **ค้างจ่าย** (unpaid), reason stored | `DB.rejectPayment` |

Status mapping (`deriveStatus`): no payment → `unpaid`; Waiting → `review`
(amber pill); Verified → `paid` (green); Rejected → back to `unpaid`.

---

## 4. Member pays a monthly round  (`payMonthly`)

DetailPage has its own dashed **test panel** (host-side simulation of members).

| Step | Action | Expected | Function |
| --- | --- | --- | --- |
| 4.1 | DetailPage test panel → **“สมาชิกจ่ายรอบใหม่”** (or similar) | A non-host member gets a new **Waiting** payment (review pill) | `DB.payMonthly` |
| 4.2 | Open that member’s slip → **อนุมัติ** | Member → **จ่ายแล้ว** | `DB.approvePayment` |

---

## 5. Member requests to leave  (`requestLeave`)

| Step | Action | Expected | Function |
| --- | --- | --- | --- |
| 5.1 | DetailPage test panel → **“สมาชิกขอออกจากกลุ่ม”** | Member row shows **กำลังออก / leaving** (gray pill) | `DB.requestLeave` |
| 5.2 | Host → remove member (manage menu) | Member removed / `left_date` set | `DB.removeMember` |

---

## 6. New billing cycle  (`startNewCycle`)

| Step | Action | Expected | Function |
| --- | --- | --- | --- |
| 6.1 | DetailPage test panel → **“ขึ้นรอบบิลใหม่”** | Old payments archived (`_archived`), everyone resets to unpaid for the new period; a `subsub_billing_cycle` row is added | `DB.startNewCycle` |
| 6.2 | Members pay again (step 4) | New Waiting payments for the new cycle | `DB.payMonthly` |

---

## 7. Spending totals & dashboard

| Step | Action | Expected | Function |
| --- | --- | --- | --- |
| 7.1 | Go to **บริการ** | Hero “ค่าใช้จ่ายเดือนนี้ / รายปี” reflects your groups + solo subs | `DB.getDashboard` |
| 7.2 | Go to **ภาพรวม** | Category breakdown, donut, 6-month bar chart update | `DB.getDashboard`, `DB.getSpendingHistory` |

---

## 8. Reset

Test panel → **♻︎ รีเซ็ตข้อมูลทดสอบทั้งหมด** clears all tables (`DB.reset`) and keeps
only `ME`. Use it between test runs for a clean slate.

---

## Function coverage checklist

- [x] Add / edit / delete solo subscription — `addSubscription` / `updateSubscription` / `deleteSubscription`
- [x] Join group by code — `joinByCode` (creates Pending member + Waiting payment)
- [x] Host approve / reject slip; status changes — `approvePayment` / `rejectPayment` / `deriveStatus`
- [x] Member monthly payment — `payMonthly`
- [x] Request leave / remove member — `requestLeave` / `removeMember`
- [x] New billing cycle — `startNewCycle`
- [x] Spending summary / dashboard — `getDashboard` / `getSpendingHistory`

## Known limitation (by design, for now)

The member-facing **pay / upload-slip** screens aren't built yet — `DetailPage` is
the host's view, and member payment is exercised via its test panel + the Waiting
payment created on join. Porting a dedicated member payment screen (backed by
`DB.payMonthly` + a real slip upload) is the recommended next step.
