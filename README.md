# GL-SW-IMTR1 — ImageTrend Workflow Helper

DOM-aware browser automation for repetitive ImageTrend Elite ePCR charting tasks.

## Current state

The project has moved from AutoHotkey/tab-count automation to a DOM-aware userscript architecture. The current STAT workflow helper targets known ImageTrend field containers, validates labels and expected choices, refuses to overwrite conflicting existing answers, requires explicit review acknowledgement, verifies changes after each action, and never clicks Save or submits the chart.

## Current supported controls

- `button.smart-list-item`
- `KOSINGLESELECT` / `.koSingleselect`
- `.koSingleselect-down-button`
- `.koSingleselect-dropDownItem`
- `.koSingleselect-searchbar-input`
- dedicated action buttons inside `#form-composer`

## Next milestone

GRE-36: build a field reconnaissance command and registry that captures the active section, field container ID, label, control type, current value, valid choices, and useful IDs/classes across the major ePCR sections. The resulting registry will support reusable workflow profiles rather than tab-count macros.

## Safety model

The helper is intentionally fail-closed:

- does not overwrite a nonblank answer that differs from the reviewed workflow value
- verifies field identity before acting
- rechecks the chart state immediately before execution
- stops on navigation or unexpected field changes
- performs final verification
- never clicks Save or submits

ImageTrend may persist field edits as they are made, so any stopped run must be reviewed manually before continuing.
