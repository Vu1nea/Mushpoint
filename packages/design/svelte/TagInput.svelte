<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		tags: string[];
		id?: string;
		placeholder?: string;
		ariaLabel?: string;
	}

	let { tags = $bindable(), id, placeholder = 'Add a tag…', ariaLabel }: Props = $props();

	let draft = $state('');

	/** Commits whatever's typed so far as a tag — used on comma, Enter, and
	 * blur, so a stray unfinished tag is never silently dropped. */
	function commit() {
		const name = draft.trim();
		draft = '';
		if (name && !tags.some((tag) => tag.toLowerCase() === name.toLowerCase())) {
			tags = [...tags, name];
		}
	}

	function remove(name: string) {
		tags = tags.filter((tag) => tag !== name);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === ',' || event.key === 'Enter') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
			tags = tags.slice(0, -1);
		}
	}
</script>

<div
	class="flex flex-wrap items-center gap-1.5 rounded-control border border-subtle bg-track px-2.5 py-2"
>
	{#each tags as tag (tag)}
		<span
			class="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent"
		>
			{tag}
			<button
				type="button"
				class="text-accent/70 transition-colors hover:text-accent"
				onclick={() => remove(tag)}
			>
				<Icon name="close" size={10} weight={2.4} label="Remove tag {tag}" />
			</button>
		</span>
	{/each}
	<input
		{id}
		type="text"
		class="min-w-24 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-muted/60"
		bind:value={draft}
		{placeholder}
		aria-label={ariaLabel}
		{onkeydown}
		onblur={commit}
	/>
</div>
