module.exports = {
  apps: [
    {
      name: "nova",
      cwd: "/var/www/nova",
      script: "/var/www/nova/node_modules/next/dist/bin/next",
      args: "start -p 3000 --hostname 127.0.0.1",
      env: { NODE_ENV: "production" },
      env_file: "/var/www/nova/.env.production"
    },
    {
      name: "nova-odds-worker",
      cwd: "/var/www/nova",
      script: "/var/www/nova/scripts/run-odds-worker.sh",
      args: "",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      env_file: "/var/www/nova/.env.production"
    },
    {
      name: "nova-odds-live-worker",
      cwd: "/var/www/nova",
      script: "/var/www/nova/scripts/run-odds-live-worker.sh",
      args: "",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      env_file: "/var/www/nova/.env.production"
    },
    {
      name: "nova-worker-settlement",
      cwd: "/var/www/nova",
      script: "/var/www/nova/scripts/run-settlement-worker.sh",
      args: "",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      env_file: "/var/www/nova/.env.production"
    },
    {
      name: "nova-worker-affiliate",
      cwd: "/var/www/nova",
      script: "/var/www/nova/scripts/run-affiliate-worker.sh",
      args: "",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      env_file: "/var/www/nova/.env.production"
    },
    {
      name: "nova-worker-crypto-payout",
      cwd: "/var/www/nova",
      script: "/var/www/nova/scripts/run-crypto-payout-worker.sh",
      args: "",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      env_file: "/var/www/nova/.env.production"
    }
  ]
};
