# i18n Migration Backlog

> Last updated: Sep 9, 2026
> Status: 13/124 plugins migrated to t() system
> Remaining: 36 plugins with inline ternaries

## High Priority — migrate first (Kimi session 1)
- daily.js
- claim.js
- level.js
- help.js
- duel.js
- transfer.js
- reminder.js
- warn.js

## Medium Priority — migrate second (Kimi session 2)
- server.js
- stats.js
- botstats-cmd.js
- poll.js
- birthday.js
- countdown.js
- serversettings.js
- setup.js

## Low Priority — admin/niche (Kimi session 3)
- reboot.js
- slash.js
- trt.js
- hacker.js
- loadout.js
- myroles.js
- pin.js
- slowmode.js
- setprefix.js
- about.js
- avatar.js
- cross-economy.js
- customrole.js
- image.js
- invite.js
- loadout.js
- mute.js
- ping.js
- quote.js
- socials.js
- timer.js

## Instructions for Kimi
1. Do high priority group first — one file at a time
2. Each file: find inline ternaries → add keys to existing translations object or create namespace → wire to t()
3. node --check after each file
4. Batch commit per group, not per file
5. Follow guild setting as lang source — never interaction.locale
