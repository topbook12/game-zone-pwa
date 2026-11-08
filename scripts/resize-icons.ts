import sharp from 'sharp';
import fs from 'fs';

async function resizeIcons() {
  const master = '/home/z/my-project/public/images/icon-master.png';

  const sizes = [
    { size: 512, out: '/home/z/my-project/public/icons/icon-512.png' },
    { size: 192, out: '/home/z/my-project/public/icons/icon-192.png' },
    { size: 180, out: '/home/z/my-project/public/icons/apple-touch-icon.png' },
  ];

  for (const { size, out } of sizes) {
    await sharp(master)
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`✓ ${out} (${size}x${size})`);
  }

  // favicon
  await sharp(master)
    .resize(64, 64)
    .png()
    .toFile('/home/z/my-project/public/icons/favicon-64.png');
  console.log('✓ favicon-64.png (64x64)');
}

resizeIcons().catch(console.error);
