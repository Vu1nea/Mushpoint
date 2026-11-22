import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from './api/error';
import { request } from './api/http';
import { uploadImage } from './images';

vi.mock('./api/http', () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

function fileOf(bytes: number, type: string, name = 'a.png'): File {
	return new File([new Uint8Array(bytes)], name, { type });
}

beforeEach(() => {
	requestMock.mockReset();
});

describe('uploadImage', () => {
	it('rejects a file over 5 MB before sending anything', async () => {
		const upload = uploadImage(fileOf(6 * 1024 * 1024, 'image/png'));
		await expect(upload).rejects.toBeInstanceOf(AppError);
		await expect(upload).rejects.toMatchObject({
			kind: 'validation',
			message: 'Images must be 5 MB or smaller.'
		});
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('rejects a type that is not an accepted image', async () => {
		await expect(uploadImage(fileOf(10, 'text/plain', 'a.txt'))).rejects.toMatchObject({
			kind: 'validation',
			message: 'Choose a PNG, JPEG, WebP or GIF image.'
		});
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('posts the file as multipart field `file` and resolves the server response', async () => {
		const response = { imagePath: 'u/x.png', imageUrl: 'https://cdn.test/x.png' };
		requestMock.mockResolvedValue(response);
		const file = fileOf(10, 'image/png');

		await expect(uploadImage(file)).resolves.toEqual(response);

		expect(requestMock).toHaveBeenCalledTimes(1);
		const [method, path, body] = requestMock.mock.calls[0];
		expect(method).toBe('POST');
		expect(path).toBe('/vision-images');
		expect(body).toBeInstanceOf(FormData);
		expect((body as FormData).get('file')).toBe(file);
	});
});
