<script lang="ts">
	import { AppError } from '$lib/api';
	import Icon from './Icon.svelte';

	interface Props {
		error: unknown;
		onDismiss?: () => void;
	}

	let { error, onDismiss }: Props = $props();

	const normalized = $derived(AppError.from(error));
	const heading = $derived(
		normalized.kind === 'unavailable' ? 'Backend not running' : 'Something went wrong'
	);
</script>

<div
	class="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-content"
	role="alert"
>
	<Icon name="close" size={18} class="mt-0.5 shrink-0 text-danger" />
	<div class="flex-1">
		<p class="font-medium text-danger">{heading}</p>
		<p class="mt-0.5 text-muted">{normalized.message}</p>
	</div>
	{#if onDismiss}
		<button type="button" class="text-muted hover:text-content" onclick={onDismiss}>
			<Icon name="close" size={16} label="Dismiss" />
		</button>
	{/if}
</div>
