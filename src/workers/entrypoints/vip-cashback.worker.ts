/** Scheduled one-shot VIP cashback worker, separate from Next.js web process. */
process.env.NOVA_VIP_CASHBACK_ENTRYPOINT = 'true';
void import('../vip-cashback.worker');
