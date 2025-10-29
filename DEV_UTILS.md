# Development Utilities

This document describes the development utilities available in this project.

## Clear All Data Function

A development-only function to clear ALL data from the entire project.

### ⚠️ IMPORTANT WARNINGS

- **This function is EXTREMELY DANGEROUS!**
- It will delete ALL data for ALL users
- It only works in development environments (safety checks in place)
- This action CANNOT be undone
- System categories and category groups are preserved (they can be re-seeded)

### What Gets Deleted

When you run this function, it will delete:

1. **All transactions** (all users)
2. **All merchants** (all users)
3. **All global merchants**
4. **All merchant category mappings**
5. **All bank accounts** (all users)
6. **All bank links** (all users)
7. **All global institutions**
8. **All user-specific categories** (system categories are preserved)
9. **All user-specific category groups** (system groups are preserved)

### How to Use

#### From Browser Console

1. Open your application in development mode (`npm start`)
2. Open the browser DevTools console (F12 or Cmd+Option+I on Mac)
3. You'll see a message indicating development mode is active
4. Run the following command:

```javascript
await window.devUtils.clearAllData()
```

5. You'll be prompted with **two confirmation dialogs** - you must confirm both
6. The function will clear all data and reload the page

#### From Code

You can also call the function programmatically in your Angular components:

```typescript
import { inject } from '@angular/core';
import { DevUtilsService } from './services/dev-utils.service';

export class MyComponent {
  private readonly devUtils = inject(DevUtilsService);

  async clearData() {
    await this.devUtils.clearAllData();
  }
}
```

### Safety Mechanisms

This function has multiple safety layers:

1. **Environment Check (Frontend)**: The Angular service checks `environment.production` and throws an error if in production
2. **Double Confirmation**: Two confirmation prompts must be accepted
3. **Environment Check (Backend)**: The Convex mutation checks the deployment URL and will only run on the development deployment
4. **URL Whitelist**: The backend explicitly checks that it's running on the development Convex URL

**Note**: Authentication is NOT required - this is a development utility that can be used even when not logged in.

### Implementation Details

The function is implemented in three layers:

1. **Frontend Service** (`src/app/services/dev-utils.service.ts`):
   - Provides the public interface
   - Checks environment and shows confirmation dialogs
   - Calls the Convex mutation

2. **Convex Public Mutation** (`convex/devUtils.ts`):
   - Calls the internal mutation
   - No authentication required (dev utility)

3. **Convex Internal Mutation** (`convex/internal/clearAllData.ts`):
   - Performs the actual data deletion
   - Checks deployment URL for additional safety
   - Deletes data from all tables

### Development Workflow

This function is useful when you need to:
- Reset the database to a clean state
- Test initial setup flows
- Clear out test data
- Start fresh with a new data structure

### After Clearing Data

After running this function:
1. The page will automatically reload
2. You may need to re-link bank accounts
3. You may need to re-seed system categories (if they were accidentally deleted)
4. All user data will be gone

## Production Safety

**This function CANNOT run in production due to multiple safety checks:**
- The Angular service will throw an error if `environment.production` is true
- The Convex mutation checks the deployment URL and will reject if not on the development URL
- The frontend code that exposes `window.devUtils` is only loaded in development mode

Even if someone tried to call the Convex mutation directly in production, it would be rejected by the backend environment check.
