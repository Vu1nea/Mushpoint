# Todos

- Plan diff error states, judge overall UX design, and write playwright tests
- Plan api
- Implement and test api
- Make logs (e.g What to do when there's error etc.)
- incorrect streak ui
- url validator for github url

## Fixing the Goal Card

### Replace the three independent buttons with one segmented control:
- Single rounded track with a subtle inset background; the three options are equal-width segments inside it.
- A sliding pill sits behind the selected segment and animates between positions with a spring (Motion layoutId), instead of three separately-filled buttons.
- Press feedback: segment scales down slightly on tap, springs back.
- Label feedback: selected label goes to semibold and full-contrast foreground; unselected labels are muted and lift to full contrast on hover.
- State color travels with the selection — active uses the violet accent, completed a green tone with a check icon that fades and scales in next to the label, archived a muted gray.
- Card-level echo: when archived, the whole card dims slightly and desaturates, so the status is legible without reading the control.
- Save feedback: the change applies optimistically the instant it is clicked, with a small inline "Saved" tick that fades out after ~1.5s; on failure it reverts and shows an error toast.
- Keyboard: arrow keys move between segments, Enter/Space commits — standard radiogroup semantics with role="radiogroup" / role="radio".
- Respects prefers-reduced-motion: the pill snaps instead of sliding, scale/press effects are dropped.

