import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { combineLatest, map, Observable } from 'rxjs';

import { TrackerApiService } from '../../../core/api/tracker-api';
import { TimesheetMonthDto } from '../../../core/models/dtos';

@Component({
  selector: 'app-timesheet-page',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe],
  templateUrl: './timesheet-page.html',
  styleUrl: './timesheet-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimesheetPage implements OnInit {
  vm$!: Observable<{
    year: number;
    month: number;
    days: string[];
    rows: TimesheetMonthDto['rows'];
    allowedQuantities: number[];
  }>;

  constructor(private api: TrackerApiService) {}

  ngOnInit(): void {
    const now = new Date();

    const metadata$ = this.api.getMetadata();
    const sheet$ = this.api.getTimesheet(now.getFullYear(), now.getMonth() + 1);

    this.vm$ = combineLatest([metadata$, sheet$]).pipe(
      map(([meta, sheet]) => ({
        year: sheet.year,
        month: sheet.month,
        days: sheet.days,
        rows: sheet.rows,
        allowedQuantities: meta.allowedQuantities
      }))
    );
  }

  trackDay = (_: number, d: string) => d;
  trackRow = (_: number, r: any) => r.ticketId;
}
