import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Crisp Minimalist SVG mark
// Calm, uncluttered, private productivity symbol: a stylized geometric vault & focus glyph with warm minimalist tones
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181B"/>
      <stop offset="100%" stop-color="#27272A"/>
    </linearGradient>
    <linearGradient id="glyphGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAFAFA"/>
      <stop offset="100%" stop-color="#D4D4D8"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
  </defs>
  
  <!-- Outer Rounded Container -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  
  <!-- Vault Arch & Shield outline -->
  <path d="M256 96 C178 96 140 144 140 220 L140 310 C140 376 200 416 256 428 C312 416 372 376 372 310 L372 220 C372 144 334 96 256 96 Z" 
        fill="none" stroke="url(#glyphGrad)" stroke-width="24" stroke-linejoin="round" stroke-linecap="round" />
  
  <!-- Minimalist Inner Core: Balance & Focus Glyph -->
  <circle cx="256" cy="240" r="36" fill="url(#accentGrad)" />
  <rect x="244" y="276" width="24" height="60" rx="12" fill="url(#accentGrad)" />
  <circle cx="256" cy="240" r="14" fill="#18181B" />
</svg>`;

// Maskable icon with safe zone padding (Android safe area is inner 80% circle)
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181B"/>
      <stop offset="100%" stop-color="#27272A"/>
    </linearGradient>
    <linearGradient id="glyphGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAFAFA"/>
      <stop offset="100%" stop-color="#D4D4D8"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
  </defs>
  
  <!-- Full-bleed background for maskable -->
  <rect width="512" height="512" fill="url(#bgGrad)" />
  
  <!-- Centered scaled glyph within safe 75% zone -->
  <g transform="translate(64, 64) scale(0.75)">
    <path d="M256 96 C178 96 140 144 140 220 L140 310 C140 376 200 416 256 428 C312 416 372 376 372 310 L372 220 C372 144 334 96 256 96 Z" 
          fill="none" stroke="url(#glyphGrad)" stroke-width="24" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="256" cy="240" r="36" fill="url(#accentGrad)" />
    <rect x="244" y="276" width="24" height="60" rx="12" fill="url(#accentGrad)" />
    <circle cx="256" cy="240" r="14" fill="#18181B" />
  </g>
</svg>`;

async function run() {
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
  fs.writeFileSync(path.join(publicDir, 'maskable.svg'), svgMaskable);

  const iconBuffer = Buffer.from(svgIcon);
  const maskableBuffer = Buffer.from(svgMaskable);

  await sharp(iconBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(iconBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(iconBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(iconBuffer).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.ico'));
  await sharp(maskableBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  console.log('Icons successfully generated in public directory!');
}

run().catch(console.error);
