# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are an expert in TypeScript, Angular, and scalable web application development. You write maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Project Overview

XupremeCoders is an Angular 20 application built with:
- **Angular 20.3** with zoneless change detection (`provideZonelessChangeDetection`)
- **Tailwind CSS 4.1** for styling with custom theme using oklch color space
- **Spartan UI (@spartan-ng/brain)** for UI components
- **TypeScript 5.9** with strict mode enabled
- **Standalone components** architecture (NgModules not used)
- **Signals-based** state management

## Development Commands

### Running the Application
```bash
npm start              # Start development server on http://localhost:4200
ng serve              # Alternative command
npm run watch         # Build in watch mode for development
```

### Testing
```bash
npm test              # Run tests (headless Chrome, no watch)
ng test               # Interactive test mode with watch
ng test --no-watch --no-progress --browsers=ChromeHeadless  # CI mode
```

### Code Quality
```bash
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix linting issues
npm run format:check  # Check Prettier formatting
npm run format        # Auto-format with Prettier
npm run check         # Run all checks (format, lint, test, build)
```

### Building
```bash
npm run build         # Production build (output in dist/)
ng build              # Same as above
```

### Code Generation
```bash
ng generate component component-name    # Generate component
ng generate service service-name        # Generate service
ng generate --help                      # See all available schematics
```

## Architecture

### Application Bootstrap
- Entry point: `src/main.ts`
- App config: `src/app/app.config.ts` with zoneless change detection and global error listeners
- Root component: `src/app/app.ts` (App class)
- Routing: `src/app/app.routes.ts`

### Styling System
- **Tailwind CSS 4.1** with PostCSS configuration (`.postcssrc.json`)
- Global styles in `src/styles.css` with custom CSS layers (theme, base, components, utilities)
- Design tokens using CSS custom properties with oklch color space
- Light/dark theme support via `:root` and `:root.dark` classes
- Roboto font family with variable font settings
- Spartan UI components with `hlm-tailwind-preset.css`

### TypeScript Configuration
- Strict mode enabled with additional strict flags:
  - `noImplicitOverride`, `noPropertyAccessFromIndexSignature`
  - `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Target: ES2022
- Experimental decorators enabled
- Angular strict templates and injection parameters

### Linting & Formatting
- **ESLint** with angular-eslint, typescript-eslint
- **Prettier** with plugins:
  - `prettier-plugin-organize-imports` (auto-organizes imports)
  - `prettier-plugin-tailwindcss` (sorts Tailwind classes)
- Angular parser for HTML templates
- Component selector prefix: `app-` (kebab-case)
- Directive selector prefix: `app` (camelCase)
- Print width: 100 characters, single quotes

### Testing
- **Jasmine** test framework
- **Karma** test runner with Chrome/ChromeHeadless
- Coverage reports enabled
- Test files: `tsconfig.spec.json` for test-specific configuration

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
