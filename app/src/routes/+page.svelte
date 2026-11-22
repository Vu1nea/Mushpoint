<script lang="ts">
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
		<a href="/goals" class={button.primary}>New goal</a>
	{/snippet}
</PageHeader>

{#if data.error}
	<div class="page-gutter pb-4"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="page-gutter pb-4">
		<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
	</div>
{/if}

<!-- One lead, then support. Tasks today is the answer to "what do I do now"; goals sit under
     it. Upcoming, streaks and the vision preview are the quiet rail: beside the lead on wide
     screens, stacked after it on narrow ones. -->
<div class="xl:grid xl:grid-cols-[minmax(0,1fr)_22rem]">
	<div class="min-w-0 xl:border-r xl:border-subtle">
		<!-- Capture is a quiet row of its own under the title, not another header button. -->
		<div class="page-gutter pb-5 max-md:hidden">
			<DashboardQuickAdd onAdded={invalidateAll} {onError} class="w-full" />
		</div>
		<DashboardTasksToday
			tasks={data.tasks}
			goals={data.goals}
			onMutated={invalidateAll}
			{onError}
			class="mp-enter border-b border-subtle pb-3"
		/>
		<DashboardGoalsPanel
			goals={data.goals}
			categories={data.categories}
			class="mp-enter border-b border-subtle pb-2 xl:border-b-0"
		/>
	</div>

	<div class="compact-gutter min-w-0">
		<DashboardUpcoming
			goals={data.goals}
			subgoals={data.subgoals}
			tasks={data.tasks}
			class="mp-enter border-b border-subtle pb-2"
		/>
		<DashboardStreaks streaks={data.streaks} class="mp-enter border-b border-subtle" />
		<DashboardVisionPreview items={data.visionItems} class="mp-enter" />
	</div>
</div>
