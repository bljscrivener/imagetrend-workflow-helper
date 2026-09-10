# Gremlin Logic development

Edit `src/native-core.js` for the current ImageTrend adapter and A15 workflow. Edit `src/native-peripherals.js` for UI, settings and diagnostic controls. The packaged userscript is generated; do not edit it directly.

Build: `node scripts/build-native.cjs`

Syntax: `node --check src/imagetrend-a15-native-test.user.js`

Regression checks: `node tests/run-native.cjs` (Playwright and Edge required).

Small changes need a focused regression plus the release suite, not repeated regeneration through historical patch scripts. Keep native clinical mutations out of peripherals. This is an incremental separation, not the completed extension architecture.

0.2.4.12 adds post-navigation procedure scans, deferred clear writers, full timeline discovery when only one timestamp is visible, retained shortcut targets, broader ImageTrend route matching, exact structural mapping fallback, and Workflow/Tools separation. Settings, panel dragging, bounded value-free diagnostics, and opt-in in-tab field-focus observations are peripheral features.

Limits: agency portability still depends on verified native paths/resources; procedure UI controls may differ. Observation records focus order, not inferred clinical habits, and does not learn rules. Diagnostics deliberately omit raw errors, chart values and identifiers. Clear is not undo; unknown fields remain for review. Live chart verification is required after installation. No X299 runtime is used.
