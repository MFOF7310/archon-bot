module.exports = {
  apps: [{
    name: 'Architect-CG223',
    script: 'index.js',
    watch: false,
    autorestart: true,
    max_restarts: 20,           // Plus tolérant pour Starlink
    min_uptime: '30s',           // Évite les boucles de restart
    max_memory_restart: '500M',
    restart_delay: 10000,        // 10s entre les restarts
    env: {
      NODE_ENV: 'production',
      TZ: 'Africa/Bamako'        // Timezone Mali 🇲🇱
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_file: './logs/combined.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Surveillance de la connexion
    kill_timeout: 10000,
    listen_timeout: 30000,
    // Hook pour vérifier la connexion avant restart
    wait_ready: true
  }]
};