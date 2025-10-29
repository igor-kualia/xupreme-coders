import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { BankAccountsTableComponent } from '../../components/bank-accounts-table/bank-accounts-table.component';

@Component({
  selector: 'app-accounts',
  imports: [BankAccountsTableComponent],
  templateUrl: './accounts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsComponent {
  private authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly userDisplayName = computed(() => {
    const user = this.user();
    return user?.name || user?.email || 'User';
  });
}
