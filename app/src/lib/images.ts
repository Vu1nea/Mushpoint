import { AppError } from './api/error';
import { request } from './api/http';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Uploads a vision image and returns its stored path plus a signed URL to
 * preview it. Type and size are checked here for a fast error; the server
 * still checks the bytes and is the authority. */
export async function uploadImage(
	file: File
): Promise<{ imagePath: string; imageUrl: string | null }> {
	if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
		throw AppError.validation('Choose a PNG, JPEG, WebP or GIF image.');
	}
	if (file.size > MAX_IMAGE_BYTES) {
		throw AppError.validation('Images must be 5 MB or smaller.');
	}
	const body = new FormData();
	body.append('file', file);
	return request('POST', '/vision-images', body);
}
