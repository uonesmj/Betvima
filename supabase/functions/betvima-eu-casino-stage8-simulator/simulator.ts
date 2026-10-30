/**
 * Stage8 finance simulation: isolated BigInt in-memory model.
 * NO provider callbacks, no SQL writes, no player identities or wallet access.
 */
type Movement = { key: string; action: 'debit'|'credit'|'refund'|'reversal'; amount: bigint; target: string|null; after: bigint };
type Simulation = { passed: boolean; total: number; scenario_ids: string[]; balance_after_minor: string; ledger_count: number };
export function runStage8SyntheticFinance(): Simulation {
  let balance=1000n;
  const ledger=new Map<string,Movement>();
  const rolledTargets=new Set<string>();
  let checks=0;
  const names:string[]=[];
  const assert=(name:string,yes:boolean):void=>{
    if(!yes)throw new Error('SYNTHETIC_FAILURE_'+name);
    checks++;names.push(name);
  };
  const post=(key:string,action:Movement['action'],amount:bigint,target:string|null=null):Movement=>{
    if(!/^[a-z0-9-]{4,60}$/.test(key)||amount===0n)throw new Error('INVALID_SYNTHETIC_MOVEMENT');
    const prior=ledger.get(key);
    if(prior){
      if(prior.action!==action||prior.amount!==amount||prior.target!==target)throw new Error('CONFLICTING_IDEMPOTENCY_REPLAY');
      return prior;
    }
    if(action==='debit'&&amount>=0n||action==='credit'&&amount<=0n||action==='refund'&&amount<=0n||action==='reversal'&&amount>=0n)throw new Error('INVALID_SIGNED_AMOUNT');
    if(action==='refund'||action==='reversal'){
      const source=target?ledger.get(target):undefined;
      const expected=action==='refund'?'debit':'credit';
      if(!source||source.action!==expected||source.amount!==-amount||rolledTargets.has(target!))throw new Error('INVALID_ROLLBACK_TARGET');
      rolledTargets.add(target!);
    }else if(target)throw new Error('UNEXPECTED_ROLLBACK_TARGET');
    if(balance+amount<0n)throw new Error('INSUFFICIENT_BALANCE');
    balance+=amount;
    const movement={key,action,amount,target,after:balance};
    ledger.set(key,movement);
    return movement;
  };
  const rejects=(fn:()=>unknown):boolean=>{try{fn();return false}catch{return true;}};
  assert('seed',balance===1000n&&ledger.size===0);
  assert('debit',post('debit-1','debit',-25n).after===975n);
  assert('duplicate_debit_idempotent',post('debit-1','debit',-25n).after===975n&&ledger.size===1);
  assert('replay_conflicting_payload_rejected',rejects(()=>post('debit-1','debit',-26n)));
  assert('win_credit',post('credit-1','credit',40n).after===1015n);
  assert('refund_debit',post('refund-1','refund',25n,'debit-1').after===1040n);
  assert('refund_idempotent',post('refund-1','refund',25n,'debit-1').after===1040n);
  assert('duplicate_refund_target_rejected',rejects(()=>post('refund-2','refund',25n,'debit-1')));
  assert('reverse_win',post('reverse-1','reversal',-40n,'credit-1').after===1000n);
  assert('reverse_win_idempotent',post('reverse-1','reversal',-40n,'credit-1').after===1000n);
  assert('duplicate_reverse_target_rejected',rejects(()=>post('reverse-2','reversal',-40n,'credit-1')));
  assert('negative_balance_rejected',rejects(()=>post('debit-overdraft','debit',-1001n)));
  assert('missing_target_rejected',rejects(()=>post('refund-invalid','refund',25n,'missing-id')));
  assert('wrong_original_amount_rejected',rejects(()=>post('reversal-wrong','reversal',-41n,'credit-1')));
  assert('zero_movement_rejected',rejects(()=>post('zero','debit',0n)));
  assert('ledger_reconciled',[...ledger.values()].reduce((s,r)=>s+r.amount,1000n)===balance&&balance===1000n&&ledger.size===4);
  return{passed:true,total:checks,scenario_ids:names,balance_after_minor:balance.toString(),ledger_count:ledger.size};
}
