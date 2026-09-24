# SubSub — Frontend (Host + Member, merged)

LINE LIFF frontend for **SubSub**, a subscription cost-sharing app. This is the
**merged** codebase: the team's Host repo (`subsub-frontend`, TypeScript + React
+ its own CSS design system) with the **Member "Services" experience merged in**,
so Host and Member share one stack, one design system, and one data layer.

## Stack

- React 19 + react-router-dom 7 (SPA via `createBrowserRouter`)
- TypeScript (`tsc -b` on build)
- Vite 8
- recharts (dashboard charts)
- `@line/liff` (LIFF init wired in `main.tsx`, commented until you deploy)
- Plain-CSS design system in `src/App.css` (design tokens in `:root`)

## Run

```bash
npm install
npm run dev      # start dev server
npm run build    # tsc -b && vite build
```

## Routes (`src/main.tsx`)

| path | page | role |
| --- | --- | --- |
| `/` | → redirect to `/service` | — |
| `/service` | **ServicesPage** (บริการ) — spending summary, category filter, active subscriptions (group + solo), add new service | Member/all |
| `/join` | **JoinPage** — enter invite code to join a host's group | Member |
| `/groups` | **GroupsPage** — HOST/MEMBER tabbed list + FAB | both |
| `/create` | **CreatePage** — host creates a group/service | Host |
| `/group/:id` | **DetailPage** — group detail, approve/reject payments, manage members | Host |
| `/group/:id/edit` | **EditPage** — edit group | Host |
| `/dashboard` | **DashboardPage** (ภาพรวม) — charts | all |

## What was added in the merge (by role: Member "Services")

- **`src/pages/ServicesPage.tsx`** — the บริการ tab (was missing). Reuses the
  Host design system (`.dash-hero`, `.gcard`, `.chip`, `.fab`, `NavBar`) and pulls
  from the shared `db.ts` (`getMyGroups` + `getMySubscriptions` + `getDashboard`),
  so it shows **both** group subscriptions and solo (personal) subscriptions in one list.
- **`src/pages/AddServiceForm.tsx`** — the "+ เพิ่มบริการใหม่" flow, built to
  **mirror the Host `CreatePage`** (same `.form`/`.field`/`.chips`/toggle + confirm
  modal + validation), saving a solo `Subscription` via `DB.addSubscription`.
- **`src/pages/JoinPage.tsx`** — member enters an invite code → `DB.joinByCode`
  adds the current user as a `Pending` member (the Host then approves in DetailPage).
  This is the concrete Host↔Member handoff.
- **`src/db.ts`** — added `joinByCode(code)` (find group by `invite_code`, add me as
  Pending + create a waiting payment). Everything else in `db.ts`/`types.ts` is shared.
- **`src/ui.tsx`** — wired the "บริการ" nav button to `/service` and added a `people` icon.
- **`src/App.css`** — appended `.filterbar`, `.sechead2`, `.ktag`, `.addsvc` (Services-page bits only).
- **Fix:** `main.tsx` now imports `./App.css` (matched the real filename — the old
  lowercase `./app.css` breaks case-sensitive Linux builds e.g. Vercel).

## Data model

`src/types.ts` is Prisma-schema-accurate (User / Group / Group_Member / Payment /
Billing_Cycle / Subscription). `src/db.ts` is a localStorage-backed data-access layer
where each method maps 1:1 to a future NestJS + Prisma endpoint — swap the method
bodies for `fetch(...)` when the backend is ready. `Subscription` = personal/solo
expense; `Group` = shared. The Services page merges both.
