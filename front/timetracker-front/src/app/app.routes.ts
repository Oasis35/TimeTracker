import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/timesheet/timesheet-page/timesheet-page').then(
        (m) => m.TimesheetPageComponent,
      ),
  },
  {
    path: 'tickets',
    loadComponent: () =>
      import('./features/tickets/tickets-page/tickets-page').then((m) => m.TicketsPageComponent),
  },
  {
    path: 'monthly',
    loadComponent: () =>
      import('./features/monthly/monthly-page/monthly-page').then((m) => m.MonthlyPageComponent),
  },
  { path: '**', redirectTo: '' },
];
