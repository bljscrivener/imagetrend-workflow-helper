# ImageTrend Workflow Helper

Routine A15 **v0.2.3** provides a tabbed, reviewed workflow for ImageTrend Elite.

[Install the A15 userscript](https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/a15-mvp/src/imagetrend-a15-helper.user.js) in Tampermonkey, then refresh ImageTrend. Install the full script so its warning artwork resource is included.

See [v0.2.0 usage and limitations](docs/a15-v0.2.0.md) for the current workflow, timestamp rules, delay rules, and testing controls. [Earlier MVP notes](docs/a15-mvp.md) are retained as history.

## Current workflow

- Section-following tabs and local or chart-wide review before applying selected changes.
- Four-procedure bundle with timeline-based timestamps and Paramedic role.
- Vitals metadata review from the list, ECG Not Applicable, hospital activation No, and timeline-based delays.
- Clear helper-added values with two confirmations; separate clear-log and reset-test controls.

Unknown fields, ambiguous controls, and changed values stop the relevant action. Measured vital numbers are not written. Chart Save/submit is never clicked; native procedure/vital entry buttons accept individual entries. Review any partial run before retrying.

## Validation

Synthetic browser regression checks pass. Live ImageTrend validation is pending; navigation and grid handlers fail closed when unsupported. See the release notes for specific limits.

With Node.js and Microsoft Edge installed, run `npm install`, `npm test`, and `npm run check`.

## Updates

v0.2.1 adds explicit update and download URLs pointing at a15-mvp. Install this version once if your existing installation has a missing or stale update address. Future Tampermonkey update checks use that branch. After updating, refresh ImageTrend to load the new version. Chart behavior is unchanged from v0.2.0.

## v0.2.2

Large Review whole chart and Go, baby, go controls, with a scrolling review list and Recon under Log & testing. Dropdowns wait for late options and support the selected-item opener. Missing options receive one retry after other approved fields; ambiguous or changed values stay for attention. Section navigation rechecks for a child after expanding a header. Delay targets now match the supplied menu choices exactly. Full dispatch-baseline reset remains deferred; current Clear behavior is unchanged. Live verification is still required.

## v0.2.3 attention review

Failures and conflicts appear in a chart-scoped Needs attention log with links to the section and a temporary field highlight. Links never apply values. Independent changes continue; an open partial entry pauses remaining work and labels unattempted actions. Clear log also clears this issue history. Missing or ambiguous navigation is reported without guessing another target.
