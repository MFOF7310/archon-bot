module.exports = {
  apps: [
    {
      name: "Architect-CG223",
      script: "index.js",
      cwd: "/root/cloud-gaming-223-digital-engine",
      env_file: ".env",
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
}
