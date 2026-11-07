'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { CourtMap } from '@/components/public/court-map';
import { demoClub, demoCourts } from '@/lib/demo/club';
import { staffClock, staffHours, staffCourts, courtNumber, bookingStatuses, bookingByRef, customerOf } from '@/lib/demo/staff';
import { scheduleItems, dayGrid, weekGrid, dateRange, dayLabel, rangeLabel, hourRangeLabel, scheduleFilters, courtDayStatus, kindLabels, clockLabel } from '@/lib/demo/staff-schedule';
import { StaffPageIntro, StatusPill } from './staff-page-intro';
import { ReclubLink } from './reclub-link';
import { useStaffDemo } from './staff-demo-context';

// Visible abbreviations for 1-hour grid cells; the full status follows in the accessible name.
const shortLabels = { confirmed: 'Conf.', pending_verification: 'Review', held: 'Hold', completed: 'Done', 'open-play': 'Open', maintenance: 'Maint.' };
const hours = Array.from({ length: staffHours.close - staffHours.open }, (_, index) => staffHours.open + index);
const shortHour = (hour) => `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
const compactRange = (from, to) => { const suffix = (hour) => (hour < 12 ? 'AM' : 'PM'); return suffix(from) === suffix(to) ? `${from % 12 || 12}–${to % 12 || 12} ${suffix(to)}` : `${shortHour(from)}–${shortHour(to)}`; };

// Open play renders the details button and its Reclub action as siblings, never nested.
function ScheduleEntry({ item, selected, onSelect, compact = false, abbreviate = false }) {
 if (item.kind !== 'open-play') return <ItemButton item={item} selected={selected} onSelect={onSelect} compact={compact} abbreviate={abbreviate} />;
 return <div className="grid-openplay"><ItemButton item={item} selected={selected} onSelect={onSelect} compact={compact} abbreviate={abbreviate} /><ReclubLink event={item.event} compact /></div>;
}

function ItemButton({ item, selected, onSelect, compact = false, abbreviate = false }) {
 return <button type="button" className={`grid-item ${item.tone} ${selected ? 'selected' : ''} ${abbreviate ? 'abbreviated' : ''}`} aria-pressed={selected} onClick={() => onSelect(item.id)}>
  <span className="sr-only">Court {courtNumber(item.courtId)}, </span><strong>{item.kind === 'open-play' && <span className="openplay-mark" aria-hidden="true">◆ </span>}{abbreviate ? <>{shortLabels[item.statusKey]}<span className="sr-only"> ({item.label})</span></> : item.label}</strong><small>{compactRange(item.startHour, item.endHour)}</small>
  {!compact && <span className="grid-item-title">{item.title}</span>}<span className="sr-only">{compact ? `, ${item.title}` : ''}{item.simulated ? ', simulated' : ''}</span>
 </button>;
}

export function ScheduleView() {
 const { data } = useStaffDemo();
 const items = useMemo(() => scheduleItems(data), [data]);
 const [dateKey, setDateKey] = useState(staffClock.today);
 const [view, setView] = useState('day');
 const [court, setCourt] = useState('all');
 const [filter, setFilter] = useState('all');
 const [selectedId, setSelectedId] = useState(null);
 const [focusTick, setFocusTick] = useState(0);
 const detailHeading = useRef(null);
 useEffect(() => { if (focusTick) detailHeading.current?.focus(); }, [focusTick]);
 const courtIds = court === 'all' ? staffCourts.map((entry) => entry.id) : [court];
 const rows = dayGrid(items, dateKey, { courtIds, filter });
 const allRows = dayGrid(items, dateKey);
 const week = weekGrid(items, dateKey, { courtIds, filter });
 const selected = items.find((item) => item.id === selectedId);
 const select = (id) => { setSelectedId(id); setFocusTick((tick) => tick + 1); };
 const shown = view === 'day' ? rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell.type === 'item').length, 0) : week.reduce((sum, day) => sum + day.courts.reduce((inner, entry) => inner + entry.items.length, 0), 0);
 const free = view === 'day' ? rows.reduce((sum, row) => sum + row.freeHours, 0) : week.reduce((sum, day) => sum + day.courts.reduce((inner, entry) => inner + entry.freeHours, 0), 0);
 const scope = view === 'day' ? dayLabel(dateKey) : `week of ${dayLabel(week[0].dateKey)}`;
 const booking = selected?.kind === 'booking' ? bookingByRef(data, selected.reference) : null;
 const event = selected?.kind === 'open-play' ? data.openPlay.find((entry) => entry.id === selected.sourceId) : null;

 return <main id="main-content" className="dashboard-main">
  <StaffPageIntro crumb="Schedule" eyebrow="FIVE COURTS, ONE VIEW" title="Court schedule" description="Bookings, open play and maintenance compete for the same court time. All times Asia/Manila." />
  <section className="dashboard-panel staff-controls" aria-labelledby="schedule-controls-heading"><h2 id="schedule-controls-heading" className="sr-only">Schedule controls</h2>
   <div className="staff-control-row">
    <label className="filter-label" htmlFor="schedule-date">Club date<select id="schedule-date" value={dateKey} onChange={(e) => setDateKey(e.target.value)}>{dateRange().map((key) => <option key={key} value={key}>{dayLabel(key)}{key === staffClock.today ? ' (demo today)' : ''}</option>)}</select></label>
    <div className="view-switch" role="group" aria-label="Schedule view"><button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>Day</button><button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button></div>
    <label className="filter-label" htmlFor="schedule-court">Court<select id="schedule-court" value={court} onChange={(e) => setCourt(e.target.value)}><option value="all">All courts</option>{staffCourts.map((entry) => <option key={entry.id} value={entry.id}>Court {entry.number}</option>)}</select></label>
    <label className="filter-label" htmlFor="schedule-filter">Show<select id="schedule-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>{scheduleFilters.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
   </div>
   <p className="table-footnote" role="status">{scope} · {courtIds.length === 5 ? 'all five courts' : `Court ${courtNumber(courtIds[0])} only`} · {shown} {shown === 1 ? 'item' : 'items'} shown · {free} free court-{free === 1 ? 'hour' : 'hours'}{filter !== 'all' ? ' · other occupied time is marked “hidden by filter”, never free' : ''}</p>
   <ul className="schedule-legend" aria-label="Schedule legend"><li><StatusPill tone="available">Confirmed</StatusPill></li><li><StatusPill tone="pending">Unpaid hold or pending review</StatusPill></li><li><StatusPill tone="completed">Completed</StatusPill></li><li><StatusPill tone="open-play">◆ Open play (Reclub Meet)</StatusPill></li><li><StatusPill tone="maintenance">Maintenance</StatusPill></li><li><span className="legend-free">Free</span></li></ul>
   <p className="booking-helper">In 1-hour grid cells: Conf. = Confirmed · Review = Pending review · Hold = Unpaid hold · Done = Completed · Maint. = Maintenance. ◆ marks open play.</p>
  </section>

  {view === 'day' ? <section className="dashboard-panel" aria-labelledby="day-heading">
   <div className="panel-heading"><div><p className="eyebrow">DAILY VIEW</p><h2 id="day-heading">{dayLabel(dateKey, true)}</h2></div></div>
   <div className="staff-day-layout">
    <div className="court-map-panel staff-map"><p className="map-label">COURTS AT A GLANCE · {dayLabel(dateKey)}</p>
     <CourtMap club={demoClub} courts={demoCourts} selectedCourtId={court === 'all' ? null : court} onSelect={(id) => setCourt(court === id ? 'all' : id)} getStatus={(entry) => courtDayStatus(allRows.find((row) => row.courtId === entry.id))} getDetail={(entry) => `${allRows.find((row) => row.courtId === entry.id).freeHours} of ${staffHours.close - staffHours.open} hours free`} />
     <p className="map-footnote">Approved layout. Select a court to filter the schedule; select it again to show all courts.</p></div>
    <div className="staff-day-grid">
     <div className="staff-table-wrap day-grid-wrap" role="region" aria-label="Daily court grid" tabIndex={0}>
      <table className="day-grid"><caption className="sr-only">Court schedule for {dayLabel(dateKey, true)}, Asia/Manila, one column per hour</caption>
       <thead><tr><th scope="col">Court</th>{hours.map((hour) => <th scope="col" key={hour}>{shortHour(hour)}</th>)}</tr></thead>
       <tbody>{rows.map((row) => <tr key={row.courtId}><th scope="row">Court {courtNumber(row.courtId)}<small>{row.freeHours} h free</small></th>
        {row.cells.map((cell) => <td key={`${cell.from}-${cell.type}`} colSpan={cell.to - cell.from} className={`grid-cell ${cell.type}`}>
         {cell.type === 'item' && <ScheduleEntry item={cell.item} selected={cell.item.id === selectedId} onSelect={select} compact={cell.to - cell.from < 2} abbreviate={cell.to - cell.from < 2} />}
         {cell.type === 'free' && <><span aria-hidden="true">{cell.to - cell.from >= 2 ? 'Available' : 'Free'}</span><span className="sr-only">Court {courtNumber(row.courtId)} available {hourRangeLabel(cell.from, cell.to)}</span></>}
         {cell.type === 'hidden' && <><span aria-hidden="true">Filtered</span><span className="sr-only">Court {courtNumber(row.courtId)} occupied {hourRangeLabel(cell.from, cell.to)}, hidden by the current filter</span></>}
        </td>)}</tr>)}</tbody>
      </table>
     </div>
     <ul className="staff-cards day-list" aria-label={`Court schedule list for ${dayLabel(dateKey)}`}>{rows.map((row) => <li key={row.courtId} className="schedule-card"><h3>Court {courtNumber(row.courtId)} <small>{row.freeHours} h free</small></h3>
      <ol className="day-entries">{row.cells.map((cell) => <li key={`${cell.from}-${cell.type}`} className={`day-entry ${cell.type}`}>
       <span className="day-entry-time">{hourRangeLabel(cell.from, cell.to)}</span>
       {cell.type === 'free' && <span className="legend-free">Available</span>}
       {cell.type === 'hidden' && <span className="day-entry-hidden">Occupied — hidden by filter</span>}
       {cell.type === 'item' && <><StatusPill tone={cell.item.tone}>{cell.item.label}</StatusPill><span className="day-entry-title">{cell.item.title}{cell.item.simulated ? ' (simulated)' : ''}</span><button type="button" className="text-link" aria-pressed={cell.item.id === selectedId} onClick={() => select(cell.item.id)}>Details<span className="sr-only"> for Court {courtNumber(cell.item.courtId)}, {rangeLabel(cell.item.startsAt, cell.item.endsAt)}, {cell.item.label}</span></button>{cell.item.kind === 'open-play' && <ReclubLink event={cell.item.event} />}</>}
      </li>)}</ol></li>)}</ul>
    </div>
   </div>
  </section> : <section className="dashboard-panel" aria-labelledby="week-heading">
   <div className="panel-heading"><div><p className="eyebrow">WEEKLY VIEW</p><h2 id="week-heading">Week of {dayLabel(week[0].dateKey, true)}</h2></div></div>
   <div className="staff-table-wrap week-grid-wrap" role="region" aria-label="Weekly court grid" tabIndex={0}>
    <table className="week-grid"><caption className="sr-only">Weekly schedule, Saturday to Friday, Asia/Manila</caption>
     <thead><tr><th scope="col">Day</th>{courtIds.map((id) => <th scope="col" key={id}>Court {courtNumber(id)}</th>)}</tr></thead>
     <tbody>{week.map((day) => <tr key={day.dateKey} className={day.dateKey === staffClock.today ? 'is-today' : ''}><th scope="row">{dayLabel(day.dateKey).replace(' 2026', '')}{day.dateKey === staffClock.today && <small>Demo today</small>}</th>
      {day.courts.map((entry) => <td key={entry.courtId}><ul className="week-cell">{entry.items.map((item) => <li key={item.id}><ScheduleEntry item={item} selected={item.id === selectedId} onSelect={select} compact /></li>)}</ul><small className="week-free">{entry.freeHours === staffHours.close - staffHours.open ? 'Free all day' : `${entry.freeHours} h free`}{entry.hidden ? ` · ${entry.hidden} hidden by filter` : ''}</small></td>)}</tr>)}</tbody>
    </table>
   </div>
   <ul className="staff-cards" aria-label="Weekly schedule list">{week.map((day) => <li key={day.dateKey} className="schedule-card"><h3>{dayLabel(day.dateKey)}{day.dateKey === staffClock.today ? ' · demo today' : ''}</h3>
    <ul className="week-day-courts">{day.courts.map((entry) => <li key={entry.courtId}><strong>Court {courtNumber(entry.courtId)}</strong> <small>{entry.freeHours} h free{entry.hidden ? ` · ${entry.hidden} hidden by filter` : ''}</small>
     {entry.items.length > 0 && <ul className="day-entries">{entry.items.map((item) => <li key={item.id} className="day-entry item"><span className="day-entry-time">{rangeLabel(item.startsAt, item.endsAt)}</span><StatusPill tone={item.tone}>{item.label}</StatusPill><button type="button" className="text-link" aria-pressed={item.id === selectedId} onClick={() => select(item.id)}>Details<span className="sr-only"> for {dayLabel(day.dateKey)}, Court {courtNumber(item.courtId)}, {rangeLabel(item.startsAt, item.endsAt)}, {item.label}</span></button>{item.kind === 'open-play' && <ReclubLink event={item.event} />}</li>)}</ul>}</li>)}</ul></li>)}</ul>
  </section>}

  <section className="dashboard-panel staff-detail" aria-labelledby="schedule-detail-heading">
   <p className="eyebrow">SELECTED ITEM</p>
   <h2 id="schedule-detail-heading" ref={detailHeading} tabIndex={-1}>{selected ? `${kindLabels[selected.kind]} · Court ${courtNumber(selected.courtId)}` : 'Nothing selected'}</h2>
   {selected ? <>
    <dl className="booking-receipt staff-dl"><div><dt>Date</dt><dd>{dayLabel(selected.dateKey, true)}</dd></div><div><dt>Time (Asia/Manila)</dt><dd>{rangeLabel(selected.startsAt, selected.endsAt)}</dd></div><div><dt>Stored as UTC</dt><dd>{selected.startsAt} → {selected.endsAt}</dd></div><div><dt>Status</dt><dd><StatusPill tone={selected.tone}>{selected.label}</StatusPill></dd></div><div><dt>Reference</dt><dd>{selected.reference}</dd></div>
     {booking && <><div><dt>Customer</dt><dd>{customerOf(data, booking).name}</dd></div><div><dt>What the status means</dt><dd>{bookingStatuses[booking.status].description}</dd></div></>}
     {event && <><div><dt>Event</dt><dd>{event.title}</dd></div><div><dt>Courts</dt><dd>{event.courtIds.map((id) => `Court ${courtNumber(id)}`).join(', ')}</dd></div><div><dt>Private booking</dt><dd>Unavailable on these courts during this event</dd></div><div><dt>Reclub Meet</dt><dd><ReclubLink event={event} /><small className="reclub-note">Opens the event’s own Meet in Reclub. Nothing is booked, registered or paid in Rally Grounds.</small></dd></div></>}
     {selected.kind === 'maintenance' && <div><dt>Reason</dt><dd>{selected.title}</dd></div>}
    </dl>
    <p className="booking-helper">Read-only view. Simulated changes are made on the Bookings, Open play and Maintenance pages and reset on reload.</p>
    <Link className="text-link" href={booking ? `/staff/bookings?ref=${booking.reference}` : selected.kind === 'open-play' ? '/staff/open-play' : '/staff/maintenance'}>{booking ? 'Open the booking record' : selected.kind === 'open-play' ? 'Open open-play management' : 'Open maintenance closures'} <ArrowRight size={15} aria-hidden="true" /></Link>
   </> : <p className="booking-helper">Select a booking, open-play period or closure in the schedule to see its details. Demo clock: {clockLabel(7, 30)} on {dayLabel(staffClock.today)}.</p>}
  </section>
 </main>;
}
