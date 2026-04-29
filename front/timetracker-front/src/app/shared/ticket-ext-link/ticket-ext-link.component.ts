import { Component, Input, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExternalLinkService } from '../../core/services/external-link.service';

@Component({
  selector: 'app-ticket-ext-link',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './ticket-ext-link.component.html',
  styleUrl: './ticket-ext-link.component.scss',
})
export class TicketExtLinkComponent {
  @Input() externalKey: string = '';
  @Input() ticketType: string = '';

  private readonly extLink = inject(ExternalLinkService);

  readonly url = computed(() => {
    if (this.ticketType === 'ABSENT') return '';
    return this.extLink.buildUrl(this.externalKey);
  });
}
