# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-05-15

### Added

- Shadow decision recording: new mods record action + reasoning without executing it
- Blind senior review: senior mods record independent call before seeing trainee's decision
- `onModAction` trigger: detects real mod actions and schedules comparison reports
- Async report delivery: comparison report sent via modmail (mod note fallback)
- Longitudinal stats: per-trainee accuracy tracking in Redis
- 7 supported action types: approve, remove, flair, warn, temp_ban, perm_ban, escalate
- App settings: senior mod list configurable per subreddit via menu action
- Initial upload to Reddit Developer Platform as `shadow-mod`
