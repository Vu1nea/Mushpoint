<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { invalidateAll } from '$app/navigation';
	import DashboardOnTime from '$lib/components/dashboard/DashboardOnTime.svelte';
	import DashboardCalendar from '$lib/components/dashboard/DashboardCalendar.svelte';
	import DashboardGoalsPanel from '$lib/components/dashboard/DashboardGoalsPanel.svelte';
	import DashboardOverdue from '$lib/components/dashboard/DashboardOverdue.svelte';
	import DashboardQuickAdd from '$lib/components/dashboard/DashboardQuickAdd.svelte';
	import DashboardStats from '$lib/components/dashboard/DashboardStats.svelte';
	import DashboardStreaks from '$lib/components/dashboard/DashboardStreaks.svelte';
	import DashboardTasksToday from '$lib/components/dashboard/DashboardTasksToday.svelte';
	import DashboardVisionPreview from '$lib/components/dashboard/DashboardVisionPreview.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import { buildUpcomingFeed, dashboardStats } from '$lib/dashboard';

	let { data } = $props();

	let actionError = $state<unknown>(null);

	const onError = (error: unknown) => {
		actionError = error;
	};

	const stats = $derived(dashboardStats(data.goals, data.tasks, data.streaks));

	// The calendar shows subgoals and tasks, told apart by color. Goals have their own page.
	const dated = $derived(buildUpcomingFeed(data.goals, data.subgoals, data.tasks));
	const otherDates = $derived(dated.filter((item) => item.kind !== 'goal'));

	const today = $derived(
		new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
	);

	function focusQuickAdd() {
		const input = document.querySelector<HTMLInputElement>('[aria-label="Quick-add title"]');
		input?.scrollIntoView({ block: 'center' });
		input?.focus();
	}
</script>

<svelte:head><title>Dashboard · Mushpoint</title></svelte:head>

<PageHeader title="Dashboard" subtitle={today}>
	{#snippet actions()}
		<button
			type="button"
			class="flex w-64 items-center gap-2 rounded-control border border-subtle bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:hidden"
			aria-keyshortcuts="Control+K Meta+K"
			aria-haspopup="dialog"
			onclick={() => window.dispatchEvent(new Event('mushpoint:open-palette'))}
		>
			<Icon name="search" size={15} />
			<span class="flex-1 text-left">Search</span>
			<kbd aria-hidden="true" class="rounded-sm border border-subtle px-1.5 text-2xs text-muted"
				>Ctrl K</kbd
			>
		</button>
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

<!-- One lead, then support, each in its own card. Stats sit on top, tasks lead the main
     column with goals under them, and the rail (upcoming, streaks, vision) sits beside them
     from lg up and stacks after them below that. -->
<div class="page-gutter pb-6">
	<!-- Capture is its own row under the title, not part of any card. -->
	<DashboardQuickAdd onAdded={invalidateAll} {onError} class="mb-4 w-full max-md:hidden" />
	<DashboardStats {stats} class="mb-4" />

	<div
		class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_26rem]"
	>
		<div class="flex min-w-0 flex-col gap-4">
			<div class="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] items-start gap-4">
				<DashboardTasksToday
					tasks={data.tasks}
					goals={data.goals}
					onMutated={invalidateAll}
					{onError}
					class="mp-enter"
				/>
				<DashboardOverdue tasks={data.tasks} onMutated={invalidateAll} {onError} class="mp-enter" />
				<DashboardGoalsPanel goals={data.goals} categories={data.categories} class="mp-enter" />
			</div>

			<div class="grid items-start gap-4 md:grid-cols-2">
				<DashboardOnTime tasks={data.tasks} class="mp-enter" />
				<DashboardCalendar
					title="Upcoming"
					items={otherDates}
					kinds={['subgoal', 'task']}
					empty="Nothing due this month."
					class="mp-enter"
				/>
			</div>
		</div>

		<div class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
			<DashboardStreaks streaks={data.streaks} class="mp-enter" />
			<DashboardVisionPreview items={data.visionItems} class="mp-enter" />
		</div>
	</div>
</div>
