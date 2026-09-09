# ImageTrend workflow rules — 2026-09-09

Investigation/design record for GRE-36. This file intentionally excludes patient identifiers and raw test-chart values.

## Rule classes

- **Never touch / preserve:** CAD-owned or clinically specific fields that should not be populated automatically.
- **Fill if blank:** apply only when the field is empty; never overwrite an existing value.
- **Known-value correction:** correct only a specifically known mismatch; otherwise review.
- **Derived rule:** calculate/select from other chart fields only when the source data is present and recognized.
- **Profile default:** user-selected workflow profile that applies reviewed routine metadata.

## Dispatch / CAD

- Unit Call Sign: never touch.
- Unit Number: never touch.
- Incident address/location: preserve CAD values except the explicit hospital rule below.
- Primary Role of Unit: fill if blank -> `Ground Transport (ALS Equipped)`.
- Crew Member Level: for the intended crew member, `Critical Care Paramedic` -> `Paramedic`; `Paramedic` stays unchanged; any other value requires review.
- Dispatch Priority -> Response Mode to Scene:
  - `Priority 1-Immediate/Warning Devices` -> `With Lights and Sirens`.
  - recognized P2/P3/P4/P5 -> `Without Lights and Sirens`.
  - blank/unrecognized -> no action.
  - conflicting populated response mode -> review rather than silent overwrite.
- If Dispatch Priority is P3 or P4 and Incident Location Type is blank -> `Hospital`; otherwise preserve.

## History

- Barriers to Patient Care: if blank -> `None Noted`; if anything is already present, preserve exactly and do not add `None Noted`.

## Destination

- Type of Destination: fill if blank -> `Hospital`.
- All other destination fields: preserve / do not auto-populate.

## Transport profile

Routine transport defaults:

- Number of Pts Transported in this Unit -> `1`.
- EMS Transport Method -> `Ground-Ambulance`.
- Transported To Closest Appropriate Facility -> leave blank.
- Transported To More Distant Facility Reason -> leave blank.
- Transport Mode from Scene -> `Without Lights and Sirens`.
- Transport from Scene Type -> `No Lights or Sirens`.
- How Pt Was Moved to Ambulance -> `Stretcher`.
- Patient Secured By -> `Cot- 5 straps, Including Shoulders`.
- Position of Pt During Transport -> `Semi-Fowlers`.
- How Pt Was Moved From Ambulance -> `Stretcher`.
- Final Pt Acuity -> leave blank.
- Accepting Hospital Notified -> `Yes`.
- Facility Notified By -> `Phone`.
- Receiving Hospital Contacted Date/Time -> Arrived at Destination minus 5 minutes, with chronology validation.
- Destination Team Pre-Arrival Alert or Activation -> `No`.

Timeline field IDs established by recon:

- `29335Date/Time` -> Unit Arrived on Scene.
- `29336Date/Time` -> Arrived at Patient.
- `29337Date/Time` -> Unit Left Scene.
- `29338Date/Time` -> Arrived at Destination.
- `29340Date/Time` -> Destination Patient Transfer of Care.

## Vitals helper safety boundary

Measured numerical values are **read-only and sacred**. The helper must never alter SBP, DBP, MAP, HR, RR, SpO2, ETCO2, glucose, temperature, pain score, or other measured/calculated numeric values.

The helper may apply reviewed metadata/profile selections only.

### Routine A15 patient profile

Default GUI profile for the common routine patient:

- AVPU -> `Alert`.
- GCS Eye -> `4- Opens Eyes spontaneously (All Age Groups)`.
- GCS Verbal -> `5- Oriented (>2 Years); Smiles, oriented to sounds, follows objects, interacts`.
- GCS Motor -> `6- Obeys commands (>2Years); Appropriate response to stimulation`.
- GCS Qualifier -> `Initial GCS has legitimate values without interventions such as intubation and sedation`.
- Do not offer `Normal for Patient` as a selectable helper option.
- BP Method -> `Cuff-Automated`.
- BP Location -> ignore/preserve.
- Heart Rate Method -> `Electronic Monitor - Pulse Oximeter`.
- Respiratory Effort -> `Normal`.
- Pulse Oximetry Qualifier -> `Room Air`.
- Pain Scale Type -> `Numeric (0-10)`.
- If A15: Stroke Scale Score -> `Negative`; Stroke Scale Type -> `FAST`.
- ECG Interpretation -> special not-value `Not Applicable` only.
  - blank -> select `Not Applicable`.
  - already `Not Applicable` -> preserve.
  - any meaningful existing ECG interpretation -> preserve and flag/review.
- `.not-value-label` is a reusable control pattern for special values such as `Not Applicable`.
- ETCO2 units rule: if the ETCO2 numeric field is blank and `mmHg` is selected/highlighted, deselect `mmHg`; otherwise preserve.

Future profiles may include sedated, intubated, altered, stroke, respiratory-distress, and custom states. Profiles should expose the component fields and never hide what will be written.

## Procedure bundle

Exact ImageTrend procedure labels confirmed:

- `Assessment -ALS`
- `Neurological assessment`
- `Stroke Assessment`
- `Adult pain assessment`
- `Moving a patient to a stretcher`

Routine timing:

- At Arrived at Patient / Patient Arrival:
  - `Assessment -ALS`
  - `Neurological assessment`
  - `Stroke Assessment`
  - `Adult pain assessment`
- Moving to stretcher -> preferred Arrived at Patient + 3 minutes; fallback Unit Left Scene - 2 minutes. Reject impossible chronology.
- At Arrived at Destination:
  - `Neurological assessment`
  - `Adult pain assessment`

Routine procedure metadata:

- Procedure Performed Prior to this Unit's EMS Care -> `No`.
- Role/Type of Person Performing the Procedure -> `Paramedic`.
- Procedure Authorization -> `Protocol (Standing Order)`.
- Procedure Successful -> `Yes`.
- Procedure Complication / Response / Location remain manual unless a later explicit rule is defined.

Procedure comments / derived text:

- Size of Procedure Equipment -> `adult` when age >= 18 years; `pediatric` when age < 18 years; if age unavailable/ambiguous, leave blank.
- `Neurological assessment` comments -> `MEND`.
- `Stroke Assessment` comments -> `FAST`.
- `Moving a patient to a stretcher` comments -> `Stand, pivot, sit`.

## Timestamp primitives

Prefer ImageTrend native milestone controls where available. Confirmed reusable labels include `.time-button-label` values `Patient Arrival` and `Destination Arrival`.

Derived offsets should read the existing chart timeline, not the current clock. All derived times require chronology checks and should fail closed if source times are missing or inconsistent.
