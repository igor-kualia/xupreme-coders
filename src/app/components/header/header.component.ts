import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BrnMenuTrigger } from '@spartan-ng/brain/menu';
import {
  HlmMenu,
  HlmMenuItem,
  HlmMenuItemIcon,
  HlmMenuLabel,
  HlmMenuSeparator,
} from '../../lib/ui/ui-menu-helm/src';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut, lucideChevronDown, lucideMenu } from '@ng-icons/lucide';
import { HlmIcon } from '@spartan-ng/helm/icon';

/**
 * Header component
 * Displays navigation bar with user info and logout button
 */
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  imports: [
    RouterLink,
    RouterLinkActive,
    BrnMenuTrigger,
    HlmMenu,
    HlmMenuItem,
    HlmMenuItemIcon,
    HlmMenuLabel,
    HlmMenuSeparator,
    NgIcon,
    HlmIcon,
  ],
  providers: [provideIcons({ lucideLogOut, lucideChevronDown, lucideMenu })],
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
