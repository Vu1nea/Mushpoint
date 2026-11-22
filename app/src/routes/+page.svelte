<script lang="ts">
	import Stat from 'mushpoint-design/svelte/Stat.svelte';
	import { button } from 'mushpoint-design/utils/ui';
	import { invalidateAll } from '$app/navigation';
	import DashboardGoalsPanel from '$lib/components/dashboard/DashboardGoalsPanel.svelte';
	import DashboardQuickAdd from '$lib/components/dashboard/DashboardQuickAdd.svelte';
	import DashboardStreaks from '$lib/components/dashboard/DashboardStreaks.svelte';
	import DashboardTasksToday from '$lib/components/dashboard/DashboardTasksToday.svelte';
	import DashboardUpcoming from '$lib/components/dashboard/DashboardUpcoming.svelte';
	import DashboardVisionPreview from '$lib/components/dashboard/DashboardVisionPreview.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import { dashboardStats } from '$lib/dashboard';

	let { data } = $props();

	let actionError = $state<unknown>(null);

	const onError = (error: unknown) => {
		actionError = error;
	};

	const stats = $derived(dashboardStats(data.goals, data.tasks, data.streaks));

	const subtitle = $derived(
		[
			new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
			stats.dueToday > 0 ? `${stats.dueToday} due today` : ''
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<svelte:head><title>Dashboard · Mushpoint</title></svelte:head>

<PageHeader title="Dashboard" {subtitle}>
	{#snippet actions()}
		<DashboardQuickAdd onAdded={invalidateAll} {onError} class="max-md:hidden" />
		<a href="/goals" class={button.primary}>New goal</a>
	{/snippet}
</PageHeader>

{#if data.error}
	<div class="px-4 pb-4 md:px-8"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="px-4 pb-4 md:px-8">
		<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
	</div>
{/if}

<div
	class="mp-enter grid grid-cols-3 gap-4 border-b border-subtle px-4 pb-4 md:flex md:gap-12 md:px-8"
	role="group"
	aria-label="Summary"
>
	<Stat label="Active goals" value={stats.activeGoals} />
	<Stat label="Due today" value={stats.dueToday} />
	<Stat label="Best streak (days)" value={stats.bestStreak} />
</div>

<DashboardTasksToday
	tasks={data.tasks}
	goals={data.goals}
	onMutated={invalidateAll}
	{onError}
	class="mp-enter border-b border-subtle pb-2"
/>

<div class="mp-enter grid border-b border-subtle md:grid-cols-2 md:divide-x md:divide-subtle">
	<DashboardStreaks streaks={data.streaks} class="max-md:border-b max-md:border-subtle" />
	<DashboardVisionPreview items={data.visionItems} />
</div>

<DashboardGoalsPanel
	goals={data.goals}
	categories={data.categories}
	class="mp-enter border-b border-subtle pb-2"
/>

<DashboardUpcoming
	goals={data.goals}
	subgoals={data.subgoals}
	tasks={data.tasks}
	class="mp-enter pb-2"
/>
