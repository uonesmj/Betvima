-- 0186 - IRR risk rules
-- Existing IRT/global rules remain unchanged.
BEGIN;

INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason, is_active)
SELECT 'global','min_stake',100000,'IRR','REJECT',1,'IRR platform minimum stake',true
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='min_stake' AND currency='IRR' AND is_active);

INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason, is_active)
SELECT 'global','max_stake',5000000000,'IRR','REJECT',1,'IRR platform maximum stake per bet',true
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='max_stake' AND currency='IRR' AND is_active);

INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason, is_active)
SELECT 'global','max_payout',20000000000,'IRR','REJECT',1,'IRR maximum potential payout per bet',true
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='max_payout' AND currency='IRR' AND is_active);

INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason, is_active)
SELECT 'global','max_daily_stake',10000000000,'IRR','LIMIT',2,'IRR daily stake cap per user',true
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='max_daily_stake' AND currency='IRR' AND is_active);

INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason, is_active)
SELECT 'global','max_daily_payout',50000000000,'IRR','LIMIT',2,'IRR daily payout cap per user',true
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='max_daily_payout' AND currency='IRR' AND is_active);

INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason, is_active)
SELECT 'global','max_live_stake',1000000000,'IRR','LIMIT',2,'IRR lower cap for in-play bets',true
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='max_live_stake' AND currency='IRR' AND is_active);

INSERT INTO nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason, is_active)
SELECT 'global','max_exposure',50000000000,'IRR','REJECT',3,'IRR maximum exposure',true
WHERE NOT EXISTS (SELECT 1 FROM nova.risk_rules WHERE scope='global' AND kind='max_exposure' AND currency='IRR' AND is_active);

COMMIT;
