# ShadowMod — App-Scope Instructions

This file applies to work inside `shadow-mod/`. The workspace-wide coordinator and rules live one level up at `../CLAUDE.md` and `../.claude/`. Read those first; this file only adds app-specific patterns.

---

## Repo identity

- GitHub remote: `git@github.com-earlgreylabs:earlgreylabs/shadow-mod.git` (SSH alias `github.com-earlgreylabs`, key `~/.ssh/id_rsa_earlgrey`).
- Reddit account for Devvit: `u/EarlGrey__`.
- This is the **only** folder in the workspace that publishes anywhere. Everything outside `shadow-mod/` stays local.

## Commands

```bash
pnpm run build     # compile + type-check
pnpm run dev       # live playtest on registered test subreddit
pnpm run upload    # push to Devvit marketplace (REQUIRES explicit user approval)
```

## Stack

- **Devvit** (Reddit's developer platform).
- **TypeScript** strict, absolute imports via `tsconfig.json` paths only.
- **Redis** via Devvit's built-in client.

## Terminology in code (canonical)

Pulled from `../.claude/rules/glossary.md` — that file is the source of truth. Quick reference for app code:

- `observer` (mod-in-training) / `reviewer` (independent reviewer)
- `Observation` type (Observer's recorded decision) / `Review` type (Reviewer's blind decision) / `Report` (Comparison)
- Redis keys: `observation:{postId}:{observerId}`, `review:{postId}:{reviewerId}`, `pending` (sorted set), `config:reviewers` (set), `stats:{userId}`.
- Role gating: `forUserType: "moderator"` in devvit.json; Observer vs Reviewer determined by membership in `config:reviewers`.

If you find old identifiers (`shadowMod*`, `seniorMod*`, `ShadowDecision`, `SeniorDecision`, `config:seniorMods`, `pending_senior`) anywhere in this folder, flag them as drift and propose the rename in a focused diff. Do not silently migrate Redis keys on a live install without a migration note in `CHANGELOG.md`.

## Core flow

1. Observer opens a queued post, picks "Record observation" menu action, fills form (action + reasoning). The action is **not executed**.
2. Reviewer sees "Record review" on the same post, records their decision **blind** to the Observer's.
3. When a real mod action is taken on the post (any mod or AutoModerator), `onModAction` trigger fires.
4. Trigger schedules the `generate-report` job, which produces a Comparison report (Observation vs Review vs Outcome) and delivers it to the Observer via modmail (mod note fallback if modmail unavailable).

## When you finish a change

- Run `pnpm run build` — must pass clean.
- If UI changed visibly, request the screenshot-curator agent re-capture the affected flow (`assets/screenshots/flows/` lives outside this folder).
- Update `CHANGELOG.md` with a short entry; migration steps for any Redis schema change.
- Never run `pnpm run upload` without explicit user approval.

## What does NOT belong here

- Hackathon narrative, judging-criteria walkthroughs → `../hackathon/`
- Marketing copy, social posts, visuals → `../marketing/`
- Research / scraping / sentiment → `../research/`
- Screenshots (even of this app's UI) → `../assets/screenshots/`
