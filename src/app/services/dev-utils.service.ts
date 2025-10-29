/**
 * Development utilities service
 * IMPORTANT: These functions should only be used during development
 */

import { Injectable, inject } from '@angular/core';
import { ConvexService } from './convex.service';
import { environment } from '../../environments/environment';
import { api } from '../../../convex/_generated/api';

@Injectable({
  providedIn: 'root',
})
export class DevUtilsService {
  private readonly convex = inject(ConvexService);

  /**
   * Clears ALL data for the ENTIRE project
   * DANGEROUS: This will delete ALL data for ALL users including:
   * - All transactions (all users)
   * - All merchants (all users)
   * - All global merchants
   * - All bank accounts (all users)
   * - All bank links (all users)
   * - All global institutions
   * - All user-specific categories
   * - All user-specific category groups
   *
   * System categories and system category groups are preserved.
   *
   * This function is protected to only run in development environments
   *
   * @throws Error if called in production environment
   */
  async clearAllData(): Promise<void> {
    // SAFETY CHECK: Only allow this in development
    if (environment.production) {
      throw new Error('clearAllData cannot be called in production environment');
    }

    // Double confirmation prompt
    const confirmed = window.confirm(
      '⚠️⚠️⚠️ EXTREME WARNING ⚠️⚠️⚠️\n\n' +
        'This will delete ALL DATA for the ENTIRE PROJECT!\n\n' +
        'This includes:\n' +
        '- All transactions (ALL USERS)\n' +
        '- All merchants (ALL USERS)\n' +
        '- All global merchants\n' +
        '- All bank accounts (ALL USERS)\n' +
        '- All bank links (ALL USERS)\n' +
        '- All global institutions\n' +
        '- All user categories (ALL USERS)\n' +
        '- All user category groups (ALL USERS)\n\n' +
        'Only system categories will be preserved.\n\n' +
        'This action CANNOT be undone!\n\n' +
        'Are you sure you want to continue?',
    );

    if (!confirmed) {
      console.log('Data cleanup cancelled by user');
      return;
    }

    // Second confirmation
    const doubleConfirmed = window.confirm(
      'Are you ABSOLUTELY POSITIVELY sure?\n\n' +
        'This will DELETE ALL DATA FOR EVERYONE!\n\n' +
        'This is your last chance to cancel.\n\n' +
        'Click OK to DELETE EVERYTHING.',
    );

    if (!doubleConfirmed) {
      console.log('Data cleanup cancelled by user');
      return;
    }

    try {
      console.log('🧹 Initiating COMPLETE data cleanup...');
      const result = await this.convex.mutation(api['devUtils'].clearAllData, {});
      console.log('✅ Complete data cleanup finished:', result);
      alert('ALL project data has been cleared successfully. The page will reload.');

      // Reload the page to reflect the changes
      window.location.reload();
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      alert(`Failed to clear data: ${error}`);
      throw error;
    }
  }

  /**
   * Helper function to check if we're in development mode
   */
  isDevelopmentMode(): boolean {
    return !environment.production;
  }
}
