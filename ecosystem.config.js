module.exports = {
  apps: [{
    name: 'Architect-CG223',
    script: './index.js',
    cwd: '/root/cloud-gaming-223-digital-engine',
    node_args: '-r dotenv/config',
    env: { NODE_ENV: 'production' },
    watch: false,
    autorestart: true
  }]
};
