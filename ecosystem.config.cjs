module.exports = {
  apps: [
    {
      name: "Architect-CG223",
      script: "index.js",
      cwd: "/root/cloud-gaming-223-digital-engine",
      env_file: ".env",
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "archon-webhook",
      script: "webhook.js",
      cwd: "/root/cloud-gaming-223-digital-engine",
      env_file: ".env",
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "architect-dashboard",
      script: "dist/boot.js",
      cwd: "/opt/dashboard",
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
