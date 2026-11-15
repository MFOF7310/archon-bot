#!/bin/sh
# Creates the icons ARCHON's code asks for (lib/ui/icons.js) that config/emojis.js doesn't have yet.
# An icon that already exists is left alone. Then: pm2 restart Architect-CG223
#   sh scripts/missing-icons.sh
cd "$(dirname "$0")/.." || exit 1
M="python3 /root/icon-tmp/make_icon.py"
AMBER="#F0B232"; RED="#E74C3C"

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
make ic_toggle_off toggle-left "$RED"
make catFood tools-kitchen-2
make ic_language language "$AMBER"
make ic_world world
make ic_user user
make ic_clear eraser
make ic_status_ok circle-check "#23A55A"
make ic_status_warn alert-circle "$AMBER"
make ic_status_bad circle-x "$RED"
make ic_status_wait hourglass
make ic_moon moon "#7F77DD"
make ic_paw paw
make ic_car car
make ic_dice dice-5
make ic_coin coin "$AMBER"
make ic_hand hand-stop
make ic_builds list-details "#378ADD"
make ic_target target "#D85A30"
make ic_tool tool
make ic_edit pencil
make ic_trash trash "$RED"
make ic_chevron_left chevron-left
make ic_chevron_right chevron-right
make ic_swords swords
make ic_history history
make ic_flame flame "#D85A30"
make ic_win circle-check "#23A55A"
make ic_loss circle-x "$RED"
make ic_draw circle-minus "$AMBER"
make ic_share share
make ic_broadcast broadcast
make ic_users users
make ic_code code
make ic_link link
make ic_github brand-github
make ic_discord brand-discord "#5865F2"
echo "Done. Now run: pm2 restart Architect-CG223"
