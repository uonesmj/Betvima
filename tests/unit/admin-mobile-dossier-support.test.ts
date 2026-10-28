import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');
const dossier = read('src/app/api/v1/admin/mobile/user-overview/[id]/route.ts');
const timeline = read('src/app/api/v1/admin/mobile/user-bets/[id]/route.ts');
const casino = read('src/server/admin/casino-finance.ts');
const casinoApi = read('src/app/api/v1/admin/mobile/casino/route.ts');
const support = read('src/server/adapters/postgres/support.ts');
const photo = read('src/app/api/v1/admin/support/[id]/attachments/[attachmentId]/route.ts');
const campaign = read('src/app/api/v1/admin/notifications/route.ts');

describe('Native administration: grouped user dossier and privacy', () => {
 it('limits every bet lookup to one validated player with newest-first order', () => {
   expect(timeline).toContain("uuid.safeParse(id)");
   expect(timeline).toContain("withAdmin(request, ctx, 'bets.view')");
   expect(timeline).toContain("where b.user_id=$1");
   expect(timeline).toContain('order by b.placed_at desc,b.id desc');
   expect(timeline).toContain('where bl.bet_id=b.id');
   expect(timeline).toContain('where wt.bet_id=b.id');
   expect(timeline).toContain("wt.type::text='bet_debit'");
   expect(timeline).not.toContain('getUsdIrtRate');
 });
 it('returns casino stake, win, rollback separately and scoped to user', () => {
   expect(dossier).toContain('casinoFinance(services.db, id, null)');
   expect(casino).toContain("status = 'completed'");
   expect(casino).toContain('response_error = 0');
   expect(casino).toContain('ledger_transaction_id is not null');
   expect(casino).toContain("action = 'credit' and rollback = true");
   expect(casino).toContain('const site = stake - payout - refund');
   expect(casino).toContain('($1::uuid is null or user_id = $1)');
   expect(casino).not.toContain('getUsdIrtRate');
 });
 it('restores a read-only casino summary API with admin verification', () => {
   expect(casinoApi).toContain("withAdmin(request, ctx, 'reports.view')");
   expect(casinoApi).toContain('casinoFinance(services.db, null, since)');
 });
 it('does not label every support ticket unread=0, and secures signed media URLs', () => {
   const part=support.slice(support.indexOf('async listForAdmin'));
   expect(part).not.toContain('0::int as unread_messages');
   expect(part).toContain("pending.sender_role='user'");
   expect(part).toContain("answer.sender_role='support'");
   expect(photo).toContain("withAdmin(request, ctx, 'support.view')");
   expect(photo).toContain("searchParams.get('format') === 'json'");
   expect(photo).toContain('createSignedUrl(attachment.storagePath, 300)');
 });
 it('retains the existing permissioned personal/general notification API', () => {
   expect(campaign).toContain("'promo.manage'");
   expect(campaign).toContain("'personal'");
   expect(campaign).toContain("'general'");
   expect(campaign).toContain('targetUserId');
 });
});
