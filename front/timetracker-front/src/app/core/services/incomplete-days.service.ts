import { Injectable, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TrackerApi } from '../api/tracker-api';

@Injectable({ providedIn: 'root' })
export class IncompleteDaysService {
  private readonly api = inject(TrackerApi);

  readonly incompleteDaysRes = resource({
    loader: () => firstValueFrom(this.api.getIncompleteDays()),
  });

  readonly days = computed(() => this.incompleteDaysRes.value()?.incompleteDays ?? []);
  readonly count = computed(() => this.days().length);

  reload(): void {
    this.incompleteDaysRes.reload();
  }
}
