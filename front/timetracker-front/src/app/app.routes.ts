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
    path: 'tickets-grid',
    loadComponent: () =>
      import('./features/tickets-grid/tickets-grid-page/tickets-grid-page').then(
        (m) => m.TicketsGridPageComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
