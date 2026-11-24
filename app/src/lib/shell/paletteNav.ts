/** Moves the highlighted result by `delta`, wrapping at both ends; -1 when there are none. */
export function moveIndex(current: number, delta: number, length: number): number {
	if (length <= 0) return -1;
	if (current < 0) return delta > 0 ? 0 : length - 1;
	return (current + delta + length) % length;
}

type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

/**
 * Whether a keydown should toggle the palette: Ctrl/Cmd+K, unless another modal
 * (a drawer, the mobile menu) is open. The palette itself may always close.
 */
export function shouldTogglePalette(
	event: KeyLike,
	paletteOpen: boolean,
	otherModalOpen: boolean
): boolean {
	if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'k') {
		return false;
	}
	return paletteOpen || !otherModalOpen;
}

/** Hands out request tokens; only the newest one is still current. */
export function createRequestCounter() {
	let latest = 0;
	return {
		next: () => ++latest,
		isCurrent: (token: number) => token === latest
	};
}
