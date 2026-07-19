# Contributing

Thanks for considering contributing to mailroute.

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Install dependencies: `npm install`
4. Copy the environment file: `cp .env.example .dev.vars`
5. Start the dev server: `npm run dev`

## Development

- **Type-check:** `npm run build` (tsc --noEmit)
- **Format:** `npm run format` (Prettier)

There is no test runner configured yet — `npm run build` is the correctness gate.

## Pull Request Guidelines

- Keep changes focused and atomic
- Update the README if you add or change a feature
- Run `npm run build` and `npm run format` before submitting
- Use a conventional commit prefix: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`

## Adding a New Email Vendor

1. Create `src/vendors/<name>.adapter.ts` implementing `EmailVendorAdapter`
2. Register it in `src/vendors/index.ts`
3. Insert an `email_vendors` row in D1 with the matching `name`

## Adding a New Email Template

Insert a row in the `email_templates` D1 table with a unique `slug`, then call `EmailTemplateService.getProcessedTemplate(slug, replacements)` from a route.
