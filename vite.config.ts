import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /* [B11] เปิดเครื่องมือทดสอบ (DevPanel / ข้อมูลสาธิต / เลื่อนเวลา) เฉพาะ
       • npm run dev                      → เปิด (mode = development)
       • npm run build                    → ปิดเสมอ (mode = production) → โค้ด dev ถูกตัดทิ้งทั้งหมด
       • npm run build -- --mode staging  → เปิดได้ ถ้าตั้ง VITE_DEV_TOOLS=true ใน .env.staging
     ค่า __DEV_TOOLS__ ถูกแทนเป็น true/false ตอน build → bundler ตัด branch ที่เป็น false ทิ้ง */
  const devTools = mode !== 'production' && (mode === 'development' || env.VITE_DEV_TOOLS === 'true')
  return {
    plugins: [react()],
    define: {
      __DEV_TOOLS__: JSON.stringify(devTools),
    },
  }
})
