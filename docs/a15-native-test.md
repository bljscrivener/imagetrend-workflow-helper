# A15 Native Test 0.2.4.1

Separate experimental successor to A15 0.2.4, based on Preset Lab 0.2.2. Disable A15 and Preset Lab while testing this script. Stable A15 is unchanged.

Install src/imagetrend-a15-native-test.user.js. From any open TEST chart section, open A15 Native Test (top right), leave All A15 defaults selected, preview, review every ready value, acknowledge, then Go, baby, go. Individual fields can also be selected using the dropdown. No chart navigation is required.

The v0.2.4 static rule catalog plus First EMS Unit Yes and Additional Response Mode No Lights or Sirens is reviewed against loaded agency preset definitions. Field paths and multiplicity must be unambiguous for this reporting standard. Target codes come only from exact unique resource display matches. The target value replaces the template value in a temporary native definition; the agency preset itself is not edited. Unsupported entries are listed individually and do not prevent other mapped fields from being reviewed.

Only blank answers can be written. Populated answers and special flags are preserved. Before writing, the incident identity, lock state, answer snapshot, and target display are rechecked; each write is read back. Failure during apply stops the remaining batch; earlier writes may remain. No explicit chart Save or outer preset audit is called, but native updates may persist automatically.

This is a native field-mapping test, not full A15 feature parity. Procedures, repeated vitals, hospital activation rows, input values, priority-dependent service selection, timeline/delay derivation, and clearing require further native validation and are not executed. Service is deliberately withheld rather than retaining the old unconditional emergency default. Timing/clear tools are not present in this test UI.

Validation: syntax and synthetic browser tests passed, including both previously proven targets absent from the current page, circular model references, unsupported mappings alongside ready actions, existing-value preservation, stale preview rejection, and locked/unknown chart states. The broader native build needs live TEST-chart verification. Only the two Preset Lab fields have user-confirmed live off-page success.