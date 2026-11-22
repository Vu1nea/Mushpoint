/** Moves the highlighted result by `delta`, wrapping at both ends; -1 when there are none. */
export function moveIndex(current: number, delta: number, length: number): number {
	if (length <= 0) return -1;
	if (current < 0) return delta > 0 ? 0 : length - 1;
	return (current + delta + length) % length;
}
