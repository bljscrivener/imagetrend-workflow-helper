# A15 MVP

## Goal

Reduce routine ALS-transport charting friction without writing measured clinical values or silently overwriting meaningful existing answers.

## MVP interaction model

The userscript scans only the currently open ImageTrend view. It presents recognized A15 fields as:

- READY — blank or explicitly correctable and eligible to apply.
- KEPT — already matches the A15 profile.
- CONFLICT — an existing different value is preserved and requires human review.
- MANUAL/BLOCKED — recognized rule that is intentionally not automated yet.

The user must review the proposed changes and acknowledge them before applying. The helper never clicks Save or submits the chart.

## Implemented A15 rules

### STAT

Routine STAT defaults already demonstrated and vetted: patient contact made, emergency response, single patient, no arrest/stroke/traumatic injury/STEMI/work-related illness, transported by this unit, patient evaluated/care provided, primary-care crew disposition, and this-unit transport disposition.

### Dispatch / history

- Primary Role of Unit: fill blank with `Ground Transport (ALS Equipped)`.
- Barriers to Patient Care: fill blank with `None Noted`.
- Dispatch Priority 1 -> response mode `With Lights and Sirens`; priorities 2-5 -> `Without Lights and Sirens`, only when response mode is blank.
- P3/P4 + blank Incident Location Type -> `Hospital`.
- Unit Call Sign and Unit Number remain CAD-owned and are never touched.

### Transport / destination

Fill blank routine fields only:

- Number transported: `1`
- EMS Transport Method: `Ground-Ambulance`
- Transport Mode from Scene: `Without Lights and Sirens`
- Transport from Scene Type: `No Lights or Sirens`
- Moved to ambulance: `Stretcher`
- Patient Secured By: `Cot- 5 straps, Including Shoulders`
- Position: `Semi-Fowlers`
- Moved from ambulance: `Stretcher`
- Final Patient Acuity: `Lower Acuity (Green)`
- Accepting Hospital Notified: `Yes`
- Facility Notified By: `Phone`
- Destination Team Pre-Arrival Alert or Activation: `No`
- Type of Destination: `Hospital`

Receiving Hospital Contacted Date/Time is derived as Destination Arrival minus five minutes only when the result is not earlier than Unit Left Scene and the contact fields are blank.

Closest-facility logic, distant-facility reason, destination name/address, and other destination details remain untouched.

### ImageTrend multiselect behavior confirmed during transport test

The rendered selected value uses `.koMultiselect-selectedItem-value` with bindings such as `getSelectedItemDisplay($data)`. Dropdown options can expose their exact text through elements bound with `getOptionDisplay($data)`. The A15 helper v0.1.1 now uses those exact leaf nodes so one selected item is not misread as multiple duplicate values.

Confirmed transport selected values include `Stretcher`, `Cot- 5 straps, Including Shoulders`, `Semi-Fowlers`, and `Stretcher` for movement from the ambulance.

### Vitals metadata

The helper never writes measured numeric vital values. Routine A15 fill-blank metadata currently includes:

- AVPU: `Alert`
- GCS Eye: `4- Opens Eyes spontaneously (All Age Groups)`
- GCS Verbal: `5- Oriented (>2 Years); Smiles, oriented to sounds, follows objects, interacts`
- GCS Motor: `6- Obeys commands (>2Years); Appropriate response to stimulation`
- GCS qualifier: legitimate values without intervention/sedation
- BP Method: `Cuff-Automated`
- HR Method: `Electronic Monitor - Pulse Oximeter`
- Respiratory Effort: `Normal`
- Pulse Oximetry Qualifier: `Room Air`
- Pain Scale Type: `Numeric (0-10)`
- Stroke Scale Score: `Negative`
- Stroke Scale Type: `FAST`
- ECG Interpretation: special `Not Applicable`

`Normal for Patient` is never offered or applied.

ETCO2 units cleanup is detected but left manual in this build until a reliable ImageTrend deselect/clear primitive is captured.

### Existing procedure entry helper

For an already-open procedure entry:

- Prior to this unit's EMS care: blank -> `No`
- Role/type: blank -> `Paramedic`; `Critical Care Paramedic` -> `Paramedic`; other populated values preserved
- Authorization: blank -> `Protocol (Standing Order)`
- Successful: blank -> `Yes`
- Size of Procedure Equipment: age >=18 -> `adult`; age <18 -> `pediatric`
- `Neurological assessment` comments -> `MEND`
- `Stroke Assessment` comments -> `FAST`
- `Moving a patient to a stretcher` comments -> `Stand, pivot, sit`

## Intentionally not in v0.1.2

- Starting procedure creation from the main grid automatically; v0.1.4 supports the four-procedure bundle from an already-open blank Procedure flyout.
- Applying Patient Arrival / Destination Arrival procedure timestamps automatically.
- Derived stretcher +3 minute / scene-departure -2 minute fallback timing.
- Automatic ETCO2-unit deselection.
- Automatic navigation between ImageTrend sections.
- Additional patient profiles such as U3/T3/sedated/intubated/critical-care.

These are deferred until the A15 core is validated against real outstanding charts.

## First chart test

1. Install `src/imagetrend-a15-helper.user.js` in Tampermonkey.
2. Open a routine existing Form42 chart.
3. Navigate to one relevant section at a time.
4. Click `A15 helper` -> `Scan this view`.
5. Review READY/KEPT/CONFLICT/MANUAL rows.
6. Check the acknowledgement and apply reviewed fields.
7. Manually verify every changed field before saving the chart.
8. Record any missing control, wrong current-value detection, ambiguous choice, or ImageTrend UI behavior before expanding scope.

## v0.1.2 option-click correction

Blank multiselect snapshots are arrays. The old scalar target comparator rejected even an unchanged empty array before clicking. Snapshot equality now compares arrays separately from the single requested target.

Options with `getOptionDisplay($data)` resolve to an explicit option row or an ancestor with a Knockout `click:` binding inside the same field. Arbitrary div/li fallback is removed. The adapter rejects missing, ambiguous, disabled, or mixed-content click targets, rechecks the snapshot immediately before clicking, and confirms the selected value after the click. It stops on timeout or chart detachment/navigation; it never invokes a view model directly.

Validation: JavaScript syntax check and eight synthetic browser cases passed: bound ancestor with delayed selected-value update, generic container rejection, duplicate options, disabled ancestor, stale snapshot, no-op timeout, value change while opening, and role=option selection. Array snapshot checks also passed. Run the regression from the repository root with Playwright installed and Microsoft Edge available: `node tests/choice-adapter.cjs`.

Live ImageTrend validation remains pending. Replace the installed script with v0.1.2, refresh, scan and review a blank transport multiselect, apply, and confirm the selected chip and the helper's confirmed-change log agree. Existing conflicting values must remain preserved.

## v0.1.3 transport profile correction

User screenshot and clarification confirm Transport from Scene Type should target `No Lights or Sirens`. The prior downgraded-response default was incorrect. An existing matching value now scans as KEPT; blank fields propose this corrected value. Other existing values remain conflicts. Transport Mode from Scene remains `Without Lights and Sirens`. Syntax check passed; live application of this version remains pending.

## v0.1.4 four-procedure bundle

Open a blank Procedure entry using ImageTrend Add, then open the helper. Review the four names and acknowledge that they were performed and are missing from this chart. Click **Add four procedures**.

The helper selects Assessment -ALS, Neurological assessment, Adult pain assessment, and Moving a patient to a stretcher in sequence, using the captured single-select option handlers (and search input when needed). It clicks the captured Add Another button after the first three entries and OK after the last. It requires a new generated procedure date-input ID and blank selector before advancing, and checks selection before each confirmation.

This action adds procedure names only. Review dates/times, metadata, and clinical details afterward; automatic timing and destination reassessments are not part of this action. The existing reviewed-field helper remains available for metadata. Chart Save/submit is never clicked, but Add Another and OK accept procedure entries inside ImageTrend.

The helper refuses populated starting entries, multiple/unknown flyouts, disabled controls (including ImageTrend's CSS disabled class), ambiguous or missing options, and failed transitions. A sessionStorage guard marks the attempt before any mutation and blocks repeat attempts in the same tab/chart, including after reload. It does not inventory existing chart procedures: the user must confirm the four are missing. A partial failure leaves earlier entries and possibly the open draft for manual review; do not add the bundle again blindly.

Validation: syntax check and eight synthetic Edge browser cases passed: four-entry success, search fallback, populated entry refusal, disabled button, missing option, duplicate options, no advancement, and repeat-attempt block. Run with Playwright and Edge: `node tests/procedure-bundle.cjs`. Live ImageTrend validation remains pending. Source markup was inspected locally and is not committed.

## v0.1.5 procedure role and stretcher timing

User confirmed live four-entry creation works. The bundle now corrects blank or Critical Care Paramedic roles to Paramedic on every generated procedure, verifying before accepting each entry. Unexpected roles stop the bundle.

Moving a patient to a stretcher now uses Unit Left Scene (29337Date/Time) minus two minutes, superseding the earlier preferred patient-arrival-plus-three rule for this action. Patient arrival (29336Date/Time) provides the lower chronology bound. Missing/ambiguous/invalid timeline fields or a result before patient arrival block the action. The timeline must be loaded in the DOM. Date rollover is handled; no current-clock fallback is used. Other procedure timestamps remain unchanged.

To repair the already-created stretcher entry, open it, Scan this view, review the proposed date/time and role corrections, then Apply reviewed fields. The original timestamp is shown in the plan and replaced only after review. Timeline changes since review invalidate the timing correction. Do not run Add four procedures again to repair existing entries.

Validation: syntax and twelve synthetic browser scenarios passed, including role corrections on all four entries, ordinary and midnight timing, existing-entry repair, impossible chronology, missing role, and existing bundle failure guards. Live v0.1.5 validation remains pending.
