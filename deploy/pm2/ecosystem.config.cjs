/**
 * PM2 process definitions for NOVA SPORTSBOOK.
 *
 *   pm2 start deploy/pm2/ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup
 *
 * One web process (Next.js) and five workers. The workers are separate processes so a slow
 * settlement sweep can never delay a page render, and so each can be restarted on its own.
 *
 * Secrets are NOT stored here: PM2 reads the environment from the shell, a `.env.production`
 * file loaded by the deploy script, or a process manager secret store. `env_file` is left as a
 * comment on purpose so nobody is tempted to commit credentials.
 */
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

const commonEnv = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  // Workers and web must agree on the timezone used for settlement windows.
  TZ: process.env.TZ || 'Asia/Tehran',
};

module.exports = {
  apps: [
    {
      name: 'nova-web',
      cwd: root,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: process.env.NOVA_WEB_INSTANCES || 2,
      exec_mode: 'cluster',
      max_memory_restart: '900M',
      kill_timeout: 15000,
      listen_timeout: 15000,
      wait_ready: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      merge_logs: true,
      time: true,
      out_file: '/var/log/nova/web.out.log',
      error_file: '/var/log/nova/web.err.log',
      env: { ...commonEnv, PORT: 3000 },
    },
    {
      name: 'nova-worker-odds',
      cwd: root,
      script: 'node',
      args: '--import tsx src/workers/entrypoints/odds.worker.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      // A worker must never be duplicated per instance: the queue is safe, but running two
      // odds syncs would double provider calls.
      max_memory_restart: '512M',
      kill_timeout: 20000,
      time: true,
      out_file: '/var/log/nova/odds.out.log',
      error_file: '/var/log/nova/odds.err.log',
      env: { ...commonEnv, WORKER_ID: 'odds-1' },
    },
    {
      name: 'nova-worker-settlement',
      cwd: root,
      script: 'node',
      args: '--import tsx src/workers/entrypoints/settlement.worker.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 20000,
      time: true,
      out_file: '/var/log/nova/settlement.out.log',
      error_file: '/var/log/nova/settlement.err.log',
      env: { ...commonEnv, WORKER_ID: 'settlement-1' },
    },
    {
      name: 'nova-worker-affiliate',
      cwd: root,
      script: 'node',
      args: '--import tsx src/workers/entrypoints/affiliate.worker.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 20000,
      time: true,
      out_file: '/var/log/nova/affiliate.out.log',
      error_file: '/var/log/nova/affiliate.err.log',
      env: { ...commonEnv, WORKER_ID: 'affiliate-1' },
    },
    {
      name: 'nova-worker-crypto-payout',
      cwd: root,
      script: 'node',
      args: '--import tsx src/workers/entrypoints/crypto-payout.worker.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '384M',
      kill_timeout: 20000,
      time: true,
      out_file: './logs/crypto-payout.out.log',
      error_file: './logs/crypto-payout.err.log',
      env: { ...commonEnv, WORKER_ID: 'crypto-payout-1' },
    },
    {
      name: 'nova-worker-notification',
      cwd: root,
      script: 'node',
      args: '--import tsx src/workers/entrypoints/notification.worker.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '384M',
      kill_timeout: 15000,
      time: true,
      out_file: '/var/log/nova/notification.out.log',
      error_file: '/var/log/nova/notification.err.log',
      env: { ...commonEnv, WORKER_ID: 'notification-1' },
    },
  ],
};
