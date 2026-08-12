/**
 * Shared floating-panel mechanics for Select and DatePicker: position a panel
 * off a trigger's rect, portal it to <body> so it escapes any overflow-hidden
 * ancestor (cards, drawers, the sidebar), and close it on outside click.
 *
 * Position is computed once on open, not tracked live — a scroll/resize while
 * open closes the panel instead, same trade-off already made in Tooltip.svelte.
 */
export class Popover {
	open = $state(false);
	top = $state(0);
	left = $state(0);
	width = $state(0);

	#anchor: HTMLElement | undefined;

	show(anchor: HTMLElement) {
		this.#anchor = anchor;
		this.#place();
		this.open = true;
	}

	hide() {
		this.open = false;
	}

	#place() {
		if (!this.#anchor) return;
		const rect = this.#anchor.getBoundingClientRect();
		this.top = rect.bottom + 6;
		this.left = rect.left;
		this.width = rect.width;
	}

	/**
	 * Nudge the panel back on-screen once its real width is known (after it
	 * mounts) — anchors near the right edge would otherwise run the panel off
	 * the viewport, since #place only knows the anchor's position, not the
	 * panel's own size.
	 */
	clampHorizontal(panelWidth: number, margin = 8) {
		const maxLeft = window.innerWidth - panelWidth - margin;
		this.left = Math.max(margin, Math.min(this.left, maxLeft));
	}
}

/** Reparents the node to <body> on mount, removes it on destroy. */
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}

export function isOutside(event: MouseEvent, ...nodes: Array<HTMLElement | undefined>): boolean {
	const target = event.target as Node;
	return nodes.every((node) => !node || !node.contains(target));
}
