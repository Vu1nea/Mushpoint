<script lang="ts">
	import mushIcon from '$lib/assets/mush-icon.png';

	interface Props {
		/** The current screen's name, shown in the middle of the bar. */
		title: string;
		/** Name the avatar's initial comes from (username, else email). */
		name: string;
		menuOpen: boolean;
		onMenu: () => void;
		/** The menu button, so the shell can hand focus back when the sheet closes. */
		menuButton?: HTMLButtonElement;
	}

	let { title, name, menuOpen, onMenu, menuButton = $bindable() }: Props = $props();

	const initial = $derived(name.trim().charAt(0) || '?');
</script>

<!-- Phones only: the sidebar's stand-in at the top of the screen. -->
<header
	class="flex shrink-0 items-center gap-2.5 border-b border-subtle bg-surface pt-[env(safe-area-inset-top)] pr-[max(0.375rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:hidden"
>
	<img src={mushIcon} alt="" class="size-7 shrink-0 rounded-full object-cover" aria-hidden="true" />
	<span class="min-w-0 flex-1 truncate font-display text-base font-bold tracking-[0.2px]">
		{title}
	</span>
	<button
		bind:this={menuButton}
		type="button"
		class="mp-hit flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
		aria-label="Account menu"
		aria-haspopup="dialog"
		aria-expanded={menuOpen}
		aria-controls="mobile-menu"
		onclick={onMenu}
	>
		<span
			class="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-contrast uppercase"
			aria-hidden="true"
		>
			{initial}
		</span>
	</button>
</header>
