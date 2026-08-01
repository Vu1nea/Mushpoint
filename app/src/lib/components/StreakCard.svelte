<script lang="ts">
	import { RECURRENCE_LABELS, type StreakCard } from '$lib/api';
	import Checkbox from './Checkbox.svelte';
	import Icon from './Icon.svelte';
	import StreakHeatmap from './StreakHeatmap.svelte';

	interface Props {
		card: StreakCard;
		busy?: boolean;
		/** Omitted on read-only surfaces, like the Phase 7 dashboard widget. */
		onToggle?: (done: boolean) => void;
	}

	let { card, busy = false, onToggle }: Props = $props();

	const cadence = $derived(
		card.task.recurrence ? RECURRENCE_LABELS[card.task.recurrence] : 'One-off'
	);
</script>

<div class="rounded-[14px] border border-subtle bg-surface p-[18px]">
	<div class="mb-3 flex items-center gap-2.5">
		<Icon name="flame" size={14} class="shrink-0 text-accent" />
		<span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{card.task.title}</span>
		<b class="text-sm tabular-nums">{card.current}</b>
		<span class="text-xs text-muted">best {card.longest}</span>
	</div>

	<div class="mb-3 flex items-center justify-between gap-3">
		<span class="text-[11.5px] text-muted">{cadence}</span>
		{#if onToggle}
			<Checkbox
				checked={card.doneToday}
				disabled={busy}
				label="Done today: {card.task.title}"
				showLabel={false}
				onchange={(done) => onToggle(done)}
			/>
		{/if}
	</div>

	<StreakHeatmap cells={card.cells} />
</div>
