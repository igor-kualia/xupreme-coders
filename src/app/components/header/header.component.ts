import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Header component
 * Displays navigation bar with user info and logout button
 */
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly authService = inject(AuthService);
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly userDisplayName = this.authService.userDisplayName;
  protected readonly user = this.authService.user;

  logout(): void {
    this.authService.logout();
  }
}
