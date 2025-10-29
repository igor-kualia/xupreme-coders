import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/**
 * Login page component
 * Displays login button that triggers Auth0 Universal Login
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly auth0 = inject(Auth0Service);

  protected readonly isLoading = this.authService.isLoading;
  protected readonly isAuthenticated = this.authService.isAuthenticated;

  async ngOnInit(): Promise<void> {
    try {
      // Check authentication using observable directly (works with zoneless)
      const isAuthenticated = await firstValueFrom(this.auth0.isAuthenticated$);

      // If already authenticated, redirect to dashboard
      if (isAuthenticated) {
        await this.router.navigate(['/dashboard']);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    }
  }

  login(): void {
    this.authService.login();
  }
}
