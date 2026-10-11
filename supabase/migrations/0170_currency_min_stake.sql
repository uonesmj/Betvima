INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason)
SELECT 'global', 'min_stake', 10::bigint, 'USD', 'REJECT'::nova.risk_decision, 1, 'USD minimum stake $0.10'
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='min_stake' AND currency='USD' AND is_active);
INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason)
SELECT 'global', 'min_stake', 10::bigint, 'EUR', 'REJECT'::nova.risk_decision, 1, 'EUR minimum stake €0.10'
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='min_stake' AND currency='EUR' AND is_active);
INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason)
SELECT 'global', 'min_stake', 10::bigint, 'GBP', 'REJECT'::nova.risk_decision, 1, 'GBP minimum stake £0.10'
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='min_stake' AND currency='GBP' AND is_active);
