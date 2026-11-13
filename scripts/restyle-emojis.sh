#!/bin/sh
# Redoes ARCHON's old-style emojis as Tabler icons in ARCHON gold (from the list of scripts/emoji-audit.js).
#   sh scripts/restyle-emojis.sh            then: pm2 restart Architect-CG223
# Each line: emoji name in config/emojis.js, Tabler icon name (tabler.io/icons), optional colour.
# make_icon.py replaces an emoji that has the same name, so running this twice is safe.
# Left out on purpose: brand logos (Discord, YouTube, Spotify, WhatsApp, Instagram, Facebook, SoundCloud, game logos),
# the eagle and Bamako artwork, Discord-style badges, coloured dots and ping lights, shop badges, ic_ok, ic_bot, ic_alive.
# Green, red and amber stay for meaning: success, error or off, warning.

M="python3 /root/icon-tmp/make_icon.py"
GREEN="#2ECC71"; RED="#E74C3C"; AMBER="#F0B232"

run() { $M "$@" || echo "   (skipped $1)"; sleep 1; }

# marks
run small_check check "$GREEN"
run small_cross x "$RED"
run warning alert-triangle "$AMBER"
run ic_off circle-x "$RED"
run ic_on toggle-right "$GREEN"
run info info-circle
run ic_info info-circle
run note note

# server and members
run globe world
run dashboard layout-dashboard
run member user
run myprofile user-circle
run ic_profile user-circle
run welcome door-enter
run goodbye door-exit
run role id-badge-2
run staff user-shield
run rules clipboard-list
run ticket ticket
run ic_ticket ticket
run location map-pin
run home_1 home

# moderation
run shield shield
run ic_shield shield-lock
run automod shield-check
run timeout clock-pause
run mute volume-off
run ic_ban ban
run ic_trash trash
run ic_remove minus

# economy and progress
run invest trending-up
run xp sparkles
run charts chart-bar
run ic_chart chart-line
run progress progress
run trophy trophy
run crown crown
run streak flame
run milestones flag
run claim gift
run premium diamond
run vote arrow-big-up
run star star

# games
run gameController device-gamepad-2
run ic_gaming device-gamepad-2
run gamer device-gamepad
run duelist swords
run quizmaster school
run gameBlackjack cards
run gameSlots cherry
run duel_sword sword
run duel_bolt bolt
run duel_sniper crosshair
run duel_flame flame
run flash bolt

# music
run music music
run ic_music music
run livestream broadcast
run ic_live access-point "$RED"
run mc_pause player-pause
run mc_skip player-skip-forward
run mc_previous player-skip-back
run mc_stop player-stop
run mc_autoplay infinity
run mc_loop repeat
run mc_volume_down volume-2
run mc_volume_up volume
run mc_love_this heart
run mc_not_for_me thumb-down
run mc_queue playlist
run mc_folder folder

# tools and menus
run ai_assistant brain
run ic_satellite satellite
run ic_database database
run ic_utility tool
run ic_fun mood-happy
run ic_admin settings
run ic_config adjustments
run ic_add plus
run ic_back arrow-left
run ic_pin pin
run ic_calendar calendar

echo "Done. Now run: pm2 restart Architect-CG223"
