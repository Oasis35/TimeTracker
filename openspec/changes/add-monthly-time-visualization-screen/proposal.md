## Why

Users can log time entries, but there is no month-level view that makes totals and distribution across days easy to understand. A dedicated monthly visualization helps users review workload patterns, spot missing entries, and reconcile timesheets faster.

## What Changes

- Add a new monthly time visualization screen that shows all days in a selected month.
- Display per-day logged time and month-to-date totals in a single view.
- Add month navigation (previous/next month and jump to current month).
- Support opening day details from the monthly view for quick inspection.

## Capabilities

### New Capabilities
- `monthly-time-visualization`: Provide a dedicated month screen that visualizes daily logged time and monthly totals with month navigation and day-level drill-down.

### Modified Capabilities
- None.

## Impact

- Frontend routing/navigation to expose a new month view screen.
- Frontend UI components for month grid/chart, totals, and day detail interaction.
- Time aggregation logic to group entries by day within a selected month.
- Potential backend query optimization if monthly data volume requires batched or range-based retrieval.
