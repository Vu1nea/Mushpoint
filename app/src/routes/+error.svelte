<script lang="ts">
	import { page } from '$app/state';
	import Sheet from 'mushpoint-design/svelte/Sheet.svelte';
	import mushIcon from '$lib/assets/mush-icon.webp';
	import { button } from '$lib/components/ui';

	const notFound = $derived(page.status === 404);
	const title = $derived(notFound ? 'This page wandered off' : 'Something went wrong');

	function goBack() {
		if (history.length > 1) history.back();
		else location.assign('/');
	}
</script>

<svelte:head><title>{notFound ? 'Not found' : 'Error'} · Mushpoint</title></svelte:head>

<div class="mp-enter flex min-h-[70vh] items-center justify-center">
	<Sheet class="flex w-full max-w-md flex-col items-center p-6 text-center sm:p-8">
		<img
			src={mushIcon}
			alt=""
			width="80"
			height="80"
			aria-hidden="true"
			class="error-mascot mb-4 size-20 rounded-full object-cover"
		/>

		<p class="mb-2 font-display text-sm font-bold text-muted tabular-nums">
			{page.status}
		</p>
		<h1 class="mb-3 font-display text-2xl font-bold text-balance sm:text-3xl">{title}</h1>

		{#if notFound}
			<p class="mb-8 text-md text-pretty text-muted">
				There's nothing at <code
					class="rounded-sm bg-surface-raised px-1.5 py-0.5 text-sm wrap-anywhere text-content"
					>{page.url.pathname}</code
				>. The link may be old, or the page may have moved.
			</p>
		{:else}
			<p class="mb-8 text-md text-pretty wrap-anywhere text-muted">
				{page.error?.message || 'An unexpected error stopped this page from loading.'}
				Try again, or head back to your dashboard.
			</p>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-2.5">
			<a href="/" class={button.primary}>Go to dashboard</a>
			{#if notFound}
				<button type="button" class={button.ghost} onclick={goBack}>Go back</button>
			{:else}
				<button type="button" class={button.ghost} onclick={() => location.reload()}>
					Try again
				</button>
			{/if}
		</div>
	</Sheet>
</div>

<style>
	/* One quiet moment: the mascot sways like it's looking around for the page. */
	.error-mascot {
		transform-origin: 50% 90%;
		animation: mascot-sway 3.2s cubic-bezier(0.22, 1, 0.36, 1) infinite alternate;
	}

	@keyframes mascot-sway {
		from {
			transform: rotate(-6deg);
		}
		to {
			transform: rotate(6deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.error-mascot {
			animation: none;
		}
	}
</style>
