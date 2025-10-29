import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { DevUtilsService } from './services/dev-utils.service';
import { environment } from '../environments/environment';

// Extend Window interface to include dev utilities
declare global {
  interface Window {
    devUtils?: {
      clearAllData: () => Promise<void>;
    };
  }
}

/**
 * Root app component
 * Serves as the application shell with header and router outlet
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [RouterOutlet, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly devUtils = inject(DevUtilsService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    // Expose dev utilities to browser console in development mode only
    if (!environment.production) {
      window.devUtils = {
        clearAllData: () => this.devUtils.clearAllData(),
      };
      console.log('%c🛠️ Development Mode', 'color: #f59e0b; font-size: 14px; font-weight: bold;');
      console.log(
        '%cDev utilities available:',
        'color: #10b981; font-size: 12px; font-weight: bold;',
      );
      console.log(
        '%c  window.devUtils.clearAllData() - Clear ALL project data (requires confirmation)',
        'color: #6b7280; font-size: 11px;',
      );
    }
  }

  hasRoute(route: string): boolean {
    return this.router.url.includes(route);
  }
}
