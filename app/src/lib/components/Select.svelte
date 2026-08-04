<!-- app/src/lib/components/Select.svelte -->
<script lang="ts">
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';

	import { motion } from '$lib/motion';
	import { isOutside, Popover, portal } from '$lib/popover.svelte';
	import {
		flattenOptions,
		isGroup,
		labelFor,
		type SelectItem,
		type SelectOption
	} from '$lib/selectOptions';
	import Icon from './Icon.svelte';
	import { field } from './ui';

	interface Props {
		value: string;
		options: SelectItem[];
		id?: string;
		ariaLabel?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		options,
		id,
		ariaLabel,
		disabled = false,
		class: className = ''
	}: Props = $props();

	const popover = new Popover();
	const listboxId = $derived(`${id ?? 'select'}-listbox`);

	let root: HTMLElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined = $state();
	let panel: HTMLElement | undefined = $state();
	let highlighted = $state(0);

	const flat = $derived(flattenOptions(options));
	const selectedLabel = $derived(labelFor(options, value));
	const activeId = $derived(
		popover.open && flat[highlighted] ? `${listboxId}-${flat[highlighted].value}` : undefined
	);

	// Keep the highlighted row in view as arrow keys move past the visible
	// window — the panel is capped at max-h-70 (~7 rows) but option lists
	// (e.g. goals + subgoals) can easily run longer.
	$effect(() => {
		if (!popover.open) return;
		const option = flat[highlighted];
		if (!option) return;
		document.getElementById(`${listboxId}-${option.value}`)?.scrollIntoView({ block: 'nearest' });
	});

	function openPanel() {
		if (disabled || !trigger) return;
		const index = flat.findIndex((option) => option.value === value);
		highlighted = Math.max(0, index);
		popover.show(trigger);
	}

	function closePanel() {
		popover.hide();
	}

	function choose(optionValue: string) {
		value = optionValue;
		closePanel();
		trigger?.focus();
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (!popover.open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
				event.preventDefault();
				openPanel();
			}
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlighted = Math.min(highlighted + 1, flat.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const option = flat[highlighted];
			if (option) choose(option.value);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closePanel();
			trigger?.focus();
		}
	}

	function onTriggerFocusOut(event: FocusEvent) {
		if (!popover.open) return;
		const next = event.relatedTarget as Node | null;
		if (next && (root?.contains(next) || panel?.contains(next))) return;
		closePanel();
	}

	function onWindowMousedown(event: MouseEvent) {
		if (popover.open && isOutside(event, root, panel)) closePanel();
	}

	function onWindowScroll(event: Event) {
		if (!popover.open) return;
		// Ignore the listbox's own scroll (e.g. scrollIntoView on open/arrow-nav) —
		// only an outside scroll should close the panel.
		if (panel?.contains(event.target as Node)) return;
		closePanel();
	}

	function onWindowResize() {
		if (popover.open) closePanel();
	}
</script>

<svelte:window
	onmousedown={onWindowMousedown}
	onscrollcapture={onWindowScroll}
	onresize={onWindowResize}
/>

<div class="relative {className}" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		{id}
		{disabled}
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={popover.open}
		aria-controls={listboxId}
		aria-activedescendant={activeId}
		aria-label={ariaLabel}
		class="{field.input} flex w-full items-center justify-between gap-2 text-left font-medium disabled:cursor-not-allowed disabled:opacity-60 {disabled
			? ''
			: 'cursor-pointer'}"
		onclick={() => (popover.open ? closePanel() : openPanel())}
		onkeydown={onTriggerKeydown}
		onfocusout={onTriggerFocusOut}
	>
		<span class="truncate {selectedLabel ? '' : 'text-muted'}">{selectedLabel ?? '—'}</span>
		<Icon
			name="chevron-down"
			size={12}
			weight={2.2}
			class="shrink-0 text-muted transition-transform duration-200 {popover.open
				? 'rotate-180'
				: ''}"
		/>
	</button>
</div>

{#snippet optionRow(option: SelectOption)}
	{@const flatIndex = flat.findIndex((candidate) => candidate.value === option.value)}
	<!-- Keyboard nav is centralized on the trigger via aria-activedescendant; this option is
	     never itself focusable, so no keydown handler belongs here. -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<li
		id="{listboxId}-{option.value}"
		role="option"
		aria-selected={option.value === value}
		class="mx-1.5 flex cursor-pointer items-center justify-between gap-2 rounded-control px-2.5 py-2 text-sm transition-colors {flatIndex ===
		highlighted
			? 'bg-surface'
			: ''}"
		onclick={() => choose(option.value)}
		onmouseenter={() => (highlighted = flatIndex)}
	>
		<span class="truncate">{option.label}</span>
		{#if option.value === value}
			<Icon name="check" size={13} weight={2.4} class="shrink-0 text-accent" />
		{/if}
	</li>
{/snippet}

{#if popover.open}
	<ul
		use:portal
		bind:this={panel}
		id={listboxId}
		role="listbox"
		class="fixed z-50 max-h-70 overflow-y-auto rounded-control border border-subtle bg-surface-raised py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]"
		style="top: {popover.top}px; left: {popover.left}px; width: {popover.width}px;"
		transition:scale={{ start: 0.92, duration: motion(160), easing: backOut }}
		onmousedown={(event) => event.preventDefault()}
	>
		{#each options as item, index (isGroup(item) ? `group-${index}` : item.value)}
			{#if isGroup(item)}
				<li
					class="px-3.25 pt-2.5 pb-1 text-2xs font-semibold tracking-[0.06em] text-muted uppercase"
					role="presentation"
				>
					{item.label}
				</li>
				{#each item.options as option (option.value)}
					{@render optionRow(option)}
				{/each}
			{:else}
				{@render optionRow(item)}
			{/if}
		{/each}
	</ul>
{/if}
