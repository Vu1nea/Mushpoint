<script lang="ts">
	import { RECURRENCE_LABELS, type StreakCard } from '$lib/api';
	import Checkbox from '../ui/Checkbox.svelte';
	import Icon from '../ui/Icon.svelte';
	import StreakHeatmap from './StreakHeatmap.svelte';

	interface Props {
		card: StreakCard;
		busy?: boolean;
		onToggle?: (done: boolean) => void;
	}

	let { card, busy = false, onToggle }: Props = $props();

	const cadence = $derived(
		card.task.recurrence ? RECURRENCE_LABELS[card.task.recurrence] : 'One-off'
	);
</script>

<li class="flex flex-col gap-2 px-4 py-2.5 text-sm md:px-8">
	<div class="flex items-center gap-3">
		<Icon name="flame" size={14} class="shrink-0 text-accent-ink" />
		<span class="min-w-0 flex-1">
			<span class="block truncate">{card.task.title}</span>
			<span class="block text-xs text-muted">{cadence}</span>
		</span>
		<b class="tabular-nums">{card.current}</b>
		<span class="text-xs text-muted">best {card.longest}</span>
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
</li>
