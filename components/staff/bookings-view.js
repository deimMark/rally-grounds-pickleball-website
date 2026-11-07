'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { formatMoney } from '@/lib/domain/demo-availability';
import { staffCourts, courtNumber, bookingStatuses, bookingStatusIds, paymentStateOf, paymentStateLabel, evidenceLabels, verificationLabels, bookingActions, customerOf, staffClock } from '@/lib/demo/staff';
import { paymentStates, paymentStateIds, methodLabel } from '@/lib/demo/payment';
import { dayLabel, rangeLabel, durationLabel, clubParts, instantLabel } from '@/lib/demo/staff-schedule';
import { bookingTimeline } from '@/lib/demo/staff-customers';
import { requestsForBooking, refundStage, refundStageLabels } from '@/lib/demo/staff-requests';
import { StaffPageIntro, StatusPill, ConfirmBox } from './staff-page-intro';
import { useStaffDemo, SimulationNotice } from './staff-demo-context';

const shortEvidence = { none: 'None', submitted: 'Submitted', rejected: 'Rejected' };
const paymentTone = (state) => paymentStates[state].tone === 'verified' ? 'available' : paymentStates[state].tone === 'neutral' ? 'completed' : paymentStates[state].tone;

export function BookingsView({ initialRef = null }) {
 const { data, dispatch } = useStaffDemo();
 const [query, setQuery] = useState('');
 const [status, setStatus] = useState('all');
 const [payment, setPayment] = useState('all');
 const [court, setCourt] = useState('all');
 const [selectedRef, setSelectedRef] = useState(() => (data.bookings.some((entry) => entry.reference === initialRef) ? initialRef : null));
 const [confirming, setConfirming] = useState(null);
 const [focusTick, setFocusTick] = useState(0);
 const detailHeading = useRef(null);
 useEffect(() => { if (focusTick) detailHeading.current?.focus(); }, [focusTick]);
 const needle = query.trim().toLowerCase();
 const rows = useMemo(() => data.bookings.filter((entry) => (status === 'all' || entry.status === status) && (payment === 'all' || paymentStateOf(entry) === payment) && (court === 'all' || entry.courtId === court) && (!needle || entry.reference.includes(needle) || customerOf(data, entry).name.toLowerCase().includes(needle))).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)), [data, status, payment, court, needle]);
 const selected = data.bookings.find((entry) => entry.reference === selectedRef);
 const open = (reference) => { setSelectedRef(reference); setConfirming(null); setFocusTick((tick) => tick + 1); };
 function run(action) {
  dispatch({ type: 'booking-status', reference: selected.reference, status: action.to, message: `${customerOf(data, selected).name}, Court ${courtNumber(selected.courtId)} ${dayLabel(clubParts(selected.startsAt).dateKey)}: shown as “${bookingStatuses[action.to].label}”. The original agreement and payment records are unchanged.` });
  setConfirming(null);
 }
 const requests = selected ? requestsForBooking(data, selected.reference) : null;
 const pState = selected ? paymentStateOf(selected) : null;

 return <main id="main-content" className="dashboard-main">
  <StaffPageIntro crumb="Bookings" eyebrow="BOOKING MANAGEMENT" title="Sample bookings" description="Booking status, payment evidence and payment verification are tracked separately. A receipt alone never confirms a booking." />
  <div className="staff-split">
   <section className="dashboard-panel" aria-labelledby="bookings-heading">
    <div className="panel-heading"><div><p className="eyebrow">ALL SAMPLE BOOKINGS</p><h2 id="bookings-heading">Bookings</h2></div></div>
    <div className="staff-control-row">
     <label className="filter-label grow">Search by reference or customer name<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. 302 or Customer B" /></label>
     <label className="filter-label">Booking status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{bookingStatusIds.map((id) => <option key={id} value={id}>{bookingStatuses[id].label}</option>)}</select></label>
     <label className="filter-label">Payment<select value={payment} onChange={(e) => setPayment(e.target.value)}><option value="all">All payment states</option>{paymentStateIds.map((id) => <option key={id} value={id}>{paymentStateLabel(id)}</option>)}</select></label>
     <label className="filter-label">Court<select value={court} onChange={(e) => setCourt(e.target.value)}><option value="all">All courts</option>{staffCourts.map((entry) => <option key={entry.id} value={entry.id}>Court {entry.number}</option>)}</select></label>
    </div>
    <p className="table-footnote" role="status">{rows.length} of {data.bookings.length} sample bookings shown</p>
    {rows.length === 0 ? <p className="staff-empty">No sample bookings match. Clear the search or choose different filters.</p> : <>
     <div className="staff-table-wrap" role="region" aria-label="Sample bookings table" tabIndex={0}>
      <table className="staff-table"><caption className="sr-only">Sample bookings in start order</caption>
       <thead><tr><th scope="col">Reference / customer</th><th scope="col">Court and session</th><th scope="col">Players</th><th scope="col">Agreed total</th><th scope="col">Booking status</th><th scope="col">Evidence · verification</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
       <tbody>{rows.map((entry) => <tr key={entry.reference} aria-current={entry.reference === selectedRef ? 'true' : undefined}><th scope="row"><strong>{customerOf(data, entry).name}</strong><small className="ref-code">{entry.reference}</small></th><td>Court {courtNumber(entry.courtId)}<small>{dayLabel(clubParts(entry.startsAt).dateKey)} · {rangeLabel(entry.startsAt, entry.endsAt)} · {durationLabel(entry.durationMinutes)}</small></td><td>{entry.players}</td><td>{formatMoney(entry.agreement.totalCentavos)}</td><td><StatusPill tone={bookingStatuses[entry.status].tone}>{bookingStatuses[entry.status].label}</StatusPill>{entry.simulated && <small>Simulated</small>}</td><td>{shortEvidence[entry.payment.evidence]}<small>{entry.payment.verification === 'verified_fictional' ? 'Verified (fictional)' : 'Not verified'}</small></td><td><button type="button" className="text-link" onClick={() => open(entry.reference)}>View<span className="sr-only"> booking {entry.reference}, {customerOf(data, entry).name}</span></button></td></tr>)}</tbody>
      </table>
     </div>
     <ul className="staff-cards" aria-label="Sample bookings list">{rows.map((entry) => <li key={entry.reference} className="schedule-card"><h3>{customerOf(data, entry).name}</h3><dl><div><dt>Reference</dt><dd>{entry.reference}</dd></div><div><dt>Court / session</dt><dd>Court {courtNumber(entry.courtId)} · {dayLabel(clubParts(entry.startsAt).dateKey)} · {rangeLabel(entry.startsAt, entry.endsAt)}</dd></div><div><dt>Duration · players</dt><dd>{durationLabel(entry.durationMinutes)} · {entry.players} players</dd></div><div><dt>Agreed total</dt><dd>{formatMoney(entry.agreement.totalCentavos)}</dd></div><div><dt>Booking status</dt><dd><StatusPill tone={bookingStatuses[entry.status].tone}>{bookingStatuses[entry.status].label}</StatusPill></dd></div><div><dt>Payment</dt><dd>{paymentStateLabel(paymentStateOf(entry))}</dd></div></dl><button type="button" className="button button-outline" onClick={() => open(entry.reference)}>View booking<span className="sr-only"> {entry.reference}, {customerOf(data, entry).name}</span></button></li>)}</ul>
    </>}
   </section>

   <section className="dashboard-panel staff-detail" aria-labelledby="booking-detail-heading">
    <p className="eyebrow">BOOKING DETAIL</p>
    <h2 id="booking-detail-heading" ref={detailHeading} tabIndex={-1}>{selected ? `${customerOf(data, selected).name} · Court ${courtNumber(selected.courtId)}` : 'No booking selected'}</h2>
    {!selected ? <p className="booking-helper">Select a booking to see its customer, session, original agreement, status, payment evidence, verification history and requests.</p> : <>
     <section className="detail-section" aria-labelledby="bd-1"><h3 id="bd-1">1. Customer and booking reference</h3><dl className="staff-dl"><div><dt>Booking reference</dt><dd>{selected.reference}</dd></div><div><dt>Customer</dt><dd>{customerOf(data, selected).name} · {customerOf(data, selected).reference}</dd></div><div><dt>Contact (synthetic)</dt><dd>{customerOf(data, selected).contact.value}</dd></div></dl></section>
     <section className="detail-section" aria-labelledby="bd-2"><h3 id="bd-2">2. Court and session</h3><dl className="staff-dl"><div><dt>Court</dt><dd>Court {courtNumber(selected.courtId)}</dd></div><div><dt>Date</dt><dd>{dayLabel(clubParts(selected.startsAt).dateKey, true)}</dd></div><div><dt>Time (Asia/Manila)</dt><dd>{rangeLabel(selected.startsAt, selected.endsAt)} · {durationLabel(selected.durationMinutes)}</dd></div><div><dt>Estimated players</dt><dd>{selected.players}</dd></div></dl></section>
     <section className="detail-section" aria-labelledby="bd-3"><h3 id="bd-3">3. Original agreement</h3><dl className="staff-dl"><div><dt>Agreed total</dt><dd>{formatMoney(selected.agreement.totalCentavos)}</dd></div><div><dt>Rate at booking</dt><dd>{formatMoney(selected.agreement.rateCentavos)} per hour (illustrative)</dd></div><div><dt>Created</dt><dd>{instantLabel(selected.createdAt)}</dd></div><div><dt>Terms version</dt><dd>{selected.agreement.termsVersion} (sample)</dd></div></dl><p className="booking-helper">Fixed at creation. Status changes, requests and simulations never rewrite it.</p></section>
     <section className="detail-section" aria-labelledby="bd-4"><h3 id="bd-4">4. Current booking status</h3><p><StatusPill tone={bookingStatuses[selected.status].tone}>{bookingStatuses[selected.status].label}</StatusPill>{selected.simulated && <strong className="simulated-tag">Simulated</strong>}</p><p className="booking-helper">{bookingStatuses[selected.status].description}</p>
      {bookingActions(selected).length > 0 ? <div className="payment-preview-actions">{bookingActions(selected).map((action) => <button key={action.id} type="button" className="button button-outline" disabled={action.disabled} aria-describedby={action.reason ? `reason-${action.id}` : undefined} onClick={() => (action.confirm ? setConfirming(action) : run(action))}>{action.label}</button>)}</div> : <p className="booking-helper">No simulated status change is available. {selected.status === 'expired' ? 'An expired hold cannot be revived by evidence or by staff in this demo.' : 'This booking is already closed.'}</p>}
      {bookingActions(selected).filter((action) => action.reason).map((action) => <p key={action.id} id={`reason-${action.id}`} className="booking-helper">{action.reason}</p>)}
      {!['confirmed', 'completed'].includes(selected.status) && <p className="booking-helper">Confirmation follows a payment verified against the club’s account records. A receipt alone cannot confirm a booking, so no “confirm” action exists here.</p>}
      {confirming && <ConfirmBox id="booking-confirm" prompt={`Simulate cancelling this sample booking? The court would show as free in this tab only. No booking, payment or customer is changed${pState === 'verified' ? ', and no refund is created' : ''}.`} confirmLabel="Confirm simulated cancellation" cancelLabel="Keep booking" onConfirm={() => run(confirming)} onCancel={() => setConfirming(null)} />}
      <SimulationNotice />
     </section>
     <section className="detail-section" aria-labelledby="bd-5"><h3 id="bd-5">5. Payment evidence</h3><dl className="staff-dl"><div><dt>Payment state</dt><dd><StatusPill tone={paymentTone(pState)}>{paymentStateLabel(pState)}</StatusPill></dd></div><div><dt>Evidence</dt><dd>{evidenceLabels[selected.payment.evidence]}</dd></div><div><dt>Verification</dt><dd>{verificationLabels[selected.payment.verification]}</dd></div><div><dt>Method · reference</dt><dd>{methodLabel(selected.payment.method)} · {selected.payment.transactionRef ?? 'none'}{selected.payment.transactionRef ? ' (sample)' : ''}</dd></div><div><dt>Verified money received</dt><dd>{pState === 'verified' ? `${formatMoney(selected.agreement.totalCentavos)} (fictional)` : formatMoney(0)}</dd></div></dl>
      <p className="booking-helper">Uploaded evidence is a claim. Only independently verified funds count, and every verified example here is fictional.</p>{selected.inPaymentQueue && <Link className="text-link" href="/staff/payments-demo">Open in receipt review <ArrowRight size={15} aria-hidden="true" /></Link>}</section>
     <section className="detail-section" aria-labelledby="bd-6"><h3 id="bd-6">6. Verification history</h3><ol className="timeline">{bookingTimeline(data, selected).map((event, index) => <li key={index}><span>{event.when}</span>{event.label}</li>)}</ol></section>
     <section className="detail-section" aria-labelledby="bd-7"><h3 id="bd-7">7. Cancellation and rescheduling requests</h3>{requests.cancellations.length + requests.reschedules.length === 0 ? <p className="booking-helper">No requests for this booking.</p> : <ul className="request-mini">{requests.cancellations.map((request) => <li key={request.id}>{request.id} · Cancellation · <strong>{request.status}</strong>{request.simulated ? ' (simulated)' : ''} · {refundStageLabels[refundStage(request.refund)]}</li>)}{requests.reschedules.map((request) => <li key={request.id}>{request.id} · Reschedule to Court {courtNumber(request.to.courtId)}, {dayLabel(clubParts(request.to.startsAt).dateKey)} {rangeLabel(request.to.startsAt, request.to.endsAt)} · <strong>{request.status}</strong>{request.simulated ? ' (simulated)' : ''}</li>)}</ul>}<Link className="text-link" href="/staff/requests">Open requests <ArrowRight size={15} aria-hidden="true" /></Link></section>
     <p className="booking-helper">Demo clock: {dayLabel(staffClock.today)}, 7:30 AM Asia/Manila.</p>
    </>}
   </section>
  </div>
 </main>;
}
