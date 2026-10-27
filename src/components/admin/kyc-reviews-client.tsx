'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { ShieldCheck, IdCard, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';

type Item = { id: string; userId: string; email: string | null; publicId: string; documentType: string; status: string; createdAt: string };
type Submission = Item & {
  documentUrl: string | null; selfieUrl: string | null; reviewNote: string | null;
  evidenceSource: string; externalEvidenceReference: string | null;
};

export function KycReviewsClient() {
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApiQuery<{ items: Item[] }>('/api/v1/admin/kyc?status=' + status);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reason, setReason] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  const inspect = async (id: string) => {
    setOpening(id); setSelected(null); setReason(''); setAgeConfirmed(false); setMessage('');
    try {
      setSelected(await apiRequest<Submission>('/api/v1/admin/kyc/' + encodeURIComponent(id)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to open documents');
    } finally { setOpening(null); }
  };
  const decide = async (decision: 'verified' | 'rejected') => {
    if (!selected || busy || reason.trim().length < 8 || (decision === 'verified' && !ageConfirmed)) return;
    if (!window.confirm('Confirm ' + decision + ' for this identity submission?')) return;
    setBusy(true); setMessage('');
    try {
      await apiRequest('/api/v1/admin/kyc/' + selected.id, {
        method: 'POST',
        json: { decision, ageConfirmed: decision === 'verified' && ageConfirmed, reason: reason.trim() },
      });
      setMessage('Review saved and audit recorded.');
      setSelected(null);
      await reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Review failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-nova-line bg-nova-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck size={22} className="text-nova-gold" />
          <div className="flex-1">
            <h2 className="font-bold">Identity review queue</h2>
            <p className="text-xs nova-muted">Private documents. Only authorized reviewers may open 60-second download links. Age must be checked against the identity document.</p>
          </div>
          <select className="nova-input" value={status} onChange={(event) => { setStatus(event.target.value); setSelected(null); }}>
            <option value="pending">Pending</option>
            <option value="verified">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      {message ? <p role="status" className="rounded-xl border border-nova-line p-3 text-sm">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
      {loading ? <p className="text-sm nova-muted">Loading review requests…</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-nova-line bg-nova-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-nova-surface2 text-xs nova-muted">
            <tr><th className="p-3">Account</th><th className="p-3">Document</th><th className="p-3">Submitted</th><th className="p-3">Action</th></tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.id} className="border-t border-nova-line">
                <td className="p-3"><div className="font-semibold">{item.email ?? item.publicId}</div><Link className="text-xs text-nova-gold" href={'/admin/users/' + item.userId}>View user</Link></td>
                <td className="p-3">{item.documentType.replaceAll('_', ' ')}</td>
                <td className="p-3 text-xs">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="p-3"><button type="button" disabled={opening === item.id} className="nova-btn-primary text-xs"
                  onClick={() => void inspect(item.id)}>{opening === item.id ? 'Opening…' : 'Review'}</button></td>
              </tr>
            ))}
            {!loading && !data?.items?.length ? <tr><td colSpan={4} className="p-7 text-center text-sm nova-muted">No submissions in this queue.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {selected ? (
        <section className="rounded-2xl border border-nova-line bg-nova-surface p-5" aria-label="Identity submission review">
          <div className="mb-4 flex items-center gap-2"><IdCard className="text-nova-gold" size={22} /><h3 className="font-bold">Review {selected.publicId}</h3></div>
          <p className="mb-3 text-xs nova-muted">Open each document in a secure download. Verify identity, authenticity, legal age and other required checks before approving. A KYC approval does not override casino jurisdiction or operator launch controls.</p>
          <div className="mb-4 flex flex-wrap gap-3">
            {selected.documentUrl ? (
              <a className="nova-btn-primary inline-flex items-center gap-2 text-xs"
                target="_blank" rel="noopener noreferrer" href={selected.documentUrl}>
                <ExternalLink size={14} /> Download ID
              </a>
            ) : (
              <span className="text-xs nova-muted">
                Externally retained ID — no file uploaded to BetVima.
                {selected.externalEvidenceReference ? ' Custody reference: ' + selected.externalEvidenceReference : ''}
              </span>
            )}
            {selected.selfieUrl ? <a className="nova-btn-ghost inline-flex items-center gap-2 text-xs" target="_blank" rel="noopener noreferrer"
              href={selected.selfieUrl}><ExternalLink size={14} /> Download selfie</a> : null}
          </div>
          <label className="mb-3 block text-sm font-semibold">Review reason / decision record
            <textarea className="nova-input mt-1 w-full" rows={3} maxLength={500} minLength={8} value={reason}
              placeholder="Record what was checked and why the submission was approved/rejected."
              onChange={(event) => setReason(event.target.value)} />
          </label>
          {selected.status === 'pending' ? (
            <>
              <label className="mb-4 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
                I independently confirmed the user meets the legal gambling age from the supplied ID (and applicable requirements).
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="nova-btn-primary flex items-center gap-2 text-sm" type="button"
                  disabled={busy || reason.trim().length < 8 || !ageConfirmed} onClick={() => void decide('verified')}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve identity & age
                </button>
                <button className="nova-btn-ghost flex items-center gap-2 text-sm" type="button"
                  disabled={busy || reason.trim().length < 8} onClick={() => void decide('rejected')}>
                  <XCircle size={16} /> Reject with reason
                </button>
              </div>
            </>
          ) : <p className="text-sm nova-muted">Previously reviewed: {selected.status}. {selected.reviewNote ?? ''}</p>}
        </section>
      ) : null}
    </div>
  );
}
