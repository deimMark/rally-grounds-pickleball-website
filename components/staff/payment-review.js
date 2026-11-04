'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ShieldAlert, Image as ImageIcon, RotateCcw, XCircle, CheckCircle2 } from 'lucide-react';
import { DemoBadge } from '@/components/ui/demo-notice';
import { formatMoney } from '@/lib/domain/demo-availability';
import { paymentStates, paymentStateIds, verifiedRevenueCentavos, unverifiedClaimCentavos, methodLabel, formatManila } from '@/lib/demo/payment';

function StatePill({ state }) {
 const entry = paymentStates[state];
 return <span className={`status-pill payment-pill ${entry.tone}`}><i aria-hidden="true" />{entry.shortLabel ?? entry.label}</span>;
}

// Entirely local simulation. Decisions change React state only; nothing is written anywhere.
export function PaymentReview({ queue }) {
 const [items, setItems] = useState(queue);
 const [filter, setFilter] = useState('all');
 const [selectedId, setSelectedId] = useState(queue[1]?.id ?? queue[0]?.id);
 const [note, setNote] = useState('');
 const detailHeading = useRef(null);
 const visible = filter === 'all' ? items : items.filter((item) => item.state === filter);
 const selected = items.find((item) => item.id === selectedId);
 const verified = verifiedRevenueCentavos(items), unverified = unverifiedClaimCentavos(items);
 const pendingCount = items.filter((item) => item.state === 'pending_review').length;
 useEffect(() => { if (note) detailHeading.current?.focus(); }, [note]);
 function simulate(id, state, message) {
  setItems((list) => list.map((item) => (item.id === id ? { ...item, state } : item)));
  setNote(message);
 }
 function reset() { setItems(queue); setNote('Sample queue reset to its original scenarios.'); }
 const reviewable = selected && ['pending_review', 'needs_resubmission', 'verified'].includes(selected.state);
 return <>
  <section className="metrics-grid" aria-label="Synthetic payment review summary">
   <article className="metric-card"><div><span>Verified (fictional)</span></div><strong>{formatMoney(verified)}</strong><p>Only the fictional “verified” scenario counts</p><small>DEMO FIGURE</small></article>
   <article className="metric-card"><div><span>Unverified claims</span></div><strong>{formatMoney(unverified)}</strong><p>Pending and rejected receipts · excluded from verified revenue</p><small>DEMO FIGURE</small></article>
   <article className="metric-card"><div><span>Awaiting review</span></div><strong>{pendingCount}</strong><p>Submitted receipts not yet compared with account records</p><small>DEMO FIGURE</small></article>
  </section>
  <div className="dashboard-columns payment-columns">
   <section className="dashboard-panel" aria-labelledby="queue-heading">
    <div className="panel-heading"><div><p className="eyebrow">RECEIPT REVIEW</p><h2 id="queue-heading">Sample receipt queue</h2></div>
     <label className="filter-label">Show<select aria-label="Filter sample receipt queue" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All scenarios</option>{paymentStateIds.map((id) => <option key={id} value={id}>{paymentStates[id].shortLabel ?? paymentStates[id].label}</option>)}</select></label>
    </div>
    <div className="dashboard-notice payment-warning"><ShieldAlert size={20} aria-hidden="true" /><div><strong>A displayed receipt is not verified funds.</strong><p>Before any real decision, staff must compare the receipt with the club’s actual GCash or bank transaction records: matching recipient, actual received amount, settlement details and transaction reference. A screenshot alone is never sufficient.</p></div></div>
    <div className="schedule-table-wrapper" tabIndex={0} role="region" aria-label="Sample receipt queue table, scroll horizontally for more columns">
     <table><caption className="sr-only">Synthetic receipt review queue</caption><thead><tr><th scope="col">Reference / customer</th><th scope="col">Court and session</th><th scope="col">Claim</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
      <tbody>{visible.map((item) => <tr key={item.id} aria-current={item.id === selectedId ? 'true' : undefined}><th scope="row"><strong>{item.customer}</strong><small>{item.reference}</small></th><td>Court {item.court}<br /><small>{item.session}</small></td><td>{methodLabel(item.method)} · {formatMoney(item.claimedCentavos)}<br /><small>{item.transactionRef} (sample)</small></td><td>{item.submittedAt ? <>{formatManila(item.submittedAt)}<br /><small>Asia/Manila</small></> : '—'}</td><td><StatePill state={item.state} /></td><td><button type="button" className="text-link" onClick={() => { setSelectedId(item.id); setNote(`Opened ${item.customer}.`); }} aria-label={`Review ${item.customer}, ${item.reference}`}>Review</button></td></tr>)}</tbody>
     </table>
    </div>
    <ul className="schedule-cards" aria-label="Synthetic receipt queue cards">
     {visible.map((item) => <li key={item.id} className="schedule-card"><h3>{item.customer}</h3><dl><div><dt>Reference</dt><dd>{item.reference}</dd></div><div><dt>Court / session</dt><dd>Court {item.court} · {item.session}</dd></div><div><dt>Claim</dt><dd>{methodLabel(item.method)} · {formatMoney(item.claimedCentavos)} · {item.transactionRef} (sample)</dd></div><div><dt>Submitted</dt><dd>{item.submittedAt ? `${formatManila(item.submittedAt)} Asia/Manila` : 'No evidence yet'}</dd></div><div><dt>Status</dt><dd><StatePill state={item.state} /></dd></div></dl><button type="button" className="button button-outline" onClick={() => { setSelectedId(item.id); setNote(`Opened ${item.customer}.`); }}>Review {item.customer}</button></li>)}
    </ul>
    <p className="table-footnote" role="status">{visible.length} synthetic {visible.length === 1 ? 'claim' : 'claims'} · Read-only demonstration. No real review action is performed.</p>
   </section>

   <section className="dashboard-panel payment-detail" aria-labelledby="detail-heading">
    <p className="eyebrow">RECEIPT DETAIL</p>
    {selected ? <>
     <h2 id="detail-heading" ref={detailHeading} tabIndex={-1}>{selected.customer}</h2>
     <StatePill state={selected.state} />
     <dl className="booking-receipt payment-detail-list"><div><dt>Booking reference</dt><dd>{selected.reference}</dd></div><div><dt>Court / session</dt><dd>Court {selected.court}<br />{selected.session}</dd></div><div><dt>Claimed method</dt><dd>{methodLabel(selected.method)}</dd></div><div><dt>Claimed amount</dt><dd>{formatMoney(selected.claimedCentavos)}</dd></div><div><dt>Agreed sample total</dt><dd>{formatMoney(selected.agreedCentavos)}</dd></div><div><dt>Sample transaction reference</dt><dd>{selected.transactionRef}</dd></div><div><dt>Evidence submitted</dt><dd>{selected.submittedAt ? <>{formatManila(selected.submittedAt)} <span className="booking-tz">Asia/Manila</span></> : 'No evidence submitted'}</dd></div><div><dt>Verified money received</dt><dd>{selected.state === 'verified' ? `${formatMoney(selected.claimedCentavos)} (fictional)` : formatMoney(0)}</dd></div></dl>
     {selected.image ? <figure className="payment-preview staff-preview"><Image src={selected.image.src} alt={selected.image.alt} width={390} height={620} unoptimized /><figcaption>Sample receipt image · not verified funds · SAMPLE / NOT A REAL PAYMENT</figcaption></figure> : <p className="payment-empty"><ImageIcon size={16} aria-hidden="true" />No receipt image for this sample.</p>}
     <div className="booking-safe-note"><ShieldAlert size={19} aria-hidden="true" /><p>{paymentStates[selected.state].staff}</p></div>
     <div className="payment-simulation" role="group" aria-labelledby="simulation-heading"><h3 id="simulation-heading">Simulate a review decision (local demo only)</h3><p className="booking-helper">These buttons change this page’s sample data only. They do not record a payment, write a ledger entry, release a court or notify anyone.</p>
      <div className="payment-preview-actions">
       <button type="button" className="button button-outline" disabled={!reviewable || selected.state === 'needs_resubmission'} onClick={() => simulate(selected.id, 'needs_resubmission', `${selected.customer}: sample receipt marked rejected, needs resubmission. Verified revenue unchanged.`)}><XCircle size={16} aria-hidden="true" />Simulate: reject receipt</button>
       <button type="button" className="button button-outline" disabled={!reviewable || selected.state === 'verified'} onClick={() => simulate(selected.id, 'verified', `${selected.customer}: fictional verified scenario applied. In the real product this would require a matched incoming transaction.`)}><CheckCircle2 size={16} aria-hidden="true" />Simulate: verified (fictional)</button>
       <button type="button" className="text-link" onClick={reset}><RotateCcw size={14} aria-hidden="true" />Reset sample queue</button>
      </div>
      {!reviewable && <p className="booking-helper">{selected.state === 'expired' ? 'Expired sample: evidence received after expiry must not revive the reservation, so no decision is available.' : 'Nothing to review until a receipt is submitted.'}</p>}
     </div>
    </> : <p>No sample selected.</p>}
    <div role="status" aria-live="polite" className="payment-announcer">{note}</div>
   </section>
  </div>
  <p className="booking-helper payment-footnote"><DemoBadge>DEMONSTRATION ONLY</DemoBadge> Every customer, reference, amount, timestamp, image and outcome on this page is synthetic. No staff account is signed in and no ledger exists in this demo.</p>
 </>;
}
