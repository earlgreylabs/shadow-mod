# Contributing to ShadowMod

Thanks for your interest in contributing. This document covers the development workflow, conventions, and review expectations.

---

## Getting started

```bash
git clone git@github.com-earlgreylabs:earlgreylabs/shadow-mod.git
cd shadow-mod
pnpm install
```

You will need:

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io)
- [Devvit CLI](https://developers.reddit.com/docs/cli): `npm install -g devvit` (global install — the only exception to the no-global-npm rule)
- A Reddit account with developer access and a test subreddit

---

## Development workflow

```bash
pnpm run build     # compile + type-check (must pass before any PR)
pnpm run dev       # live playtest on a registered test subreddit
pnpm run test      # unit tests (vitest)
pnpm run lint      # eslint
```

The pre-commit hook (lefthook) runs type-check, lint, format, and tests automatically. All checks must pass before a commit is accepted. Do not bypass with `--no-verify`.

---

## Conventions

### TypeScript

- Strict mode is required. No `any` without a comment explaining why.
- Absolute imports only (`@/server/core/decisions`). Relative imports are allowed within the same feature folder.
- `Number.parseInt`, `Number.isNaN` — not the bare global versions.
- Guard clauses over nesting: handle invalid cases first, return early.

### Terminology

The Observer/Reviewer naming scheme is enforced. Do not use `shadowMod`, `seniorMod`, `ShadowDecision`, or `SeniorDecision` anywhere in code, comments, or copy. See the full glossary in `.claude/rules/glossary.md`.

### Redis schema changes

Any change to a Redis key pattern or stored type must include a migration note in `CHANGELOG.md` explaining what to do on a live install.

---

## CHANGELOG

Every change that affects user-facing behaviour, fixes a bug, or alters the Redis schema requires a bullet under `## [Unreleased]` in `CHANGELOG.md`. Use the subsections `### Added`, `### Fixed`, `### Changed`, `### Removed`. Past versioned sections are immutable.

---

## Pull requests

- One logical change per PR.
- `pnpm run build` and all tests must pass.
- PR title: imperative, lowercase start (`fix: duplicate observation guard`, `feat: reviewer queue pagination`).
- Reference the relevant CHANGELOG entry in the PR description.
- Screenshots or a brief playtest note for any visible UI change.

---

## Reporting issues

Open a GitHub issue with:

- Devvit version (`devvit version`)
- The subreddit type (public, restricted, private)
- Steps to reproduce
- Expected vs actual behaviour

---

## Licence

By contributing, you agree that your contributions will be licensed under the [MIT Licence](./LICENSING.md).
