/** Génère les icônes PWA (PNG) à partir d'un SVG inline, dans public/. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ORANGE = "#FF3D00";

function svg(taille: number, maskable: boolean): string {
  const r = maskable ? 0 : Math.round(taille * 0.22);
  const marge = maskable ? taille * 0.12 : taille * 0.06;
  const fontSize = Math.round((taille - marge * 2) * 0.46);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" rx="${r}" ry="${r}" fill="${ORANGE}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Barlow Condensed, Impact, Arial Narrow, DejaVu Sans Condensed, sans-serif"
        font-weight="700" font-size="${fontSize}" fill="#FFFFFF" letter-spacing="${Math.round(taille * 0.01)}">EB</text>
  <rect x="${taille * 0.3}" y="${taille * 0.76}" width="${taille * 0.4}" height="${Math.max(2, taille * 0.03)}" rx="${taille * 0.015}" fill="#FFFFFF" opacity="0.9"/>
</svg>`;
}

async function main() {
  const dossier = path.resolve("public");
  await mkdir(dossier, { recursive: true });
  const cibles: [string, number, boolean][] = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, false],
    ["favicon-32.png", 32, false],
  ];
  for (const [nom, taille, maskable] of cibles) {
    const png = await sharp(Buffer.from(svg(taille, maskable))).png().toBuffer();
    await writeFile(path.join(dossier, nom), png);
    console.log("écrit", nom);
  }
  await writeFile(path.join(dossier, "icon.svg"), svg(512, false));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
