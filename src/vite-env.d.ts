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