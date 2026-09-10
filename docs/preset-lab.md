# Preset Lab 0.1.0 (experimental)

Separate script: src/imagetrend-preset-lab.user.js. Stable A15 is unchanged. Disable the A15 helper while testing to avoid overlapping automation, then install Preset Lab as a new script. Use only the TEST chart.

Open Dispatch > Other Agencies On Scene. In Preset Lab choose First EMS Unit on Scene, Preview, review Yes, acknowledge, then Apply this one field. Verify the visible field. The other experiment is Additional Response Mode Descriptors on CAD/Dispatch/Response Info. Only use No Lights or Sirens when appropriate for that test scenario.

The lab requires a matching loaded agency definition, reporting standard, unique visible field, and uniquely resolved incident context. It reads the original branch before applying, rejects changed/nonblank fields and populated multiselect collections, and verifies native read-back. Duplicate matching preset definitions are not applied repeatedly. It does not register or modify agency presets.

This calls the undocumented field-level PresetValueViewModel method. It does not call the outer preset audit/triggerSave method; internal handleValueChanged notifications and model subscriptions may nevertheless persist edits immediately. No rollback or full-chart clearing is provided. A verification failure after invocation may leave a changed field; inspect before retrying.

Syntax and synthetic single-field tests passed (preview, write/read-back, conflict preservation, stale review rejection). Live integration and the multiselect path remain unverified. Run node tests/preset-lab.cjs with Playwright and Microsoft Edge installed. Disable the lab after the experiment.
