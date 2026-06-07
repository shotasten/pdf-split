import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "assets", "logo.svg");
const outputDir = path.join(root, "public", "icons");

const icons = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-48x48.png", size: 48 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192x192.png", size: 192 },
  { file: "icon-512x512.png", size: 512 },
  { file: "maskable-icon-512x512.png", size: 512, padding: 44 }
];

await mkdir(outputDir, { recursive: true });

for (const icon of icons) {
  const innerSize = icon.padding ? icon.size - icon.padding * 2 : icon.size;
  const image = sharp(source).resize(innerSize, innerSize, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  });

  const pipeline = icon.padding
    ? image.extend({
        top: icon.padding,
        right: icon.padding,
        bottom: icon.padding,
        left: icon.padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
    : image;

  await pipeline.png().toFile(path.join(outputDir, icon.file));
}

const manifest = {
  name: "PDF見開き分割くん",
  short_name: "PDF分割くん",
  description: "見開きPDFを左右または上下に分割するブラウザ完結型ツール",
  lang: "ja",
  start_url: "/",
  display: "standalone",
  background_color: "#f5fafc",
  theme_color: "#6fa7bc",
  icons: [
    {
      src: "/icons/icon-192x192.png",
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: "/icons/icon-512x512.png",
      sizes: "512x512",
      type: "image/png"
    },
    {
      src: "/icons/maskable-icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    }
  ]
};

await writeFile(
  path.join(root, "public", "site.webmanifest"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`Generated ${icons.length} icons and site.webmanifest.`);
