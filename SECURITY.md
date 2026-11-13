# Security policy

## Supported versions

Only the current release line gets security fixes. The live bot always runs the latest commit on `main`.

| Version | Supported |
|---|---|
| 3.3.x | Yes |
| 3.2.x and older | No, update to the latest `main` |

## Reporting a problem

**Please don't open a public GitHub issue for a security problem.** Report it privately instead:

- **GitHub:** [private vulnerability report](https://github.com/MFOF7310/archon-bot/security/advisories/new) (preferred)
- **Discord:** join the [Eagle Community](https://discord.gg/NFSMFJajp9) and send a DM to `mfof7559`

Please include:

- what the problem is and where it is
- the steps to reproduce it
- what an attacker could do with it
- how to reach you for follow-up

You'll get a first answer within **48 hours**.

## What counts

**In scope**

- Bot tokens, API keys or other secrets exposed
- Getting into the dashboard or its API without the right Discord permissions
- A member using bot commands, buttons or Lydia to do something only admins should do
- Reading or changing another server's data (settings, credits, tickets, logs)
- SQL injection or code execution through anything a member can type
- Credits or Premium obtained without paying

**Out of scope**

- Spam or rate limits that Discord already handles
- Outages of third-party services (YouTube, TikTok, Top.gg, AI providers)
- Problems that only exist in your own self-hosted copy because of its setup

## After a report

1. We confirm the problem and fix it on `main`, which deploys within minutes.
2. We tell you once it's live.
3. With your agreement, we credit you in the GitHub security advisory. Release notes shown in Discord never contain security details.
