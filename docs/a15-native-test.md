# A15 Native Test 0.2.4.1

Separate experimental successor to A15 0.2.4, based on Preset Lab 0.2.2. Disable A15 and Preset Lab while testing this script. Stable A15 is unchanged.

Install src/imagetrend-a15-native-test.user.js. From any open TEST chart section, open A15 Native Test (top right), leave All A15 defaults selected, preview, review every ready value, acknowledge, then Go, baby, go. Individual fields can also be selected using the dropdown. No chart navigation is required.

The v0.2.4 static rule catalog plus First EMS Unit Yes and Additional Response Mode No Lights or Sirens is reviewed against loaded agency preset definitions. Field paths and multiplicity must be unambiguous for this reporting standard. Target codes come only from exact unique resource display matches. The target value replaces the template value in a temporary native definition; the agency preset itself is not edited. Unsupported entries are listed individually and do not prevent other mapped fields from being reviewed.

Only blank answers can be written. Populated answers and special flags are preserved. Before writing, the incident identity, lock state, answer snapshot, and target display are rechecked; each write is read back. Failure during apply stops the remaining batch; earlier writes may remain. No explicit chart Save or outer preset audit is called, but native updates may persist automatically.

This is a native field-mapping test, not full A15 feature parity. Procedures, repeated vitals, hospital activation rows, input values, priority-dependent service selection, timeline/delay derivation, and clearing require further native validation and are not executed. Service is deliberately withheld rather than retaining the old unconditional emergency default. Timing/clear tools are not present in this test UI.

Validation: syntax and synthetic browser tests passed, including both previously proven targets absent from the current page, circular model references, unsupported mappings alongside ready actions, existing-value preservation, stale preview rejection, and locked/unknown chart states. The broader native build needs live TEST-chart verification. Only the two Preset Lab fields have user-confirmed live off-page success.
## 0.2.4.2 mapping capture

Adds Copy field mappings above the selector. Open a vital or procedure entry, click this button and paste into the development chat. Capture whitelists binding paths, definition/control identifiers and multiplicity flags; no answer values are included. Clipboard failures display an error. Existing A15 native write scope is unchanged; repeated entries remain pending these mappings. Synthetic capture tests confirm no answer leakage or writes.


## 0.2.4.4 existing-entry native test

Uses captured paths to enumerate all existing vital entries and the four recognized A15 procedure types. Preview explicitly shows replacements for existing vital metadata/procedure details; the acknowledgment covers those replacements. Measured numbers, timestamps, crew IDs, and procedure names are not targets. No procedure creation. Existing non-A15 procedures are blocked. Object identity is retained across reordering, and removal or changed answers invalidates the review. Nested qualifier collections remain scoped to their vital entry. The native API must resolve indexed paths and return the expected display or that action fails closed. These new paths are synthetically tested, not live-verified.

Tests cover two vital entries, replacement AVPU and GCS, nested GCS qualifiers, recognized procedure role correction, unrelated procedure preservation, reordering, removal, protected blood pressure, and repeat prevention. Earlier versions' blanket repeated-entry exclusion is superseded by this section.


## 0.2.4.5 single profile UI

Removed the field dropdown. Profile: A15 is fixed and Preview A15 changes reviews the full supported profile. STEMI, CVA and trauma are future profiles, not currently selectable.

