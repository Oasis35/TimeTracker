import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'day',
  },
  {
    path: 'day',
    loadComponent: () =>
      import('./features/timesheet/timesheet-day-page/timesheet-day-page').then(
        (m) => m.TimesheetDayPageComponent,
      ),
  },
  {
    path: 'month',
    loadComponent: () =>
      import('./features/timesheet/timesheet-month-page/timesheet-month-page').then(
        (m) => m.TimesheetMonthPageComponent,
      ),
  },
  {
    path: 'tickets-grid',
    loadComponent: () =>
      import('./features/tickets-grid/tickets-grid-page/tickets-grid-page').then(
        (m) => m.TicketsGridPageComponent,
      ),
  },
  { path: '**', redirectTo: 'day' },
];

