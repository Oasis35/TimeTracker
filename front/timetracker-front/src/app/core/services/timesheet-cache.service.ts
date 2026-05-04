import { Injectable, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TrackerApi } from '../api/tracker-api';
import { TicketTotalDto, TimesheetMetadataDto } from '../api/models';

@Injectable({ providedIn: 'root' })
export class TimesheetCacheService {
  readonly metadataRes = resource<TimesheetMetadataDto, undefined>({
    loader: () => firstValueFrom(this.api.getMetadata()),
  });

  readonly ticketTotalsRes = resource<TicketTotalDto[], undefined>({
    loader: () => firstValueFrom(this.api.getTicketTotals()),
  });

  constructor(private readonly api: TrackerApi) {}

  invalidate(): void {
    this.metadataRes.reload();
    this.ticketTotalsRes.reload();
  }

  invalidateTotals(): void {
    this.ticketTotalsRes.reload();
  }
}
