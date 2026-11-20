#!/bin/sh
# Creates the icons ARCHON's code asks for (lib/ui/icons.js) that config/emojis.js doesn't have yet.
# An icon that already exists is left alone. Then: pm2 restart Architect-CG223
#   sh scripts/missing-icons.sh
cd "$(dirname "$0")/.." || exit 1
M="python3 /root/icon-tmp/make_icon.py"
AMBER="#F0B232"; RED="#E74C3C"

# missing = no key, or a key that still holds a plain emoji instead of one of ARCHON's own (<:name:id>)
missing() { node -e "process.exit(/^<a?:\\w+:\\d+>$/.test(require('./config/emojis')['$1'] || '') ? 1 : 0)"; }
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
make ic_shield shield
make ic_heal heart-plus
make ic_bolt bolt "$AMBER"
make ic_shield_check shield-check "#23A55A"
make ic_user_check user-check "#23A55A"
make ic_user_x user-x "$RED"
make ic_brain brain "#D4537E"
make ic_puzzle puzzle "#378ADD"
# Roulette: black and green pockets, and the Double button
make rouletteBlack poker-chip "#9C9C9C"
make rouletteGreen poker-chip "#23A55A"
make rouletteDouble chevrons-up

# /global: wallet, leaderboard podium, network card, transfer confirmation
make ic_building building-community
make ic_server server
make ic_crown crown "$AMBER"
make ic_medal medal "#B4B2A9"
make ic_medal_2 medal-2 "#D85A30"
make ic_send send
make ic_check check
make ic_x x

# Asked for by lib/ui/icons.js but never made by this script (the verify keyboard showed as ⌨️)
make ic_enter keyboard
make ic_general message-circle
make ic_skip player-skip-forward
make ic_chart chart-bar
make ic_online circle-dot "#23A55A"
make ic_offline circle-dot "$RED"
make ic_bot robot
make ic_join gift
make ic_on toggle-right "#23A55A"
make ic_info info-circle "#378ADD"

# Ticket category icons (dashboard picker, lib/ticket-icons.js)
make ic_lifebuoy lifebuoy
make ic_bug bug
make ic_card credit-card
make ic_flag flag
make ic_help help-circle
make ic_handshake heart-handshake

# Setup reminder: a step not done yet
make ic_circle_dashed circle-dashed "#949BA4"

# /rules: gold numbered circles for the rules
make ic_num_1 circle-number-1 "$AMBER"
make ic_num_2 circle-number-2 "$AMBER"
make ic_num_3 circle-number-3 "$AMBER"
make ic_num_4 circle-number-4 "$AMBER"
make ic_num_5 circle-number-5 "$AMBER"
make ic_num_6 circle-number-6 "$AMBER"
make ic_num_7 circle-number-7 "$AMBER"
make ic_num_8 circle-number-8 "$AMBER"
make ic_num_9 circle-number-9 "$AMBER"
make ic_eye eye
make ic_calc calculator
make ic_qr qrcode
make ic_define vocabulary
make ic_search search
make ic_pin pin
make ic_voice microphone
make ic_gamepad device-gamepad-2
make ic_live broadcast "$RED"
make ic_video movie

# Every new icon goes to its category in config/emojis.js
node scripts/emojis-tidy.js
echo "Done. Now run: pm2 restart Architect-CG223"
