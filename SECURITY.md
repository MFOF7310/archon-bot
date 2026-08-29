# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| v3.x    | ✅ Active |
| v2.x    | ⚠️ Critical fixes only |
| < v2.0  | ❌ No longer supported |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in ARCHON CG-223, please report it privately:

- **Discord:** Join [Eagle Community](https://discord.gg/NFSMFJajp9) and DM `mfof7559`
- **GitHub:** Use [GitHub's private vulnerability reporting](https://github.com/MFOF7310/archon-bot/security/advisories/new)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your Discord tag or email for follow-up

You can expect an initial response within **48 hours**.

## Scope

The following are in scope:
- Token or credential exposure
- Authentication bypass on the dashboard
- Privilege escalation via bot commands
- SQL injection via user inputs
- Data leakage between guilds (IDOR)

The following are out of scope:
- Rate limiting / spam (handled by Discord)
- Third-party service outages (SoundCloud, YouTube, Telegram)
- Self-hosted deployment issues

## Disclosure Policy

We follow a responsible disclosure model. Once a fix is confirmed and deployed, we will acknowledge the reporter in the changelog unless they prefer to remain anonymous.

