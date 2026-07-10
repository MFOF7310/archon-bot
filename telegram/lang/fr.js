"use strict";
module.exports = {
    // General
    error: "❌ Quelque chose a mal tourné — réessaie!",
    owner_only: "⛔ Réservé au propriétaire uniquement!",
    admin_only: "⛔ Admins seulement, désolé!",
    groups_only: "⚠️ Cette commande ne fonctionne que dans les groupes!",
    no_db: "❌ Base de données non connectée.",

    // Welcome
    welcome_on: "👋 Messages de bienvenue activés!",
    welcome_off: "🔴 Messages de bienvenue désactivés.",
    welcome_set: "✅ Message de bienvenue mis à jour!",
    welcome_test: "👋 Aperçu:",
    welcome_default: [
        "Salut {name}! Bienvenue dans {group}! 🦅",
        "🎉 {name} vient de rejoindre — dites bonjour!",
        "Bienvenue {name}! Content de t'avoir ici 💪",
        "🚀 {name} est entré dans le chat!",
        "{name} a débarqué! Bienvenue dans {group} 🇲🇱",
    ],
    goodbye: "👋 {name} est parti. À bientôt!",

    // Filters
    filter_added: "✅ Filtre ajouté!",
    filter_removed: "✅ Filtre supprimé!",
    filter_not_found: "❌ Aucun filtre trouvé pour ce mot-clé.",
    filter_no_args: "💡 Usage: /filter <mot-clé> <réponse>",
    filter_admin_only: "⛔ Seuls les admins peuvent gérer les filtres.",

    // Moderation
    kick_success: "👢 {name} a été expulsé.",
    kick_no_reply: "💡 Réponds au message de quelqu'un pour l'expulser.",
    kick_failed: "❌ Impossible d'expulser — vérifie mes droits admin!",
    ban_success: "🔨 {name} a été banni.",
    ban_failed: "❌ Impossible de bannir — vérifie mes permissions!",
    unban_success: "✅ Utilisateur débanni — il peut rejoindre maintenant!",
    pin_success: "📌 Message épinglé!",
    pin_failed: "❌ Impossible d'épingler — assure-toi que je peux épingler!",
    mute_success: "🔇 {name} a été mis en sourdine pour {duration}.",
    warn_added: "⚠️ Avertissement {count}/3 pour {name}.",
    warn_banned: "🔨 {name} a eu 3 avertissements et a été banni!",

    // Media
    media_fetching_video: "🎬 Je récupère cette vidéo, un instant...",
    media_fetching_audio: "🎵 Extraction audio en cours...",
    media_fetching_ig: "📸 Je récupère ça depuis Instagram...",
    media_fetching_tw: "🐦 Téléchargement depuis X...",
    media_fetching_fb: "📘 Je récupère depuis Facebook...",
    media_failed_yt: "❌ YouTube fait des siennes — réessaie dans un moment!",
    media_failed_ig: "❌ Impossible de récupérer — compte privé? Les reels publics marchent mieux!",
    media_failed_tw: "❌ Ce tweet n'a pas de vidéo ou est protégé!",
    media_failed_fb: "❌ Vidéos publiques uniquement — les privées nécessitent une connexion!",
    media_failed_generic: "❌ Impossible de télécharger ça. Essaie un autre lien!",

    // Economy
    daily_claimed: "🎁 Récompense quotidienne réclamée! +{amount} crédits",
    daily_cooldown: "⏰ Déjà réclamé aujourd'hui! Reviens dans {time}.",
    balance_msg: "💰 Solde: {balance} crédits",

    // Games
    roll_result: "🎲 Tu as obtenu: {result}",
    coinflip_heads: "🪙 Face!",
    coinflip_tails: "🪙 Pile!",
};
