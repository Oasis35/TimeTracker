## ADDED Requirements

### Requirement: Monthly calendar time overview
The system SHALL provide a monthly time visualization screen that displays every calendar day in the selected month and the total logged time for each day.

#### Scenario: Open monthly view for current month
- **WHEN** the user opens the monthly time visualization screen
- **THEN** the system shows all days for the current month with each day's logged-time total

#### Scenario: Show days with no entries
- **WHEN** a day in the selected month has no logged entries
- **THEN** the system shows that day with a zero-time value

### Requirement: Month-level total summary
The system SHALL display an aggregate month total computed from all logged time entries in the selected month.

#### Scenario: Calculate month total
- **WHEN** the selected month data is loaded
- **THEN** the system shows a month total equal to the sum of all daily totals in that month

### Requirement: Month navigation controls
The system SHALL allow users to navigate to the previous month, next month, and return to the current month from the monthly visualization screen.

#### Scenario: Navigate to previous month
- **WHEN** the user selects the previous-month control
- **THEN** the system loads and displays the previous month with updated daily totals and month total

#### Scenario: Jump to current month
- **WHEN** the user selects the current-month control while viewing another month
- **THEN** the system loads and displays the current month

### Requirement: Day-level detail access
The system SHALL allow users to open day-level details from a day in the monthly visualization.

#### Scenario: Open details for a selected day
- **WHEN** the user selects a day from the monthly view
- **THEN** the system opens day-level details for that calendar date
