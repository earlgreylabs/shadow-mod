# Privacy Policy

**ShadowMod** is a [Devvit](https://developers.reddit.com) app. Devvit is Reddit's first-party
developer platform. ShadowMod has no servers, no database, and no infrastructure of its own.
Every operation runs inside Reddit's own platform and every piece of data stays there.

---

## What data is stored

When mods use ShadowMod, the following is stored:

- Reddit usernames of Observers and Reviewers
- Mod action choices and reasoning text entered into observation and review forms
- Per-Observer accuracy stats (total decisions, matched, diverged)
- The subreddit's Reviewer username list

## Where it is stored

All data is written to **Devvit Redis**, Reddit's built-in key-value store. It is:

- Hosted entirely on Reddit's infrastructure
- Namespaced per subreddit install — one subreddit's data is never accessible to another
- Subject to Reddit's own data handling, security, and retention practices

ShadowMod does not make any network calls to servers outside of Reddit's platform. There is no
external database, no third-party analytics, no logging service, and no data pipeline outside
Reddit.

## Who can access the data

- **Observers** receive their own Comparison report via Reddit modmail
- **Reviewers** can see which posts have pending Observations (via the Review queue)
- **Subreddit moderators** can see the Reviewer list they configured
- **Reddit / Devvit platform** as the infrastructure operator, subject to Reddit's
  [Privacy Policy](https://www.reddit.com/policies/privacy-policy) and
  [Developer Terms](https://www.redditinc.com/policies/developer-terms)

No data is shared with any party outside of Reddit's platform.

## Data removal

Uninstalling ShadowMod from a subreddit removes the app's access. Data retained in Devvit Redis
after uninstall is subject to Reddit's platform data retention policies.

---

_Last updated: 2026-05-26. Questions? Open an issue on the
[GitHub repository](https://github.com/earlgreylabs/shadow-mod)._
