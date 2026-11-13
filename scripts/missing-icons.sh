#!/bin/sh
# Creates the icons ARCHON's code asks for (lib/ui/icons.js) that config/emojis.js doesn't have yet.
# An icon that already exists is left alone. Then: pm2 restart Architect-CG223
#   sh scripts/missing-icons.sh
cd "$(dirname "$0")/.." || exit 1
M="python3 /root/icon-tmp/make_icon.py"
AMBER="#F0B232"

missing() { node -e "process.exit(require('./config/emojis')['$1'] ? 1 : 0)"; }
make() { if missing "$1"; then $M "$@" || echo "   (skipped $1)"; sleep 1; else echo "·  $1 already there"; fi; }

make ic_warn alert-triangle "$AMBER"
make clock clock
make lock lock
make ic_gift gift
make ic_file file-text
make ic_shop shopping-cart
make ic_bag backpack
make ic_refresh refresh
make ic_bell bell
make ic_bell_off bell-off
make ic_folder folder

make ic_palette palette
make ic_dashboard layout-dashboard
make ic_back arrow-left
make ic_hash hash
make ic_door_enter door-enter
make ic_door_exit door-exit
make ic_rules book
make ic_gavel gavel
make ic_log list-details
make ic_ticket ticket
make ic_daily calendar-event
make ic_levelup trending-up
make ic_updates speakerphone
make ic_next arrow-right
make ic_category category
make ic_games device-gamepad-2
echo "Done. Now run: pm2 restart Architect-CG223"
