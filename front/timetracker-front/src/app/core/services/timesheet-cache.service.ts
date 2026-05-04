import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TrackerApi } from '../api/tracker-api';
import { TicketTotalDto, TimesheetMetadataDto } from '../api/models';
import { IncompleteDaysService } from './incomplete-days.service';

@Injectable({ providedIn: 'root' })
export class TimesheetCacheService {
  private readonly api = inject(TrackerApi);
  private readonly incompleteDays = inject(IncompleteDaysService);

  readonly metadataRes = resource<TimesheetMetadataDto, undefined>({
    loader: () => firstValueFrom(this.api.getMetadata()),
  });

  readonly ticketTotalsRes = resource<TicketTotalDto[], undefined>({
    loader: () => firstValueFrom(this.api.getTicketTotals()),
  });

  constructor() {}

  invalidate(): void {
    this.metadataRes.reload();
    this.ticketTotalsRes.reload();
    this.incompleteDays.reload();
  }

  invalidateTotals(): void {
    this.ticketTotalsRes.reload();
    this.incompleteDays.reload();
  }
}
