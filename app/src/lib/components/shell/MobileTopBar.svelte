<script lang="ts">
	import mushIcon from '$lib/assets/mush-icon.webp';
	import Avatar from '../account/Avatar.svelte';

	interface Props {
		/** Name the avatar's initial comes from (username, else email). */
		name: string;
		avatarUrl: string | null;
		menuOpen: boolean;
		onMenu: () => void;
		/** The menu button, so the shell can hand focus back when the sheet closes. */
		menuButton?: HTMLButtonElement;
	}

	let { name, avatarUrl, menuOpen, onMenu, menuButton = $bindable() }: Props = $props();
</script>

<!-- Phones only: the sidebar's stand-in at the top of the screen. -->
<header
	class="flex shrink-0 items-center gap-2.5 border-b border-subtle bg-surface pt-[env(safe-area-inset-top)] pr-[max(0.375rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:hidden"
>
	<img
		src={mushIcon}
		alt=""
		width="28"
		height="28"
		class="size-7 shrink-0 rounded-full object-cover"
		aria-hidden="true"
	/>
	<button
		bind:this={menuButton}
		type="button"
		class="mp-hit ml-auto flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
		aria-label="Account menu"
		aria-haspopup="dialog"
		aria-expanded={menuOpen}
		aria-controls="mobile-menu"
		onclick={onMenu}
	>
		<Avatar {name} url={avatarUrl} />
	</button>
</header>
