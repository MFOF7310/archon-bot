module.exports = {
  apps: [
    {
      name: "Architect-CG223",
      script: "index.js",
      cwd: "/root/cloud-gaming-223-digital-engine",
      env: { PORT: 5000 },
      restart_delay: 3000,
      max_restarts: 10,
      // time to save before PM2 forces the stop (default 1.6 s): the shutdown writes the pending XP/credits and
      // closes the database; cut short, data is lost and the next start reports a crash
      kill_timeout: 10000
    },
    {
      name: "archon-webhook",
      script: "webhook.js",
      cwd: "/root/cloud-gaming-223-digital-engine",
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "architect-dashboard",
      script: "dist/boot.js",
      cwd: "/opt/dashboard",
      env: { PORT: 3000 },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "levanter",
      script: "index.js",
      cwd: "/root/levanter",
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "openclaw-gateway",
      script: "/root/start-openclaw.sh",
      cwd: "/root",
      interpreter: "bash",
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
}
