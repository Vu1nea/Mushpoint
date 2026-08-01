<script lang="ts">
	import {
		createTask,
		RECURRENCE_LABELS,
		RECURRENCES,
		updateTask,
		type GoalSummary,
		type Recurrence,
		type Subgoal,
		type Task
	} from '$lib/api';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import Select from './Select.svelte';
	import { weeklyAnchorLabel } from '$lib/format';
	import { field } from './ui';

	interface Props {
		open: boolean;
		goals: GoalSummary[];
		subgoals: Subgoal[];
		/** Null creates a task; a task edits it in place. */
		task?: Task | null;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	let { open, goals, subgoals, task = null, onClose, onSaved }: Props = $props();

	let submitting = $state(false);
	let error = $state<unknown>(null);
	let titleMissing = $state(false);
	let shake = $state(false);

	/**
	 * One control covers both parent kinds: a task can hang off a goal directly or
	 * off one of its subgoals, so the value carries which table it points at.
	 */
	function parentKey(source: Task | null): string {
		if (source?.subgoalId) return `subgoal:${source.subgoalId}`;
		if (source?.goalId) return `goal:${source.goalId}`;
		return '';
	}

	let form = $state({ title: '', parent: '', dueDate: '', recurrence: '' });

	$effect(() => {
		if (!open) return;
		error = null;
		titleMissing = false;
		form = {
			title: task?.title ?? '',
			parent: parentKey(task),
			dueDate: task?.dueDate ?? '',
			recurrence: task?.recurrence ?? ''
		};
	});

	const subgoalsByGoal = $derived.by(() => {
		const grouped = new Map<number, Subgoal[]>();
		for (const subgoal of subgoals) {
			grouped.set(subgoal.goalId, [...(grouped.get(subgoal.goalId) ?? []), subgoal]);
		}
		return grouped;
	});

	/**
	 * A weekly habit is expected on the weekday it was created, so an existing task
	 * can say which day that is. A new one has no creation date to read yet.
	 */
	const anchorNote = $derived.by(() => {
		if (form.recurrence !== 'weekly') return null;
		if (!task) return 'Weekly habits repeat on the day you create them.';

		const weekday = weeklyAnchorLabel(task.createdAt);
		return weekday ? `Repeats weekly · ${weekday}` : null;
	});

	async function submit() {
		if (!form.title.trim()) {
			titleMissing = true;
			shake = true;
			return;
		}

		const [kind, id] = form.parent.split(':');
		const parentId = id ? Number(id) : null;

		submitting = true;
		error = null;
		const input = {
			title: form.title.trim(),
			dueDate: form.dueDate || null,
			goalId: kind === 'goal' ? parentId : null,
			subgoalId: kind === 'subgoal' ? parentId : null,
			recurrence: (form.recurrence || null) as Recurrence | null
		};

		try {
			// A subgoal task inherits that subgoal's goal in the backend, so only one
			// of the two ids is ever sent.
			await (task ? updateTask(task.id, { ...input, status: task.status }) : createTask(input));
			await onSaved();
			onClose();
		} catch (failure) {
			error = failure;
		} finally {
			submitting = false;
		}
	}
</script>

<Drawer
	{open}
	title={task ? 'Edit Task' : 'New Task'}
	submitLabel={task ? 'Save' : 'Create'}
	{submitting}
	{error}
	{onClose}
	onSubmit={submit}
>
	<div>
		<label class={field.label} for="task-title">Title</label>
		<input
			id="task-title"
			class="{field.input} {titleMissing ? 'border-warn' : ''} {shake ? 'mp-shake' : ''}"
			bind:value={form.title}
			oninput={() => (titleMissing = false)}
			onanimationend={() => (shake = false)}
			placeholder="Give it a name…"
			aria-invalid={titleMissing}
		/>
		{#if titleMissing}
			<p class="mt-1.5 flex items-center gap-1.5 text-xs text-warn">
				<Icon name="warning" size={13} weight={2} /> Title is required
			</p>
		{/if}
	</div>

	<div>
		<label class={field.label} for="task-parent">Parent goal or subgoal (optional)</label>
		<Select id="task-parent" bind:value={form.parent}>
			<option value="">Standalone</option>
			{#each goals as goal (goal.id)}
				<optgroup label={goal.title}>
					<option value="goal:{goal.id}">{goal.title} (whole goal)</option>
					{#each subgoalsByGoal.get(goal.id) ?? [] as subgoal (subgoal.id)}
						<option value="subgoal:{subgoal.id}">↳ {subgoal.title}</option>
					{/each}
				</optgroup>
			{/each}
		</Select>
	</div>

	<div>
		<label class={field.label} for="task-due">Due date (optional)</label>
		<input id="task-due" type="date" class={field.input} bind:value={form.dueDate} />
	</div>

	<div>
		<label class={field.label} for="task-recurrence">Repeats</label>
		<Select id="task-recurrence" bind:value={form.recurrence}>
			<option value="">Doesn't repeat</option>
			{#each RECURRENCES as recurrence (recurrence)}
				<option value={recurrence}>{RECURRENCE_LABELS[recurrence]}</option>
			{/each}
		</Select>
		{#if anchorNote}
			<p class="mt-1.5 text-xs text-muted">{anchorNote}</p>
		{/if}
	</div>
</Drawer>
