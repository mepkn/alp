// Draws the alp chain-link mark in the pastel-blue palette.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

// Usage: npm run icons  (writes into assets/images)
const OUT = process.argv[2] ?? "assets/images";
const NAVY = "#15264A";        // --primary-foreground (light)
const PASTEL = "#8CC2F2";      // --primary
const PASTEL_HI = "#B9DBFA";
const PASTEL_LO = "#78AEEA";
const DARK_BG = "#09090B";     // --background (dark)
const LIGHT_BG = "#EEF5FD";

// Two interlocking chain links, tilted 45°.
const links = `<g transform="rotate(-45 512 512)">
    <rect x="232" y="412" width="340" height="200" rx="100" fill="none" stroke-width="64"/>
    <rect x="452" y="412" width="340" height="200" rx="100" fill="none" stroke-width="64"/>
  </g>`;

function mark(stroke: string, scale = 1): string {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  return `<g transform="${t}" stroke="${stroke}">${links}</g>`;
}

const gradient = `<defs><radialGradient id="g" cx="0.25" cy="0.12" r="1.1">
  <stop offset="0" stop-color="${PASTEL_HI}"/><stop offset="0.55" stop-color="${PASTEL}"/><stop offset="1" stop-color="${PASTEL_LO}"/>
</radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;

// Monochrome (Android themed icons) only uses alpha.
const mono = mark("#fff", 0.62);

const svgs: Record<string, [size: number, body: string]> = {
  "icon.png": [1024, gradient + mark(NAVY)],
  "android-icon-background.png": [1024, gradient],
  // Adaptive icons are cropped to the centre ~66%, so the mark is scaled down.
  "android-icon-foreground.png": [1024, mark(NAVY, 0.62)],
  "android-icon-monochrome.png": [1024, mono],
  "splash-icon.png": [1024, mark(NAVY)],
  "splash-icon-dark.png": [1024, mark(PASTEL)],
  "favicon.png": [48, gradient + mark(NAVY)],
};

for (const [name, [size, body]] of Object.entries(svgs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`${OUT}/${name}`, png);
  console.log(name, size);
}
console.log("splash bg", LIGHT_BG, DARK_BG);
