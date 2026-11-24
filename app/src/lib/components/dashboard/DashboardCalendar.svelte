<script lang="ts">
	import {
		dayKey,
		itemsByDueDay,
		monthCells,
		type UpcomingItem,
		type UpcomingKind
	} from '$lib/dashboard';
	import Icon from '../ui/Icon.svelte';
	import { KINDS } from './calendarKinds';
	import DashboardSectionTitle from './DashboardSectionTitle.svelte';

	interface Props {
		title: string;
		items: UpcomingItem[];
		/** The kinds this card shows, in legend order. One kind needs no legend. */
		kinds: UpcomingKind[];
		empty: string;
		class?: string;
	}

	let { title, items, kinds, empty, class: className = '' }: Props = $props();

	const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

	const now = new Date();
	const todayKey = dayKey(now);
	let offset = $state(0);

	const shown = $derived(new Date(now.getFullYear(), now.getMonth() + offset, 1));
	const cells = $derived(monthCells(shown.getFullYear(), shown.getMonth()));
	const byDay = $derived(itemsByDueDay(items));
	const monthLabel = $derived(
		shown.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
	);

	/** What is due in the month on show, in date order, for readers who skip the grid. */
	const dueThisMonth = $derived(
		cells
			.flatMap((cell) =>
				cell ? (byDay.get(dayKey(cell))?.map((item) => ({ item, cell })) ?? []) : []
			)
			.slice(0, 4)
	);

	const kindsOn = (day: UpcomingItem[]) =>
		kinds.filter((kind) => day.some((it) => it.kind === kind));

	const nav =
		'grid size-7 place-items-center rounded-control text-muted hover:bg-surface-raised hover:text-content focus-visible:outline-2 focus-visible:outline-accent';
</script>

<section class="dash-card {className}">
	<DashboardSectionTitle {title}>
		{#snippet actions()}
			<button type="button" class={nav} aria-label="Previous month" onclick={() => offset--}>
				<Icon name="chevron-left" size={14} />
			</button>
			<button type="button" class={nav} aria-label="Next month" onclick={() => offset++}>
				<Icon name="chevron-right" size={14} />
			</button>
		{/snippet}
	</DashboardSectionTitle>

	<div class="dash-pad pb-4">
		<div class="mb-2 flex items-center justify-between gap-3">
			<p class="text-sm font-medium text-content" aria-live="polite">{monthLabel}</p>
			{#if kinds.length > 1}
				<ul class="flex items-center gap-3 text-xs text-muted">
					{#each kinds as kind (kind)}
						<li class="flex items-center gap-1.5">
							<span class="size-2 rounded-full {KINDS[kind].dot}" aria-hidden="true"></span>
							{KINDS[kind].label}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="grid grid-cols-7 text-center text-xs">
			{#each WEEKDAYS as day, index (index)}
				<span class="pb-1 text-faint" aria-hidden="true">{day}</span>
			{/each}
			{#each cells as cell, index (index)}
				{#if cell}
					{@const due = byDay.get(dayKey(cell))}
					<span
						class="flex h-11 flex-col items-center justify-center gap-1.5 tabular-nums {dayKey(
							cell
						) === todayKey
							? 'font-semibold text-content'
							: due
								? 'text-content'
								: 'text-muted'}"
						title={due?.map((it) => it.title).join(', ')}
					>
						<span
							class="grid size-6 place-items-center rounded-full {dayKey(cell) === todayKey
								? 'ring-1 ring-content/40'
								: ''}"
						>
							{cell.getDate()}
						</span>
						<span class="flex h-1.5 items-center gap-0.5" aria-hidden="true">
							{#if due}
								{#each kindsOn(due) as kind (kind)}
									<span class="size-1.5 rounded-full {KINDS[kind].dot}"></span>
								{/each}
							{/if}
						</span>
					</span>
				{:else}
					<span></span>
				{/if}
			{/each}
		</div>

		{#if dueThisMonth.length > 0}
			<ul class="mt-3 flex flex-col gap-1.5 border-t border-subtle pt-3 text-sm">
				{#each dueThisMonth as { item, cell } (`${item.kind}-${item.id}`)}
					<li class="flex items-center gap-2.5">
						<span
							class="size-2 shrink-0 rounded-full {KINDS[item.kind].dot}"
							role="img"
							aria-label={KINDS[item.kind].label}
						></span>
						<span class="w-11 shrink-0 text-xs text-muted tabular-nums">
							{cell.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
						</span>
						{#if item.href}
							<a
								href={item.href}
								class="min-w-0 flex-1 truncate focus-visible:outline-2 focus-visible:outline-accent"
							>
								{item.title}
							</a>
						{:else}
							<span class="min-w-0 flex-1 truncate">{item.title}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-3 text-sm text-muted">{empty}</p>
		{/if}
	</div>
</section>
