import { describe, expect, it } from 'vitest';
import { extensionOf } from './images';

describe('extensionOf', () => {
	it('extracts the extension including the dot', () => {
		expect(extensionOf('/Users/vinod/Pictures/sunset.png')).toBe('.png');
		expect(extensionOf('C:\\Users\\vinod\\Pictures\\sunset.JPEG')).toBe('.JPEG');
	});

	it('returns an empty string for a path with no extension', () => {
		expect(extensionOf('/Users/vinod/Pictures/sunset')).toBe('');
	});
});
