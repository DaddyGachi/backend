# Contributing to Dorisio Backend

Thank you for your interest in contributing to the Dorisio backend!

## Which Repo Should I Contribute To?

- **backend** (this repo) — Payment orchestration, Stellar integration, webhooks, database
- **frontend** — Web UI, wallet connect, tip interface
- **sdk** — TypeScript SDK, sandbox mode, CLI tools for developers

## Getting Started

1. Fork this repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/backend.git`
3. Create a feature branch: `git checkout -b feature/description`
4. Make your changes
5. Commit with clear messages following our conventions
6. Push to your fork and open a Pull Request

## Branch Naming Conventions

- `feature/short-description` — New features
- `fix/short-description` — Bug fixes
- `docs/short-description` — Documentation updates
- `refactor/short-description` — Code refactoring
- `security/short-description` — Security-related fixes

## Commit Message Conventions

Follow conventional commits:

```
type(scope): brief description

Longer explanation if needed.

Closes #123
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `security`

**Example:** `feat(payments): add retry logic to Stellar transactions`

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Run `npm run lint` and `npm run build`
4. Ensure tests pass: `npm run test`
5. Link related issues
6. Request review from maintainers

## Code Standards

- **TypeScript** — All code must be fully typed
- **Format** — Run `npm run format` before committing
- **Lint** — Run `npm run lint` to check for issues
- **Tests** — Write tests for new functionality

## Filing Issues

**Bugs:** Include reproduction steps, expected vs actual behavior, environment details.

**Features:** Describe the use case, proposed solution, and alternatives.

## Security

**Do not open public issues for security vulnerabilities.** See SECURITY.md for reporting procedures.

## License

By contributing, you agree your contributions will be licensed under the MIT License.
