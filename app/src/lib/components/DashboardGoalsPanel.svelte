<script lang="ts">
	import type { Category, GoalSummary } from '$lib/api';
	import { percent } from '$lib/format';
	import { stagger } from '$lib/motion';
	import { categoryColor } from '$lib/theme/category';
	import Icon from './Icon.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import { sectionHeading } from './ui';

	interface Props {
		goals: GoalSummary[];
		categories: Category[];
		class?: string;
	}

	let { goals, categories, class: className = '' }: Props = $props();

	const grouped = $derived.by(() => {
		const byId = new Map(categories.map((category) => [category.id, category]));
		const groups = new Map<string, { color: string; goals: GoalSummary[] }>();

		for (const goal of goals) {
			const category = goal.categoryId ? byId.get(goal.categoryId) : undefined;
			const name = category?.name ?? 'Uncategorized';
			const group = groups.get(name) ?? { color: categoryColor(category?.colorToken), goals: [] };
			groups.set(name, { ...group, goals: [...group.goals, goal] });
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<section class="flex min-h-0 flex-col overflow-y-auto rounded-card border border-subtle bg-surface p-3.5 {className}">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class={sectionHeading}>Active goals</h2>
		<a href="/goals" class="text-xs font-semibold text-muted transition-colors hover:text-content">
			View all
		</a>
	</div>

	{#if goals.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">No active goals yet.</p>
	{:else}
		{#each grouped as [categoryName, group] (categoryName)}
			<div class="mb-3 last:mb-0">
				<div class="mb-1.5 flex items-center gap-2">
					<span class="size-2 rounded-full" style="background:{group.color}" aria-hidden="true"></span>
					<p class="text-xs font-semibold text-muted">{categoryName}</p>
				</div>
				<ul class="flex flex-col gap-1.5">
					{#each group.goals as goal, index (goal.id)}
						<li class="mp-enter" style="--mp-delay:{stagger(index)}">
							<a
								href="/goals/{goal.id}"
								class="flex flex-col gap-1 rounded-control px-1 py-1 transition-transform duration-150 hover:-translate-y-px"
							>
								<span class="flex items-center justify-between gap-2">
									<span class="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold">
										{#if goal.fromIdea}
											<Icon name="idea" size={12} label="Promoted from an idea" />
										{/if}
										<span class="truncate">{goal.title}</span>
									</span>
									<span class="shrink-0 text-xs text-muted tabular-nums">{percent(goal.progress)}</span>
								</span>
								<ProgressBar
									value={goal.progress}
									height={5}
									color={group.color}
									showValue={false}
									delay={stagger(index)}
								/>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}
</section>
