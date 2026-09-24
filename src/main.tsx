/* =====================================================================
   SubSub · จุดเริ่มต้นแอป + Router · main.tsx
   ---------------------------------------------------------------------
   ตั้ง route ทุกหน้าที่นี่ (SPA — หน้าเดียว สลับด้วย Router)
   ต่อ LIFF: เรียก liff.init() ก่อน render แล้วเซ็ต DB.setMe(profile)
   ===================================================================== */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

import './App.css';
import GroupsPage from './pages/GroupsPage';
import CreatePage from './pages/CreatePage';
import DetailPage from './pages/DetailPage';
import EditPage from './pages/EditPage';
import DashboardPage from './pages/DashboardPage';
import ServicesPage from './pages/ServicesPage';
import HowToPage from './pages/HowToPage';
import SubDetailPage from './pages/SubDetailPage';
import MemberJoin from './pages/MemberJoin';
import MemberPay from './pages/MemberPay';
import MemberGroup from './pages/MemberGroup';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/service" replace /> },
  { path: '/service', element: <ServicesPage /> },
  { path: '/howto', element: <HowToPage /> },
  { path: '/sub/:id', element: <SubDetailPage /> },
  { path: '/groups', element: <GroupsPage /> },
  { path: '/join', element: <MemberJoin /> },
  { path: '/member/pay', element: <MemberPay /> },
  { path: '/member/group', element: <MemberGroup /> },
  { path: '/member/group/:id', element: <MemberGroup /> },
  { path: '/create', element: <CreatePage /> },
  { path: '/group/:id', element: <DetailPage /> },
  { path: '/group/:id/edit', element: <EditPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
]);

/* ---------------------------------------------------------------------
   สำหรับ LIFF (เปิดใช้เมื่อ deploy ขึ้น LINE OA):
   -------------------------------------------------------------------
   import liff from '@line/liff';
   liff.init({ liffId: 'YOUR_LIFF_ID' }).then(() => {
     if (!liff.isLoggedIn()) { liff.login(); return; }
     return liff.getProfile();
   }).then(profile => {
     if (profile) DB.setMe({
       user_id: profile.userId, line_uid: profile.userId,
       display_name: profile.displayName, pic_user: profile.pictureUrl ?? '',
     });
     renderApp();
   });
   --------------------------------------------------------------------- */

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

renderApp();