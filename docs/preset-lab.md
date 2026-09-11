# Preset Lab 0.2.2 (experimental)

Separate from stable A15. Install src/imagetrend-preset-lab.user.js over the existing Preset Lab script and keep A15 disabled during testing.

From any chart section: open Preset Lab, leave Both selected, Preview selected values, acknowledge the TEST-chart review, then Apply selected values. This targets First EMS Unit on Scene = Yes and Additional Response Mode Descriptors = No Lights or Sirens. Only use these when appropriate for the test scenario. Individual selection remains available.

The lab finds a unique incident root through the current form's Knockout contexts; target controls need not be mounted. It uses exact loaded agency definitions and reporting standard, previews both fields, preserves nonblank answers, checks snapshots and root identity before writes, and verifies native read-back. It never navigates. Afterward visit both fields to confirm their visible values. Existing correct values are skipped; populated multiselects are preserved.

Uses undocumented native field-level methods. No explicit preset audit or chart Save is called; model subscriptions/change notifications may persist edits. Batch writes are not atomic: a failure can leave earlier verified writes in place. No rollback, chart clearing, or new agency preset is provided.

Synthetic test passed for both fields absent from the current page, no navigation, preview without writes, repeat prevention, and stale review rejection. Live off-page behavior remains unverified. The earlier 0.1.0 live single-field and multiselect tests succeeded with their fields visible.

0.2.1 fixes the overly broad read-only check: unrelated template/control contexts no longer block the experiment. It requires a known unlocked currentIncidentReadOnlyStatus and checks any mounted target context separately. Unknown or locked incident state blocks writes. Synthetic regression tests cover unrelated read-only contexts, locked charts, and missing lock status. Live confirmation is pending.

0.2.2 snapshots only the target answer, NotValue, PertinentNegative and PlusOneCode (per entry for multiselects). Circular validation/parent links are excluded. Raw populated special values are preserved even if display translation is empty. Regression tests include circular objects in both field types and special-value changes after preview. Live confirmation pending.
