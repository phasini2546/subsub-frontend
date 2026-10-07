/// <reference types="vite/client" />

/* ประกาศชนิดให้ import ไฟล์รูป (.png/.svg/...) ใน TypeScript ได้ */
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
/* [B11] true เฉพาะตอน dev/staging — ตั้งค่าใน vite.config.ts (production = false เสมอ) */
declare const __DEV_TOOLS__: boolean;
