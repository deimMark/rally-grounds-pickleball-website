'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { formatMoney } from '@/lib/domain/demo-availability';
import { courtNumber, bookingStatuses, paymentStateOf, paymentStateLabel } from '@/lib/demo/staff';
import { customerSummaries, searchCustomers, customerFilters } from '@/lib/demo/staff-customers';
import { dayLabel, rangeLabel, clubParts } from '@/lib/demo/staff-schedule';
import { StaffPageIntro, StatusPill } from './staff-page-intro';
import { useStaffDemo } from './staff-demo-context';

export function CustomersView() {
 const { data } = useStaffDemo();
 const summaries = useMemo(() => customerSummaries(data), [data]);
 const [query, setQuery] = useState('');
 const [filter, setFilter] = useState('all');
 const [selectedId, setSelectedId] = useState(null);
 const [focusTick, setFocusTick] = useState(0);
 const heading = useRef(null);
 useEffect(() => { if (focusTick) heading.current?.focus(); }, [focusTick]);
 const rows = searchCustomers(summaries, query, filter);
 const selected = summaries.find((summary) => summary.customer.id === selectedId);
 const open = (id) => { setSelectedId(id); setFocusTick((tick) => tick + 1); };

 return <main id="main-content" className="dashboard-main">
  <StaffPageIntro crumb="Customers" eyebrow="CUSTOMER HISTORY" title="Fictional customer history" description="A preview of how staff would see a guest’s bookings. There are no customer accounts, registration or messaging in this demo." />
  <div className="staff-split">
   <section className="dashboard-panel" aria-labelledby="customers-heading">
    <p className="eyebrow">SAMPLE CUSTOMERS</p><h2 id="customers-heading">Customers</h2>
    <div className="staff-control-row">
     <label className="filter-label grow">Search by name or sample customer reference<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Customer C or CUST-DEMO-C" /></label>
     <label className="filter-label">Show<select value={filter} onChange={(e) => setFilter(e.target.value)}>{customerFilters.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
    </div>
    <p className="booking-helper">Email and phone lookup is intentionally not offered: knowing a contact detail must never grant access to a customer’s records.</p>
    <p className="table-footnote" role="status">{rows.length} of {summaries.length} fictional customers shown</p>
    {rows.length === 0 ? <p className="staff-empty">No fictional customers match. Clear the search or choose another filter.</p> : <>
     <div className="staff-table-wrap" role="region" aria-label="Fictional customers table" tabIndex={0}>
      <table className="staff-table"><caption className="sr-only">Fictional customers with booking counts</caption>
       <thead><tr><th scope="col">Customer</th><th scope="col">Bookings</th><th scope="col">Past</th><th scope="col">Upcoming</th><th scope="col">Completed</th><th scope="col">Cancelled</th><th scope="col">Pending claims</th><th scope="col">Verified (fictional)</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
       <tbody>{rows.map((summary) => <tr key={summary.customer.id} aria-current={summary.customer.id === selectedId ? 'true' : undefined}><th scope="row"><strong>{summary.customer.name}</strong><small>{summary.customer.reference}</small></th><td>{summary.total}</td><td>{summary.past}</td><td>{summary.upcoming}</td><td>{summary.completed}</td><td>{summary.cancelled}</td><td>{summary.pendingClaims}</td><td>{formatMoney(summary.verifiedCentavos)}</td><td><button type="button" className="text-link" onClick={() => open(summary.customer.id)}>History<span className="sr-only"> for {summary.customer.name}</span></button></td></tr>)}</tbody>
      </table>
     </div>
     <ul className="staff-cards" aria-label="Fictional customers list">{rows.map((summary) => <li key={summary.customer.id} className="schedule-card"><h3>{summary.customer.name}</h3><dl><div><dt>Reference</dt><dd>{summary.customer.reference}</dd></div><div><dt>Bookings</dt><dd>{summary.total} total · {summary.past} past · {summary.upcoming} upcoming</dd></div><div><dt>Outcomes</dt><dd>{summary.completed} completed · {summary.cancelled} cancelled</dd></div><div><dt>Payments</dt><dd>{summary.pendingClaims} pending claims · {formatMoney(summary.verifiedCentavos)} verified (fictional)</dd></div></dl><button type="button" className="button button-outline" onClick={() => open(summary.customer.id)}>View history<span className="sr-only"> for {summary.customer.name}</span></button></li>)}</ul>
    </>}
   </section>

   <section className="dashboard-panel staff-detail" aria-labelledby="customer-detail-heading">
    <p className="eyebrow">CUSTOMER DETAIL</p>
    <h2 id="customer-detail-heading" ref={heading} tabIndex={-1}>{selected ? selected.customer.name : 'No customer selected'}</h2>
    {!selected ? <p className="booking-helper">Select a fictional customer to see their bookings in date order.</p> : <>
     <dl className="staff-dl"><div><dt>Customer reference</dt><dd>{selected.customer.reference}</dd></div><div><dt>Contact (synthetic)</dt><dd>{selected.customer.contact.value}</dd></div><div><dt>Past bookings</dt><dd>{selected.past}</dd></div><div><dt>Upcoming bookings</dt><dd>{selected.upcoming}</dd></div><div><dt>Completed sessions</dt><dd>{selected.completed}</dd></div><div><dt>Cancelled reservations</dt><dd>{selected.cancelled}</dd></div><div><dt>Pending payment claims</dt><dd>{selected.pendingClaims}</dd></div><div><dt>Verified payments (fictional)</dt><dd>{formatMoney(selected.verifiedCentavos)}</dd></div></dl>
     <div className="booking-safe-note"><ShieldAlert size={19} aria-hidden="true" /><p>Read-only preview. No editing, messaging or account access exists. The contact address uses the reserved example.invalid domain.</p></div>
     <h3 className="history-heading">Booking history (oldest first)</h3>
     <ol className="customer-history">{selected.bookings.map((booking) => <li key={booking.reference}><span className="history-when">{dayLabel(clubParts(booking.startsAt).dateKey)} · {rangeLabel(booking.startsAt, booking.endsAt)}</span><span>Court {courtNumber(booking.courtId)} · <StatusPill tone={bookingStatuses[booking.status].tone}>{bookingStatuses[booking.status].label}</StatusPill> · {paymentStateLabel(paymentStateOf(booking))}</span><Link className="text-link" href={`/staff/bookings?ref=${booking.reference}`}>Open booking<span className="sr-only"> {booking.reference}</span></Link></li>)}</ol>
    </>}
   </section>
  </div>
 </main>;
}
