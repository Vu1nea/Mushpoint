<script lang="ts" generics="T extends string">
	/**
	 * Underlined tab bar (WAI-ARIA tabs pattern). Pair each tab with a panel:
	 * `<div role="tabpanel" id={tabPanelId(id, value)} aria-labelledby={tabId(id, value)}>`.
	 * Arrow keys / Home / End move between tabs and select them.
	 */
	import { tabId, tabPanelId } from './tabIds';

	let {
		tabs,
		value,
		onChange,
		id,
		label,
		class: className = ''
	}: {
		tabs: readonly { value: T; label: string }[];
		value: T;
		onChange: (next: T) => void;
		/** Unique prefix for tab and panel ids. */
		id: string;
		/** Accessible name for the tab list. */
		label: string;
		class?: string;
	} = $props();

	let list: HTMLElement | undefined = $state();

	function onKeydown(event: KeyboardEvent) {
		const index = tabs.findIndex((tab) => tab.value === value);
		let next = index;
		if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = tabs.length - 1;
		else return;
		event.preventDefault();
		onChange(tabs[next].value);
		list?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
	}
</script>

<div
	bind:this={list}
	role="tablist"
	aria-label={label}
	tabindex="-1"
	class="flex gap-5 border-b border-subtle {className}"
	onkeydown={onKeydown}
>
	{#each tabs as tab (tab.value)}
		{@const selected = tab.value === value}
		<button
			type="button"
			role="tab"
			id={tabId(id, tab.value)}
			aria-selected={selected}
			aria-controls={tabPanelId(id, tab.value)}
			tabindex={selected ? 0 : -1}
			class="-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {selected
				? 'border-accent text-content'
				: 'border-transparent text-muted hover:text-content'}"
			onclick={() => onChange(tab.value)}
		>
			{tab.label}
		</button>
	{/each}
</div>
