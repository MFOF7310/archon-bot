# Conventions

## Langues (i18n)
- Tout texte visible par l'utilisateur va dans `lang/<locale>/<plugin>.json`, jamais en dur dans le plugin.
- Le plugin résout sa langue lui-même : `client.detectLanguage('<commande>', guildId)`.
- Accès : `i18n.t('<plugin>.<clé>', lang, { vars })` — les variables s'écrivent `{nom}` dans le JSON.
- EN et FR sont remplis ; BM/ZH/AR peuvent rester à `""`, ils retombent sur EN.
- Les emojis de `config/emojis.js` restent dans le code, pas dans les JSON.
- Pluriels : deux clés (`xxxOne` / `xxxMany`), pas de `{plural}`.
- Ton : dire quoi faire ensuite, pas constater l'échec.

## Déploiement
- `git status --short` avant chaque push : le webhook pull dans ce même dossier.
- Vérifier la notif Telegram « Deploy success » après chaque push.
