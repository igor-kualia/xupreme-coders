# XupremeCoders

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute the unit tests, use the following command. By default, this project may use [Karma](https://karma-runner.github.io) or [Vitest](https://vitest.dev/) as the test runner.

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Plaid Integration

This project uses [Plaid](https://plaid.com/) for financial account connections via [Convex](https://www.convex.dev/) backend functions.

### Setting up Plaid Environment Variables

Before using Plaid features, you need to configure the following environment variables in your Convex deployment:

1. **Via Convex Dashboard:**
   - Go to https://dashboard.convex.dev/
   - Select your deployment
   - Navigate to Settings → Environment Variables
   - Add the following variables:
     - `PLAID_CLIENT_ID`: Your Plaid client ID
     - `PLAID_SECRET`: Your Plaid secret key
     - `PLAID_ENV`: `sandbox`, `development`, or `production`

2. **Via Convex CLI:**
   ```bash
   npx convex env set PLAID_CLIENT_ID your_client_id_here
   npx convex env set PLAID_SECRET your_secret_here
   npx convex env set PLAID_ENV sandbox
   ```

### Getting Plaid Credentials

1. Sign up for a free Plaid account at https://dashboard.plaid.com/signup
2. Get your `client_id` and `secret` from the Plaid Dashboard under Team Settings → Keys
3. For testing, use the **Sandbox** environment credentials

### Plaid Sandbox Test Credentials

When using Plaid Link in Sandbox mode, use these test credentials:
- **Username:** `user_good`
- **Password:** `pass_good`
- **MFA Code:** `1234` (if prompted)

### Available Convex Functions

- `createLinkToken({ userId: string })` - Creates a Plaid Link token for initializing Plaid Link on the frontend

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
