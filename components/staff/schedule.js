'use client';
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

function BookingStatus({ session }) {
  return <span className={`status-pill ${session.tone}`}><i aria-hidden="true" />{session.status}</span>;
}

export function DemoSchedule({ schedule, dateLabel }) {
  const [filter, setFilter] = useState('all');
  const visible = filter === 'all' ? schedule : schedule.filter((item) => item.status === 'Pending review');
  return <section className="dashboard-panel" id="schedule" aria-labelledby="schedule-heading">
    <div className="panel-heading"><div><p className="eyebrow">ON THE COURTS</p><h2 id="schedule-heading">Sample schedule</h2></div>
      <label className="filter-label">Show<select aria-label="Filter sample schedule" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All sessions</option><option value="review">Pending review</option></select></label>
    </div>
    <p className="schedule-date"><CalendarDays size={15} aria-hidden="true" />{dateLabel} · Asia/Manila</p>
    <div className="schedule-table-wrapper" tabIndex={0} role="region" aria-label="Sample schedule table, scroll horizontally for more columns">
      <table><caption className="sr-only">Synthetic sessions for {dateLabel}</caption><thead><tr><th scope="col">Court / reference</th><th scope="col">Time</th><th scope="col">Session</th><th scope="col">Status</th></tr></thead>
        <tbody>{visible.map((item) => <tr key={item.id}><th scope="row"><strong>{item.court}</strong><small>{item.id}</small></th><td>{item.time}</td><td>{item.type}</td><td><BookingStatus session={item} /></td></tr>)}</tbody>
      </table>
    </div>
    <ul className="schedule-cards" aria-label="Synthetic booking details">
      {visible.map((item) => <li key={item.id} className="schedule-card">
        <h3>{item.court}</h3>
        <dl><div><dt>Reference</dt><dd>{item.id}</dd></div><div><dt>Time</dt><dd>{item.time}</dd></div><div><dt>Session type</dt><dd>{item.type}</dd></div><div><dt>Booking status</dt><dd><BookingStatus session={item} /></dd></div></dl>
      </li>)}
    </ul>
    <p className="table-footnote" role="status">{visible.length} synthetic {visible.length === 1 ? 'session' : 'sessions'} · Read-only preview. Scheduling and payment actions are not enabled.</p>
  </section>;
}
