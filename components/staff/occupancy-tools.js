'use client';
import { AlertTriangle } from 'lucide-react';
import { staffClock, staffHours, courtNumber } from '@/lib/demo/staff';
import { dateRange, dayLabel, rangeLabel, clockLabel, dayGrid, overlaps, kindLabels } from '@/lib/demo/staff-schedule';
import { StatusPill } from './staff-page-intro';

export const futureDates = () => dateRange(staffClock.today, staffClock.lastDay);
export const startHours = Array.from({ length: staffHours.close - staffHours.open }, (_, index) => staffHours.open + index);
export const endHours = startHours.map((hour) => hour + 1);

// Shared date/start/end selects with inline errors wired to aria-describedby.
export function TimeFields({ idPrefix, values, onChange, errors }) {
 const field = (name, label, options, format) => <label className="filter-label" htmlFor={`${idPrefix}-${name}`}>{label}
  <select id={`${idPrefix}-${name}`} value={values[name]} aria-invalid={errors[name] ? 'true' : undefined} aria-describedby={errors[name] ? `${idPrefix}-${name}-error` : undefined} onChange={(e) => onChange(name, e.target.value)}>{options.map((option) => <option key={option} value={option}>{format(option)}</option>)}</select>
  {errors[name] && <span id={`${idPrefix}-${name}-error`} className="field-error">{errors[name]}</span>}
 </label>;
 return <div className="staff-control-row">
  {field('date', 'Date', futureDates(), (key) => dayLabel(key))}
  {field('start', 'Start (Asia/Manila)', startHours.map(String), (hour) => clockLabel(Number(hour)))}
  {field('end', 'End (Asia/Manila)', endHours.map(String), (hour) => clockLabel(Number(hour)))}
 </div>;
}

// Lists everything already on the chosen courts that day and marks overlaps with the proposal.
export function AffectedSchedule({ items, dateKey, courtIds, candidate, excludeSourceIds = [] }) {
 const rows = dayGrid(items, dateKey, { courtIds });
 return <section className="affected-schedule" aria-label={`Affected schedule for ${dayLabel(dateKey)}`}>
  <h4>Affected schedule · {dayLabel(dateKey)}</h4>
  <ul>{rows.map((row) => {
   const occupied = row.cells.filter((cell) => cell.type !== 'free' && !excludeSourceIds.includes(cell.item.sourceId));
   return <li key={row.courtId}><strong>Court {courtNumber(row.courtId)}</strong>{occupied.length === 0 ? <span> · nothing else scheduled</span> : <ul>{occupied.map((cell) => { const clash = candidate && overlaps(cell.item, candidate); return <li key={cell.item.id} className={clash ? 'clash' : ''}>{rangeLabel(cell.item.startsAt, cell.item.endsAt)} · <StatusPill tone={cell.item.tone}>{cell.item.label}</StatusPill> {cell.item.title}{clash && <strong className="clash-tag"> · Overlaps the proposal</strong>}</li>; })}</ul>}</li>;
  })}</ul>
 </section>;
}

export function ConflictWarning({ id, conflicts, subject }) {
 return <div id={id} tabIndex={-1} role="alert" className="conflict-warning"><AlertTriangle size={20} aria-hidden="true" /><div>
  <strong>Occupancy conflict — {subject} not added.</strong>
  <p>{conflicts.length} existing {conflicts.length === 1 ? 'item overlaps' : 'items overlap'} the proposed time:</p>
  <ul>{conflicts.map((item) => <li key={item.id}>{kindLabels[item.kind]} · Court {courtNumber(item.courtId)} · {rangeLabel(item.startsAt, item.endsAt)} · {item.label}{item.kind === 'booking' ? ` (${item.title})` : ''}</li>)}</ul>
  <p>Bookings are never silently displaced and this demo offers no override. Choose another time or court. This is a client-side preview of the half-open overlap rule; Phase 5B must enforce it in the database.</p>
 </div></div>;
}

export function validateTimes(values) {
 const errors = {};
 if (Number(values.end) <= Number(values.start)) errors.end = 'End must be after the start time.';
 return errors;
}
