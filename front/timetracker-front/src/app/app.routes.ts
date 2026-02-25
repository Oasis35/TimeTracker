import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/timesheet/timesheet-page/timesheet-page').then(
        (m) => m.TimesheetPageComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
