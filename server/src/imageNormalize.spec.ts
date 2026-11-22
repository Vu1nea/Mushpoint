import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AppError } from './error';
import { AVATAR_SIZE, PICTURE_MAX, normalizeImage, preparedUpload, sniffImageType } from './images';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } });

const jpegWithGps = (width: number, height: number, orientation?: number) =>
  solid(width, height)
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1' } })
    .withMetadata(orientation ? { orientation } : {})
    .toBuffer();

const infoOf = (bytes: Uint8Array) => sharp(bytes).metadata();

describe('normalizeImage', () => {
  it('crops an avatar to a WebP square', async () => {
    const out = await normalizeImage(await jpegWithGps(941, 917), 'avatar');
    expect(out.type).toBe('image/webp');
    expect(sniffImageType(out.bytes)).toBe('image/webp');
    const info = await infoOf(out.bytes);
    expect([info.format, info.width, info.height]).toEqual(['webp', AVATAR_SIZE, AVATAR_SIZE]);
  });

  it('fits a large picture inside the maximum, keeping its shape', async () => {
    const out = await normalizeImage(await solid(4000, 2000).png().toBuffer(), 'picture');
    const info = await infoOf(out.bytes);
    expect([info.format, info.width, info.height]).toEqual(['webp', PICTURE_MAX, PICTURE_MAX / 2]);
  });

  it('never enlarges a small picture', async () => {
    const info = await infoOf((await normalizeImage(await solid(120, 80).png().toBuffer(), 'picture')).bytes);
    expect([info.width, info.height]).toEqual([120, 80]);
  });

  it('drops EXIF, including GPS, and other metadata', async () => {
    const input = await jpegWithGps(800, 600);
    expect((await infoOf(input)).exif).toBeDefined();
    for (const kind of ['avatar', 'picture'] as const) {
      const info = await infoOf((await normalizeImage(input, kind)).bytes);
      expect(info.exif).toBeUndefined();
      expect(info.xmp).toBeUndefined();
      expect(info.icc).toBeUndefined();
      expect(info.orientation).toBeUndefined();
    }
  });

  it('turns a photo upright from its EXIF orientation', async () => {
    // Orientation 6: stored landscape, shown rotated 90 degrees, so portrait.
    const info = await infoOf((await normalizeImage(await jpegWithGps(400, 200, 6), 'picture')).bytes);
    expect([info.width, info.height]).toEqual([200, 400]);
  });

  it('keeps an animated GIF animated', async () => {
    const frames = 3;
    // Distinct frames: the GIF encoder merges identical ones.
    const shades = await Promise.all(
      [10, 120, 250].map((r) =>
        sharp({ create: { width: 300, height: 300, channels: 3, background: { r, g: 0, b: 0 } } }).png().toBuffer()
      )
    );
    const gif = await sharp(shades, { join: { animated: true } }).gif().toBuffer();
    expect((await infoOf(gif)).pages).toBe(frames);
    for (const kind of ['avatar', 'picture'] as const) {
      const info = await infoOf((await normalizeImage(gif, kind)).bytes);
      expect(info.format).toBe('webp');
      expect(info.pages).toBe(frames);
    }
  });

  it('rejects bytes that start like an image but do not decode', async () => {
    const fake = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    await expect(normalizeImage(fake, 'picture')).rejects.toEqual(AppError.validation('unsupported image'));
  });

  it('rejects an image with more pixels than allowed before decoding it', async () => {
    const png = await solid(200, 200).png().toBuffer();
    await expect(normalizeImage(png, 'picture', 100 * 100)).rejects.toEqual(AppError.validation('unsupported image'));
  });
});

describe('preparedUpload', () => {
  it('checks the declared type, then normalizes', async () => {
    const buffer = await solid(50, 50).png().toBuffer();
    const out = await preparedUpload({ buffer, size: buffer.length, mimetype: 'image/png' }, 'avatar');
    expect(out.type).toBe('image/webp');
    await expect(preparedUpload({ buffer, size: buffer.length, mimetype: 'image/jpeg' }, 'avatar')).rejects.toEqual(
      AppError.validation('unsupported image')
    );
  });
});
