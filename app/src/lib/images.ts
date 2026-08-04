import { copyFile, exists, mkdir, remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

const IMAGES_DIR = 'images';
const EXTENSION_PATTERN = /\.[^./\\]+$/;

/** Pure — extracts the extension (with dot) from a path, defaulting to an
 * empty string when the source has none. Exported for testing; every other
 * function here calls into Tauri plugins and only runs inside the app. */
export function extensionOf(path: string): string {
	const match = EXTENSION_PATTERN.exec(path);
	return match ? match[0] : '';
}

/** Opens the native file picker filtered to images and copies the chosen
 * file into `<appDataDir>/images/<uuid><ext>`. Returns the relative path
 * (`images/<uuid><ext>`) to store as `VisionItem.imagePath`, or null if the
 * user cancels. The copy happens immediately on pick rather than deferred
 * to the caller's save — see `VisionItemDrawer.svelte` for the accepted
 * trade-off (a picked-then-cancelled replacement leaves one unused file on
 * disk; harmless clutter, not a correctness issue). */
export async function pickAndCopyImage(): Promise<string | null> {
	const selected = await open({
		multiple: false,
		filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
	});
	if (!selected || Array.isArray(selected)) return null;

	await mkdir(IMAGES_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
	const relativePath = `${IMAGES_DIR}/${crypto.randomUUID()}${extensionOf(selected)}`;
	await copyFile(selected, relativePath, { toPathBaseDir: BaseDirectory.AppData });
	return relativePath;
}

/** Deletes a previously-copied image. Checks existence first so deleting an
 * already-missing file is a silent no-op rather than an error the caller
 * has to handle. */
export async function deleteImage(relativePath: string): Promise<void> {
	const isPresent = await exists(relativePath, { baseDir: BaseDirectory.AppData });
	if (isPresent) await remove(relativePath, { baseDir: BaseDirectory.AppData });
}

/** Resolves a stored relative path to a URL an `<img>` tag can load. */
export async function resolveImageSrc(relativePath: string): Promise<string> {
	const full = await join(await appDataDir(), relativePath);
	return convertFileSrc(full);
}
