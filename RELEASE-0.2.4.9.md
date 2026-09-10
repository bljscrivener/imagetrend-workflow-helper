# Gremlin Logic A15 0.2.4.9

This experimental release adds a compact purple/charcoal panel, a working hide/restore tab, A15 profile selector, direct Go, Stop after current step, and focused-field At Pt / Leaving Scene timestamp shortcuts. Issue links include entry identity checks; mapping and clear tools stay at the bottom.

Auto-healing makes at most three passes. It revisits unresolved mappings/options only after another action makes progress. Ambiguous targets, changed answers, attempted writes and entry creation are not automatically replayed. Independent actions continue after field failures.

Before Go mutates anything, a verified local snapshot is stored under `it-a15-before-run` in sessionStorage. It contains incident data and stays in the current browser tab/session. The latest capture replaces the preceding capture. Storage failure blocks the run. This is not an undo implementation, and snapshots are not sent to GitHub, Drive or Linear.

Transport mappings now include number transported, movement, restraints, position, notification and mode fields. Receiving Hospital Contacted is destination minus five minutes. Delay rules use the captured native paths and exact resource choices. Activation No creates only a missing entry and keeps its date blank.

Timestamps use local chart format without a UTC Z suffix. Existing assessment entries are ordered chronologically; ambiguous chronology is reported. First assessment uses patient contact; an existing second uses destination. No second assessment or clinical findings are automatically created. Procedure recovery checks existing identities before creation and preserves unrelated procedures.

Clearing learns available STAT/Transport/Assessment mappings before presenting its exact inventory. Dispatch and timeline remain protected; unmapped/read-only/ambiguous fields are reported. Both warnings remain. An inline mascot fallback is available if the external artwork cannot load, and partial coverage does not trigger the full-success celebration.

## Validation

Synthetic Edge browser tests cover two vital sets, repeat no-op, local snapshot/capture failure, native transport fields, two-choice destination delay, local and midnight timestamps, focused-field shortcuts, prerequisite healing, non-retry of a failed write, assessment chronology, procedure creation/search/failure/retry, clear cancellation, timeline preservation and partial-clear reporting. Syntax and diff checks also run.

## Limits requiring live testing

- Exact choice resources still must be available; mappings are not invented. Priority-dependent service mapping remains an explicit issue when unavailable.
- Procedure/assessment creation may navigate to their native grids. The native editor must expose recognized controls.
- Clear is limited to the displayed inventory. It is not a universal reset or a substitute for Undo.
- Repeated assessments with missing/equal times need manual identity confirmation.
- No automatic chart Save/submit. ImageTrend's native updates may persist themselves.

Install/update the same userscript, refresh a TEST chart, and verify the header reads 0.2.4.9. Test transport/delays, then two vital sets and procedures, then clear on a disposable TEST chart.
