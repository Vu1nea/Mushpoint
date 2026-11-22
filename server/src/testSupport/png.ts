import sharp from 'sharp';

/** A small, real PNG. Uploads are decoded and re-encoded, so magic bytes alone no longer pass. */
export const TEST_PNG: Buffer = await sharp({
  create: { width: 64, height: 48, channels: 3, background: '#c87828' }
})
  .png()
  .toBuffer();
