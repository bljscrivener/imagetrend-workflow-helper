# Native workflow 0.2.4.7

- Missing A15 procedures use the reviewed Add/Add Another/OK workflow; existing recognized entries use native updates. No chart Save or submit is called.
- Assessment/Exam: create a first entry only if absent, timestamp it at patient contact, enter no findings. Existing first/second entries receive patient-contact/destination-arrival timestamps respectively; findings are preserved. More than two entries require review. Missing destination timing blocks a second timestamp.
- Vital prior-to-care is included as No.
- Clearing now includes loaded mapped STAT/Transport fields under the patient branch, in addition to the four supported entry collections. Dispatch and timeline paths are excluded. Unmapped fields are preserved; this is not a complete chart wipe.
- Second clear warning includes artwork; verified clearing launches confetti. A small animated wheel indicates work. Reduced motion is respected.

Validation: native field/entry tests, assessment fixture tests (0/1/2/3 entries), and procedure workflow cases including search, midnight, missing choices, disabled controls, invalid timing, no advance, and retry locking. Live verification remains required, particularly Assessment/Exam context mappings and native persistence after reopening.
