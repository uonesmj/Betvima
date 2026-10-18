import { describe, expect, it } from 'vitest';
import { compareBet365PreviewPrice } from '../../src/providers/betsapi-price-change-preview';
import type { Bet365Catalogue } from '../../src/providers/betsapi-bet365-catalogue';
const catalogue: Bet365Catalogue = {
 fi:'12345', mode:'live', readOnly:true, marketCount:1, selectionCount:1,
 markets:[{id:'bet365:12345:90',name:'Goals Odd/Even',mode:'live',settlementCandidate:'GOALS_ODD_EVEN',status:'open',
 selections:[{id:'bet365:12345:90:1',name:'Odd',odds:'1.95',status:'open',line:null,selectionCandidate:'ODD'}]}],
};
describe('Bet365 read-only odds-change decision', () => {
 it('requires explicit acceptance on any difference', () => {
  expect(compareBet365PreviewPrice(catalogue,'bet365:12345:90','bet365:12345:90:1','2.00')).toMatchObject({
   state:'changed_requires_acceptance',currentOdds:'1.95',executable:false
  });
 });
 it('identifies unchanged price but never permits wagering', () => {
  expect(compareBet365PreviewPrice(catalogue,'bet365:12345:90','bet365:12345:90:1','1.9500')).toMatchObject({
   state:'unchanged',executable:false
  });
 });
 it('rejects suspended selection', () => {
  const suspended = {...catalogue,markets:[{...catalogue.markets[0]!,status:'suspended' as const}]};
  expect(compareBet365PreviewPrice(suspended,'bet365:12345:90','bet365:12345:90:1','1.95').state).toBe('unavailable');
 });
 it('rejects wrong FI and nonexistent selections', () => {
  expect(compareBet365PreviewPrice(catalogue,'bet365:777:90','bet365:777:90:1','1.95').reason).toBe('IDENTITY_UNVERIFIED');
  expect(compareBet365PreviewPrice(catalogue,'bet365:12345:90','bet365:12345:90:2','1.95').reason).toBe('SELECTION_MISSING');
 });
 it('rejects malformed and unavailable prices', () => {
  expect(compareBet365PreviewPrice(catalogue,'bet365:12345:90','bet365:12345:90:1','0/0').state).toBe('unavailable');
 });
});
