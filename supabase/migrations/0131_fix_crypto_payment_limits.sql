update nova.payment_methods
set
  min_amount_minor = 500,
  max_amount_minor = 500000000,
  is_enabled = true,
  unavailable_reason = null,
  updated_at = now()
where id = 'crypto_usdt';
