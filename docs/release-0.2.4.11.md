# Gremlin Logic A15 0.2.4.11

This release addresses the reported timeline, conditional response, and repeated-entry failures.

- Read Response Times by their visible labels, with the known numeric IDs as fallback. Wait for binding to settle and identify which required source time is missing.
- Set procedure and assessment times through rendered native controls, using Patient Arrival and Destination Arrival shortcuts when available. Verify the displayed date and time rather than putting UTC strings into wall-clock fields.
- Keep the first assessment at patient contact and the existing second assessment at destination. Do not create a second assessment or add findings.
- Preserve procedure/assessment action errors instead of passing failed actions to the ordinary field-mapping lookup. Allow an empty procedure grid without requiring rendered rows.
- Read Dispatch Priority without changing it. P1 selects with lights/sirens; P2 selects without. Both select emergency primary-area service. P3–P5 select no lights/sirens and leave service type for manual confirmation. Preserve unrelated response descriptors.
- Resolve scalar-valued multiselect entries, including transport movement, restraints, and position. Retain existing nonblank transport answers.
- Show run progress and bounded recovery activity. Preserve clickable issues and report interrupted runs as stopped.

## Validation

The five automated browser suites cover two vital sets, direct Go and capture failure, transport and two-choice delays, conditional priority transitions, existing scalar list entries, label-based timeline controls, native timezone representation, midnight subtraction, assessment counts and findings preservation, procedure creation/failures/retry, Stop, and clear cancellation/preservation.

These are controlled browser fixtures, not a completed live ImageTrend validation. Verify the user's example chart: assessment procedures 11:00, stretcher 11:13, hospital contacted 11:30, 17-minute scene None/No Delay, and 25m20s destination interval. Run again to check for duplicates.

Persistent learned mappings and a full source-module/build refactor remain future work. Existing mapping gaps remain visible rather than guessed. Chart Save stays user-controlled.
