//! The streak rule, kept as pure functions so every case is unit testable without
//! a database or a real clock — `today` is always passed in.
//!
//! A streak counts consecutive *occurrences* the cadence expected, not calendar
//! days: a weekly habit done three weeks running has a streak of 3, not 21.

use std::collections::HashSet;

use chrono::{Datelike, Duration, NaiveDate, Weekday};

use crate::models::{CellState, Recurrence};

pub struct Streak {
    pub current: i64,
    pub longest: i64,
}

/// Every day in `from..=to` that the cadence expects an occurrence on.
/// `anchor` only matters for `Weekly`; the other cadences ignore it.
pub fn expected_days(
    rec: Recurrence,
    anchor: Weekday,
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<NaiveDate> {
    let mut days = Vec::new();
    let mut day = from;

    while day <= to {
        let expected = match rec {
            Recurrence::Daily => true,
            Recurrence::Weekdays => !matches!(day.weekday(), Weekday::Sat | Weekday::Sun),
            Recurrence::Weekly => day.weekday() == anchor,
        };
        if expected {
            days.push(day);
        }
        day += Duration::days(1);
    }

    days
}

/// An occurrence is satisfied by a completion on its own day or up to `grace`
/// days later. Until that window closes it is Pending rather than Missed, so an
/// untouched task today never zeroes yesterday's streak.
pub fn state_of(
    day: NaiveDate,
    done: &HashSet<NaiveDate>,
    grace: i64,
    today: NaiveDate,
) -> CellState {
    let satisfied = (0..=grace).any(|offset| done.contains(&(day + Duration::days(offset))));

    if satisfied {
        CellState::Done
    } else if day + Duration::days(grace) >= today {
        CellState::Pending
    } else {
        CellState::Missed
    }
}

/// `current` walks back from the newest occurrence, skipping ones whose window is
/// still open. `longest` is the best run anywhere in the history.
pub fn summarize(
    expected: &[NaiveDate],
    done: &HashSet<NaiveDate>,
    grace: i64,
    today: NaiveDate,
) -> Streak {
    let states: Vec<CellState> = expected
        .iter()
        .map(|&day| state_of(day, done, grace, today))
        .collect();

    let mut longest = 0;
    let mut run = 0;
    for state in &states {
        match state {
            CellState::Done => {
                run += 1;
                longest = longest.max(run);
            }
            CellState::Missed => run = 0,
            // A still-open window neither extends nor breaks a run.
            _ => {}
        }
    }

    let mut current = 0;
    for state in states.iter().rev() {
        match state {
            CellState::Pending => continue,
            CellState::Done => current += 1,
            _ => break,
        }
    }

    Streak { current, longest }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn date(text: &str) -> NaiveDate {
        NaiveDate::parse_from_str(text, "%Y-%m-%d").unwrap()
    }

    fn done(days: &[&str]) -> HashSet<NaiveDate> {
        days.iter().map(|day| date(day)).collect()
    }

    // 2026-07-27 is a Monday, so this week runs Mon 27th to Sun 2026-08-02.

    #[test]
    fn daily_expects_every_day_in_the_range() {
        let days = expected_days(Recurrence::Daily, Weekday::Mon, date("2026-07-27"), date("2026-07-30"));

        assert_eq!(days.len(), 4);
        assert_eq!(days[0], date("2026-07-27"));
        assert_eq!(days[3], date("2026-07-30"));
    }

    #[test]
    fn weekdays_skips_the_weekend() {
        let days = expected_days(Recurrence::Weekdays, Weekday::Mon, date("2026-07-27"), date("2026-08-02"));

        assert_eq!(days.len(), 5);
        assert_eq!(days.last(), Some(&date("2026-07-31")));
    }

    #[test]
    fn weekly_expects_only_its_anchor_weekday() {
        let days = expected_days(Recurrence::Weekly, Weekday::Tue, date("2026-07-27"), date("2026-08-11"));

        assert_eq!(days, vec![date("2026-07-28"), date("2026-08-04"), date("2026-08-11")]);
    }

    #[test]
    fn an_occurrence_completed_within_grace_still_counts() {
        let log = done(&["2026-07-30"]);
        let today = date("2026-07-31");

        // Grace 2: the 28th's window is [28, 30], so the completion on the 30th covers it.
        assert_eq!(state_of(date("2026-07-28"), &log, 2, today), CellState::Done);
        // Grace 1: the window is [28, 29] and closed before the completion landed.
        assert_eq!(state_of(date("2026-07-28"), &log, 1, today), CellState::Missed);
    }

    #[test]
    fn an_open_window_is_pending_not_missed() {
        let log = HashSet::new();
        let today = date("2026-07-31");

        // Today's own window is always still open.
        assert_eq!(state_of(today, &log, 2, today), CellState::Pending);
        // Grace 2 keeps the 29th open through the 31st...
        assert_eq!(state_of(date("2026-07-29"), &log, 2, today), CellState::Pending);
        // ...but the 28th's window shut yesterday.
        assert_eq!(state_of(date("2026-07-28"), &log, 2, today), CellState::Missed);
    }

    #[test]
    fn grace_zero_demands_the_exact_day() {
        let log = done(&["2026-07-30"]);
        let today = date("2026-07-31");

        assert_eq!(state_of(date("2026-07-30"), &log, 0, today), CellState::Done);
        assert_eq!(state_of(date("2026-07-29"), &log, 0, today), CellState::Missed);
    }

    #[test]
    fn a_pending_day_does_not_end_the_current_streak() {
        let today = date("2026-07-31");
        let expected = expected_days(Recurrence::Daily, Weekday::Mon, date("2026-07-28"), today);
        // Done through the 30th, nothing logged for today yet.
        let log = done(&["2026-07-28", "2026-07-29", "2026-07-30"]);

        let streak = summarize(&expected, &log, 0, today);

        assert_eq!(streak.current, 3, "today is still pending, not a break");
        assert_eq!(streak.longest, 3);
    }

    #[test]
    fn a_closed_miss_resets_current_but_not_longest() {
        let today = date("2026-07-31");
        let expected = expected_days(Recurrence::Daily, Weekday::Mon, date("2026-07-20"), today);
        // A four-day run, a hard gap, then two more days.
        let log = done(&[
            "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23",
            "2026-07-29", "2026-07-30",
        ]);

        let streak = summarize(&expected, &log, 0, today);

        assert_eq!(streak.current, 2);
        assert_eq!(streak.longest, 4);
    }

    #[test]
    fn an_empty_history_has_no_streak() {
        let today = date("2026-07-31");
        let streak = summarize(&[], &HashSet::new(), 2, today);

        assert_eq!((streak.current, streak.longest), (0, 0));
    }

    #[test]
    fn a_weekly_habit_counts_weeks_not_days() {
        let today = date("2026-08-11");
        let expected = expected_days(Recurrence::Weekly, Weekday::Tue, date("2026-07-28"), today);
        let log = done(&["2026-07-28", "2026-08-04"]);

        let streak = summarize(&expected, &log, 2, today);

        assert_eq!(streak.current, 2, "two Tuesdays running");
        assert_eq!(streak.longest, 2);
    }
}
