// PWA 아이콘 생성 — 초록 라운드 배경 + 흰 접시/포크 심볼. sharp로 PNG 렌더.
// 실행: node scripts/gen-icons.mjs  (sharp 필요: npm i sharp --no-save)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#16a34a"/>
  <circle cx="256" cy="262" r="120" fill="none" stroke="#ffffff" stroke-width="22"/>
  <circle cx="256" cy="262" r="70" fill="#ffffff" opacity="0.18"/>
  <rect x="150" y="120" width="14" height="150" rx="7" fill="#ffffff"/>
  <rect x="348" y="120" width="14" height="150" rx="7" fill="#ffffff"/>
  <rect x="176" y="120" width="12" height="80" rx="6" fill="#ffffff"/>
  <rect x="202" y="120" width="12" height="80" rx="6" fill="#ffffff"/>
</svg>`;

const targets = [
  { size: 192, file: "public/pwa-192x192.png" },
  { size: 512, file: "public/pwa-512x512.png" },
  { size: 180, file: "public/apple-touch-icon.png" },
];

for (const { size, file } of targets) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
