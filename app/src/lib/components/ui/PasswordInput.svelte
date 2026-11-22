<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import { field } from './';

	interface Props extends Omit<HTMLInputAttributes, 'type' | 'value'> {
		value: string;
	}

	let { value = $bindable(''), class: className = '', ...rest }: Props = $props();
	let visible = $state(false);
</script>

<!-- The input comes first, so a wrapping <label> still labels it rather than the toggle. -->
<div class="relative">
	<input
		{...rest}
		class="{field.input} pr-10 {className}"
		type={visible ? 'text' : 'password'}
		bind:value
	/>
	<button
		type="button"
		class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-content"
		aria-label={visible ? 'Hide password' : 'Show password'}
		aria-pressed={visible}
		onclick={() => (visible = !visible)}
	>
		<Icon name={visible ? 'eye-off' : 'eye'} size={18} />
	</button>
</div>
