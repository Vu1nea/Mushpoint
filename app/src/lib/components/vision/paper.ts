// Look shared by the vision board and the dashboard's board preview.

/** Sticky-note paper colors for quote-only items. Dark ink on all of them
 * keeps contrast in both themes. */
const NOTES = [
	'bg-yellow-200',
	'bg-pink-200',
	'bg-sky-200',
	'bg-lime-200',
	'bg-orange-200',
	'bg-violet-200'
];

/** Small fixed tilts in degrees; picked by id so a card keeps its look. */
const TILTS = [-2.5, 1.5, -1, 2.5, -1.8, 1, -0.6, 2];

export const tiltOf = (id: number) => TILTS[id % TILTS.length];
export const noteColorOf = (id: number) => NOTES[(id * 7) % NOTES.length];

/** The dotted surface the paper is pinned to. */
export const boardSurface =
	'rounded-card border border-subtle bg-surface/60 bg-[radial-gradient(color-mix(in_srgb,var(--color-content)_14%,transparent)_1px,transparent_1px)] bg-size-[20px_20px]';
