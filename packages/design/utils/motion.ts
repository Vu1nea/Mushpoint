/**
 * Duration for a JS-driven transition. CSS motion is flattened by the
 * reduced-motion block in theme.css; framework transitions have to ask for
 * themselves, so they go through here.
 */
export function motion(ms: number): number {
	if (typeof window === 'undefined') return 0;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}

/** Per-row stagger for list entrance animations, capped so long lists stay snappy. */
export function stagger(index: number, step = 40, max = 320): string {
	return `${Math.min(index * step, max)}ms`;
}
