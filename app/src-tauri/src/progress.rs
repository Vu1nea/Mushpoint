//! The progress rule from the project plan, kept as pure functions so it can be
//! unit tested without a database.
//!
//! A goal's (or project's) progress is the average completion of its *direct*
//! children — subgoals and directly-linked tasks weigh the same. A subgoal's own
//! completion is the average of its tasks, so a half-done subgoal contributes
//! 0.5 rather than 0 or 1, which keeps progress bars moving smoothly.

/// Mean of the given completions, or 0.0 when there are no children at all.
pub fn average(completions: &[f64]) -> f64 {
    if completions.is_empty() {
        return 0.0;
    }
    completions.iter().sum::<f64>() / completions.len() as f64
}

/// A subgoal with tasks is driven by its tasks; a subgoal with none falls back
/// to its own manual checkbox.
pub fn subgoal_progress(is_complete: bool, task_completions: &[f64]) -> f64 {
    if task_completions.is_empty() {
        return if is_complete { 1.0 } else { 0.0 };
    }
    average(task_completions)
}

/// Subgoals and directly-linked tasks are equal-weight units of the parent.
pub fn goal_progress(subgoal_progresses: &[f64], direct_task_completions: &[f64]) -> f64 {
    let children: Vec<f64> = subgoal_progresses
        .iter()
        .chain(direct_task_completions.iter())
        .copied()
        .collect();
    average(&children)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-9,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn average_of_nothing_is_zero() {
        assert_close(average(&[]), 0.0);
    }

    #[test]
    fn average_of_values() {
        assert_close(average(&[0.0, 1.0]), 0.5);
        assert_close(average(&[1.0, 1.0, 1.0]), 1.0);
    }

    #[test]
    fn subgoal_without_tasks_uses_its_own_flag() {
        assert_close(subgoal_progress(false, &[]), 0.0);
        assert_close(subgoal_progress(true, &[]), 1.0);
    }

    #[test]
    fn subgoal_with_tasks_ignores_its_own_flag() {
        assert_close(subgoal_progress(true, &[0.0, 0.0]), 0.0);
        assert_close(subgoal_progress(false, &[1.0, 1.0]), 1.0);
    }

    #[test]
    fn half_done_subgoal_contributes_a_half() {
        // One subgoal at 50%, one directly-linked task that is done: (0.5 + 1) / 2.
        let half = subgoal_progress(false, &[1.0, 0.0]);
        assert_close(half, 0.5);
        assert_close(goal_progress(&[half], &[1.0]), 0.75);
    }

    #[test]
    fn goal_without_children_is_zero() {
        assert_close(goal_progress(&[], &[]), 0.0);
    }

    #[test]
    fn subgoals_and_direct_tasks_weigh_the_same() {
        // Three children, one complete.
        assert_close(goal_progress(&[1.0, 0.0], &[0.0]), 1.0 / 3.0);
    }

    #[test]
    fn progress_can_regress_after_reaching_full() {
        let full = goal_progress(&[1.0], &[1.0]);
        assert_close(full, 1.0);
        // A task gets reopened — progress is a metric, not a lifecycle state.
        assert_close(goal_progress(&[1.0], &[0.0]), 0.5);
    }
}
