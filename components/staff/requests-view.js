'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '@/lib/domain/demo-availability';
import { courtNumber, customerOf, requestStatusLabels, bookingStatuses } from '@/lib/demo/staff';
import { dayLabel, rangeLabel, clubParts, instantLabel, kindLabels } from '@/lib/demo/staff-schedule';
import { cancellationView, rescheduleView, refundStageLabels } from '@/lib/demo/staff-requests';
import { StaffPageIntro, StatusPill, ConfirmBox } from './staff-page-intro';
import { useStaffDemo, SimulationNotice } from './staff-demo-context';

const statusTone = { pending: 'pending', approved: 'available', rejected: 'cancelled' };
const slot = (value) => `Court ${courtNumber(value.courtId)} · ${dayLabel(clubParts(value.startsAt).dateKey)} · ${rangeLabel(value.startsAt, value.endsAt)}`;

export function RequestsView() {
 const { data, dispatch } = useStaffDemo();
 const [selected, setSelected] = useState(null); // { kind: 'cancellation' | 'reschedule', id }
 const [confirming, setConfirming] = useState(false);
 const [focusTick, setFocusTick] = useState(0);
 const heading = useRef(null);
 useEffect(() => { if (focusTick) heading.current?.focus(); }, [focusTick]);
 const open = (kind, id) => { setSelected({ kind, id }); setConfirming(false); setFocusTick((tick) => tick + 1); };
 const cancellation = selected?.kind === 'cancellation' ? cancellationView(data.cancellations.find((request) => request.id === selected.id), data) : null;
 const reschedule = selected?.kind === 'reschedule' ? rescheduleView(data.reschedules.find((request) => request.id === selected.id), data) : null;
 const view = cancellation ?? reschedule;
 const decide = (decision) => {
  const { request, booking } = view;
  if (selected.kind === 'cancellation') dispatch({ type: 'cancellation', id: request.id, decision, message: decision === 'approved' ? `${request.id} approved in this preview. The booking shows as cancelled here only. ${request.refund.requested ? 'Refund approved; no payout was recorded and none is created automatically.' : 'No refund was requested.'}` : `${request.id} rejected in this preview. The booking stays ${bookingStatuses[booking.status].label.toLowerCase()}.` });
  else dispatch({ type: 'reschedule', id: request.id, decision, message: decision === 'approved' ? `${request.id} approved in this preview. The booking was not moved, the new slot was not reserved and the original agreement is unchanged.` : `${request.id} rejected in this preview. The booking keeps its original slot.` });
  setConfirming(false);
 };

 const requestTable = (kind, requests, caption) => <>
  <div className="staff-table-wrap" role="region" aria-label={`${caption} table`} tabIndex={0}>
   <table className="staff-table"><caption className="sr-only">{caption}</caption>
    <thead><tr><th scope="col">Request / customer</th><th scope="col">{kind === 'cancellation' ? 'Booking' : 'From → to'}</th><th scope="col">{kind === 'cancellation' ? 'Refund' : 'Sample availability'}</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
    <tbody>{requests.map((request) => { const v = kind === 'cancellation' ? cancellationView(request, data) : rescheduleView(request, data); return <tr key={request.id} aria-current={selected?.id === request.id ? 'true' : undefined}><th scope="row"><strong>{request.id}</strong><small>{customerOf(data, v.booking).name}</small></th><td>{kind === 'cancellation' ? slot(v.booking) : <>{slot(request.from)}<small>→ {slot(request.to)}</small></>}</td><td>{kind === 'cancellation' ? refundStageLabels[v.refundStage] : v.available ? 'No conflict' : `${v.conflicts.length} conflict`}</td><td><StatusPill tone={statusTone[request.status]}>{requestStatusLabels[request.status]}</StatusPill>{request.simulated && <small>Simulated</small>}</td><td><button type="button" className="text-link" onClick={() => open(kind, request.id)}>Review<span className="sr-only"> {request.id}</span></button></td></tr>; })}</tbody>
   </table>
  </div>
  <ul className="staff-cards" aria-label={`${caption} list`}>{requests.map((request) => { const v = kind === 'cancellation' ? cancellationView(request, data) : rescheduleView(request, data); return <li key={request.id} className="schedule-card"><h3>{request.id} · {customerOf(data, v.booking).name}</h3><dl><div><dt>{kind === 'cancellation' ? 'Booking' : 'From'}</dt><dd>{kind === 'cancellation' ? slot(v.booking) : slot(request.from)}</dd></div>{kind === 'reschedule' && <div><dt>To</dt><dd>{slot(request.to)}</dd></div>}<div><dt>{kind === 'cancellation' ? 'Refund' : 'Availability'}</dt><dd>{kind === 'cancellation' ? refundStageLabels[v.refundStage] : v.available ? 'No conflict (sample check)' : `${v.conflicts.length} conflict (sample check)`}</dd></div><div><dt>Status</dt><dd><StatusPill tone={statusTone[request.status]}>{requestStatusLabels[request.status]}</StatusPill></dd></div></dl><button type="button" className="button button-outline" onClick={() => open(kind, request.id)}>Review {request.id}</button></li>; })}</ul>
 </>;

 return <main id="main-content" className="dashboard-main">
  <StaffPageIntro crumb="Requests" eyebrow="CANCELLATIONS AND RESCHEDULING" title="Customer requests" description="Decisions here are local simulations. Cancellation, rescheduling, deadline and refund policies still need owner approval." />
  <div className="staff-split">
   <div className="staff-stack">
    <section className="dashboard-panel" aria-labelledby="cancellations-heading"><p className="eyebrow">CANCELLATION REQUESTS</p><h2 id="cancellations-heading">Cancellations</h2>{requestTable('cancellation', data.cancellations, 'Cancellation requests')}</section>
    <section className="dashboard-panel" aria-labelledby="reschedules-heading"><p className="eyebrow">RESCHEDULING REQUESTS</p><h2 id="reschedules-heading">Reschedules</h2>{requestTable('reschedule', data.reschedules, 'Rescheduling requests')}</section>
   </div>
   <section className="dashboard-panel staff-detail" aria-labelledby="request-detail-heading">
    <p className="eyebrow">REQUEST DETAIL</p>
    <h2 id="request-detail-heading" ref={heading} tabIndex={-1}>{view ? `${view.request.id} · ${selected.kind === 'cancellation' ? 'Cancellation' : 'Reschedule'}` : 'No request selected'}</h2>
    {!view ? <p className="booking-helper">Select a cancellation or rescheduling request to review it.</p> : <>
     <dl className="staff-dl"><div><dt>Status</dt><dd><StatusPill tone={statusTone[view.request.status]}>{requestStatusLabels[view.request.status]}</StatusPill>{view.request.simulated && <strong className="simulated-tag">Simulated</strong>}</dd></div><div><dt>Booking</dt><dd>{view.booking.reference}</dd></div><div><dt>Customer</dt><dd>{customerOf(data, view.booking).name}</dd></div><div><dt>Requested</dt><dd>{instantLabel(view.request.requestedAt)}</dd></div>{view.request.decidedAt && <div><dt>Decided</dt><dd>{instantLabel(view.request.decidedAt)}{view.request.simulated ? ' (simulated)' : ''}</dd></div>}</dl>
     {cancellation && <>
      <section className="detail-section" aria-labelledby="cr-booking"><h3 id="cr-booking">Booking and original agreement</h3><dl className="staff-dl"><div><dt>Court and schedule</dt><dd>{slot(cancellation.booking)}</dd></div><div><dt>Booking status</dt><dd><StatusPill tone={bookingStatuses[cancellation.booking.status].tone}>{bookingStatuses[cancellation.booking.status].label}</StatusPill></dd></div><div><dt>Original agreed total</dt><dd>{formatMoney(cancellation.booking.agreement.totalCentavos)} · fixed at creation</dd></div><div><dt>Initiated by</dt><dd>{cancellation.request.initiatedBy === 'club' ? 'The club' : 'The customer'}</dd></div><div><dt>Reason (fictional)</dt><dd>{cancellation.request.reason}</dd></div></dl></section>
      <section className="detail-section" aria-labelledby="cr-refund"><h3 id="cr-refund">Refund — three separate steps</h3><dl className="staff-dl refund-steps"><div><dt>1. Refund requested</dt><dd>{cancellation.refund.requested ? 'Yes' : 'No'}</dd></div><div><dt>2. Refund approved</dt><dd>{cancellation.refund.approved === true ? 'Yes' : cancellation.refund.approved === false ? 'No' : cancellation.refund.requested ? 'Not decided' : 'Not applicable'}</dd></div><div><dt>3. Refund completed</dt><dd>{cancellation.refund.payout ? `Yes — sample payout of ${formatMoney(cancellation.refund.payout.centavos)} recorded ${instantLabel(cancellation.refund.payout.recordedAt)}` : 'No payout recorded'}</dd></div><div><dt>Refund review may be needed</dt><dd>{cancellation.refundReviewMayBeNeeded ? `Yes — a verified (fictional) payment of ${formatMoney(cancellation.verifiedCentavos)} exists` : 'No verified payment exists'}</dd></div></dl>
       <p className="booking-helper">Approving a refund never records a payout; a payout is a separate, audited staff record. Refund rates and eligibility are owner decisions still pending, so no amount is calculated here.</p></section>
     </>}
     {reschedule && <section className="detail-section" aria-labelledby="rr-slots"><h3 id="rr-slots">Original and requested sessions</h3><dl className="staff-dl"><div><dt>Original</dt><dd>{slot(reschedule.request.from)}</dd></div><div><dt>Requested</dt><dd>{slot(reschedule.request.to)}</dd></div><div><dt>Original agreed total</dt><dd>{formatMoney(reschedule.booking.agreement.totalCentavos)} · unchanged by any reschedule</dd></div>{reschedule.request.note && <div><dt>Note (fictional)</dt><dd>{reschedule.request.note}</dd></div>}</dl>
      {reschedule.available ? <p className="review-ok"><CheckCircle2 size={18} aria-hidden="true" />Sample availability check: the requested slot has no conflict right now. Nothing has been reserved.</p> : <div className="conflict-warning"><AlertTriangle size={20} aria-hidden="true" /><div><strong>Sample availability check: {reschedule.conflicts.length} {reschedule.conflicts.length === 1 ? 'conflict' : 'conflicts'}.</strong><ul>{reschedule.conflicts.map((item) => <li key={item.id}>{kindLabels[item.kind]} · Court {courtNumber(item.courtId)} · {rangeLabel(item.startsAt, item.endsAt)} · {item.label}{item.kind === 'booking' ? ` (${item.title})` : ''}</li>)}</ul></div></div>}
      <p className="booking-helper">Client-side preview only. A real approval would have to re-check and move the booking in one database transaction (Phase 5B).</p></section>}
     {view.request.status === 'pending' ? <div className="detail-section"><h3>Simulate a decision (local demo only)</h3>
      <div className="payment-preview-actions">
       <button type="button" className="button button-outline" disabled={reschedule && !reschedule.available} aria-describedby={reschedule && !reschedule.available ? 'approve-reason' : undefined} onClick={() => (cancellation ? setConfirming(true) : decide('approved'))}>Simulate: approve {cancellation ? 'cancellation' : 'reschedule'}</button>
       <button type="button" className="button button-outline" onClick={() => decide('rejected')}>Simulate: reject {cancellation ? 'cancellation' : 'reschedule'}</button>
      </div>
      {reschedule && !reschedule.available && <p id="approve-reason" className="booking-helper">Approval is unavailable while the requested slot conflicts. This demo never overrides occupancy.</p>}
      {confirming && <ConfirmBox id="cancel-approve" prompt={`Simulate approving ${view.request.id}? The booking would show as cancelled in this tab only. ${view.request.refund.requested ? 'The refund would be approved with no payout recorded.' : ''}`} confirmLabel="Confirm simulated approval" cancelLabel="Go back" onConfirm={() => decide('approved')} onCancel={() => setConfirming(false)} />}
     </div> : <p className="booking-helper">This request is already {view.request.status}. No further decision is available.</p>}
     <SimulationNotice />
     <Link className="text-link" href={`/staff/bookings?ref=${view.booking.reference}`}>Open the booking record <ArrowRight size={15} aria-hidden="true" /></Link>
    </>}
   </section>
  </div>
 </main>;
}
