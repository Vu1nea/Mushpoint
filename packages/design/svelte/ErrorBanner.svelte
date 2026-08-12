<script lang="ts">
	import { normalizeError } from '../utils/errors';
	import Icon from './Icon.svelte';
	import { button } from '../utils/ui';

	interface Props {
		error: unknown;
		onDismiss?: () => void;
	}

	let { error, onDismiss }: Props = $props();

	const normalized = $derived(normalizeError(error));
	const heading = $derived(
		normalized.kind === 'unavailable' ? 'Backend not running' : 'Something went wrong'
	);
</script>

<div
	class="mp-enter flex items-start gap-2.5 rounded-[10px] border border-warn/35 bg-warn/10 px-3.5 py-3"
	role="alert"
>
	<Icon name="warning" size={16} weight={2} class="mt-px text-warn" />
	<div class="flex-1">
		<p class="text-sm font-semibold text-warn">{heading}</p>
		<p class="text-xs text-muted">{normalized.message}</p>
	</div>
	{#if onDismiss}
		<button type="button" class={button.bare} onclick={onDismiss}>
			<Icon name="close" size={15} weight={2} label="Dismiss" />
		</button>
	{/if}
</div>
