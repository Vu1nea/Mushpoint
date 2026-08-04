<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import DashboardGoalsPanel from '$lib/components/DashboardGoalsPanel.svelte';
	import DashboardQuickAdd from '$lib/components/DashboardQuickAdd.svelte';
	import DashboardStreaks from '$lib/components/DashboardStreaks.svelte';
	import DashboardTasksToday from '$lib/components/DashboardTasksToday.svelte';
	import DashboardUpcoming from '$lib/components/DashboardUpcoming.svelte';
	import DashboardVisionPreview from '$lib/components/DashboardVisionPreview.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';

	let { data } = $props();

	let actionError = $state<unknown>(null);

	const onError = (error: unknown) => {
		actionError = error;
	};
</script>

<svelte:head><title>Dashboard · Mushpoint</title></svelte:head>

<header class="mb-6">
	<h1 class="mb-1 font-display text-3xl font-bold">Dashboard</h1>
	<p class="text-sm text-muted">Where everything stands right now.</p>
</header>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="mb-6"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}

<div class="grid grid-cols-1 gap-4 lg:auto-rows-[minmax(160px,auto)] lg:grid-cols-12">
	<DashboardGoalsPanel
		goals={data.goals}
		categories={data.categories}
		class="mp-enter lg:col-span-7 lg:row-span-2 lg:col-start-1 lg:row-start-1"
	/>
	<DashboardVisionPreview
		items={data.visionItems}
		class="mp-enter lg:col-span-5 lg:col-start-8 lg:row-start-1"
	/>
	<DashboardTasksToday
		tasks={data.tasks}
		onMutated={invalidateAll}
		{onError}
		class="mp-enter lg:col-span-5 lg:col-start-8 lg:row-start-2"
	/>
	<DashboardStreaks
		streaks={data.streaks}
		class="mp-enter lg:col-span-6 lg:col-start-1 lg:row-start-3"
	/>
	<DashboardUpcoming
		goals={data.goals}
		subgoals={data.subgoals}
		tasks={data.tasks}
		class="mp-enter lg:col-span-6 lg:col-start-7 lg:row-start-3"
	/>
	<DashboardQuickAdd onAdded={invalidateAll} {onError} class="mp-enter lg:col-span-12 lg:row-start-4" />
</div>
