<script lang="ts">
	import { RECURRENCE_LABELS, type StreakCard } from '$lib/api';
	import Checkbox from 'mushpoint-design/svelte/Checkbox.svelte';
	import Icon from '../ui/Icon.svelte';
	import StreakYear from './StreakYear.svelte';

	interface Props {
		card: StreakCard;
		busy?: boolean;
		/** The habit's colour in the calendar, shown as a key dot beside the title. */
		dot?: string;
		onToggle?: (done: boolean) => void;
	}

	let { card, busy = false, dot, onToggle }: Props = $props();

	const cadence = $derived(
		card.task.recurrence ? RECURRENCE_LABELS[card.task.recurrence] : 'One-off'
	);
</script>

<li
	class="flex w-full items-stretch justify-between gap-5 rounded-control border border-subtle px-4 py-3 text-sm"
>
	<div class="flex min-w-36 flex-col justify-between gap-3">
		<div class="flex flex-col gap-2">
			<span class="min-w-0">
				<span class="flex items-center gap-1.5">
					{#if dot}<span class="size-2 shrink-0 rounded-full {dot}" aria-hidden="true"></span>{/if}
					<span class="truncate">{card.task.title}</span>
				</span>
				<span class="block text-xs text-muted">{cadence}</span>
			</span>
			<div class="flex flex-col gap-0.5">
				<span class="flex items-center gap-1.5">
					<Icon name="flame" size={16} class="shrink-0 text-accent-ink" />
					<b class="text-base tabular-nums" aria-label="Current streak">{card.current}</b>
				</span>
				<span class="flex items-center gap-1.5 text-xs text-muted">
					<Icon
						name="crown"
						size={14}
						class="shrink-0 text-yellow-400 [[data-theme=coquette]_&]:text-yellow-600"
					/>
					<span class="tabular-nums" aria-label="Best streak">{card.longest}</span>
				</span>
			</div>
		</div>
	</div>
	<div class="flex min-w-0 flex-1 flex-col justify-between">
		<StreakYear cells={card.cells} active={card.current > 0} />
		{#if onToggle}
			<span class="flex justify-end pt-3">
				<Checkbox
					checked={card.doneToday}
					disabled={busy}
					label="Done today: {card.task.title}"
					showLabel={false}
					onchange={(done) => onToggle(done)}
				/>
			</span>
		{/if}
	</div>
</li>
