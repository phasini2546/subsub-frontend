/* =====================================================================
   SubSub · ประตูเดียวสู่เครื่องมือทดสอบ · dev/index.ts                [B11]
   ---------------------------------------------------------------------
   หน้าจริง import จากไฟล์นี้ไฟล์เดียว:
     • __DEV_TOOLS__ = true  (npm run dev)   → โหลด DevPanel/devDb แบบ lazy
     • __DEV_TOOLS__ = false (npm run build) → ทุกอย่างเป็น null, dynamic import ถูกตัดทิ้ง
       → ไฟล์ DevPanel.tsx / devDb.ts / mock.ts ไม่ถูก bundle เลย
   ===================================================================== */
import { lazy } from 'react';
import type { Group } from '../types';

export const DEV_TOOLS: boolean = __DEV_TOOLS__;

export const DevPanels = __DEV_TOOLS__
  ? {
      Services:    lazy(() => import('./DevPanel').then(m => ({ default: m.ServicesDevPanel }))),
      MemberGroup: lazy(() => import('./DevPanel').then(m => ({ default: m.MemberGroupDevPanel }))),
      Detail:      lazy(() => import('./DevPanel').then(m => ({ default: m.DetailDevPanel }))),
      Dashboard:   lazy(() => import('./DevPanel').then(m => ({ default: m.DashboardDevPanel }))),
    }
  : null;

/** รหัสเชิญสาธิต (DISNEY-99 / NFLX-2026 / SPOTIFY-7) — production คืน null เสมอ */
export function resolveDemoCode(normalized: string): Promise<Group | null> {
  return __DEV_TOOLS__
    ? import('./devDb').then(m => m.resolveDemoCode(normalized))
    : Promise.resolve(null);
}
