'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Pencil, XCircle, Link2, Link2Off, CheckCircle2 } from 'lucide-react';
import { staffClock, staffCourts, courtNumber, clubInstant } from '@/lib/demo/staff';
import { scheduleItems, findConflicts, dayLabel, rangeLabel, clubParts } from '@/lib/demo/staff-schedule';
import { StaffPageIntro, ConfirmBox } from './staff-page-intro';
import { ReclubLink } from './reclub-link';
import { validateReclubUrl } from '@/lib/demo/reclub';
import { useStaffDemo, SimulationNotice } from './staff-demo-context';
import { TimeFields, AffectedSchedule, ConflictWarning, validateTimes } from './occupancy-tools';

const blank = () => ({ title: '', courtIds: [], date: staffClock.today, start: '17', end: '19', description: '', reclubUrl: '' });

export function OpenPlayView() {
 const { data, dispatch } = useStaffDemo();
 const items = useMemo(() => scheduleItems(data), [data]);
 const [values, setValues] = useState(blank);
 const [editingId, setEditingId] = useState(null);
 const [errors, setErrors] = useState({});
 const [conflicts, setConflicts] = useState([]);
 const [cancelling, setCancelling] = useState(null);
 // Focus is moved by element id after render (validation errors, conflicts, edit mode).
 const [focusTarget, setFocusTarget] = useState(null);
 useEffect(() => { if (focusTarget) document.getElementById(focusTarget.id)?.focus(); }, [focusTarget]);
 const focus = (id) => setFocusTarget((previous) => ({ id, n: (previous?.n ?? 0) + 1 }));
 const change = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setConflicts([]); };
 const toggleCourt = (id) => change('courtIds', values.courtIds.includes(id) ? values.courtIds.filter((court) => court !== id) : [...values.courtIds, id]);
 const candidate = { startsAt: clubInstant(values.date, Number(values.start)), endsAt: clubInstant(values.date, Number(values.end)) };
 const exclude = editingId ? [editingId] : [];

 function submit(event) {
  event.preventDefault();
  const next = validateTimes(values);
  if (!values.title.trim()) next.title = 'Enter an event title.';
  else if (values.title.trim().length > 80) next.title = 'Keep the title to 80 characters or fewer.';
  if (values.courtIds.length === 0) next.courts = 'Choose at least one court.';
  const link = validateReclubUrl(values.reclubUrl);
  if (!link.ok) next.reclubUrl = link.message;
  setErrors(next);
  if (Object.keys(next).length) { setConflicts([]); focus({ title: 'op-title', courts: 'op-courts-legend', end: 'op-end', reclubUrl: 'op-reclub' }[['title', 'courts', 'end', 'reclubUrl'].find((key) => next[key])]); return; }
  const found = findConflicts({ courtIds: values.courtIds, ...candidate, excludeSourceIds: exclude }, items);
  setConflicts(found);
  if (found.length) { focus('op-conflict'); return; }
  const payload = { eventType: 'open-play', title: values.title.trim(), courtIds: [...values.courtIds].sort(), ...candidate, description: values.description.trim() || 'Fictional event description.', reclubUrl: validateReclubUrl(values.reclubUrl).url };
  const where = `${payload.courtIds.map((id) => `Court ${courtNumber(id)}`).join(' and ')}, ${dayLabel(values.date)} ${rangeLabel(candidate.startsAt, candidate.endsAt)}`;
  if (editingId) dispatch({ type: 'open-play-edit', id: editingId, changes: payload, message: `Open-play event “${payload.title}” updated for ${where}. ${payload.reclubUrl ? 'Reclub Meet link set.' : 'Reclub Meet link pending.'} No booking, RSVP or payment was changed.` });
  else dispatch({ type: 'open-play-add', event: payload, message: `Open-play event “${payload.title}” previewed on ${where}. It blocks private booking in this tab only. ${payload.reclubUrl ? 'Reclub Meet link set.' : 'Reclub Meet link pending.'}` });
  setValues(blank()); setEditingId(null); setErrors({});
 }
 function edit(event) {
  const start = clubParts(event.startsAt), end = clubParts(event.endsAt);
  setValues({ title: event.title, courtIds: event.courtIds, date: start.dateKey, start: String(start.hour), end: String(end.hour), description: event.description, reclubUrl: event.reclubUrl ?? '' });
  setEditingId(event.id); setErrors({}); setConflicts([]); focus('op-form-heading');
 }
 const errorCount = Object.keys(errors).length;
 const linkCheck = validateReclubUrl(values.reclubUrl);
 const visibleEvents = [...data.openPlay].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

 return <main id="main-content" className="dashboard-main">
  <StaffPageIntro crumb="Open play" eyebrow="COMMUNITY SESSIONS" title="Open-play management" description="Open play blocks ordinary booking on its courts. Each event can link to its own Reclub Meet. Create, edit or cancel events here as an in-memory preview only." />
  <div className="staff-split">
   <section className="dashboard-panel" aria-labelledby="events-heading">
    <p className="eyebrow">SAMPLE EVENTS</p><h2 id="events-heading">Open-play events</h2>
    <SimulationNotice />
    {visibleEvents.length === 0 ? <p className="staff-empty">No open-play events in the sample data. Use the form to preview one.</p> : <ul className="event-list">{visibleEvents.map((event) => {
     const hours = (Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 3600000;
     return <li key={event.id} className="event-card"><div className="event-card-head"><h3>{event.title}</h3>{event.simulated && <strong className="simulated-tag">Simulated</strong>}</div>
      <dl className="staff-dl"><div><dt>When</dt><dd>{dayLabel(clubParts(event.startsAt).dateKey)} · {rangeLabel(event.startsAt, event.endsAt)}</dd></div><div><dt>Courts</dt><dd>{event.courtIds.map((id) => `Court ${courtNumber(id)}`).join(', ')}</dd></div><div><dt>Description</dt><dd>{event.description}</dd></div><div><dt>Availability impact</dt><dd>{event.courtIds.length * hours} court-{event.courtIds.length * hours === 1 ? 'hour' : 'hours'} closed to private booking</dd></div><div><dt>Reclub Meet</dt><dd><ReclubLink event={event} /></dd></div></dl>
      <div className="payment-preview-actions"><button type="button" className="button button-outline" onClick={() => edit(event)}><Pencil size={15} aria-hidden="true" />Edit<span className="sr-only"> {event.title}</span></button><button type="button" className="button button-outline" onClick={() => setCancelling(event)}><XCircle size={15} aria-hidden="true" />Cancel event<span className="sr-only"> {event.title}</span></button>{event.reclubUrl && <button type="button" className="button button-outline" onClick={() => dispatch({ type: 'open-play-edit', id: event.id, changes: { reclubUrl: null }, message: `Reclub Meet link removed from “${event.title}” in this preview. The Meet itself in Reclub is untouched.` })}><Link2Off size={15} aria-hidden="true" />Remove Reclub link<span className="sr-only"> from {event.title}</span></button>}</div>
      {cancelling?.id === event.id && <ConfirmBox id={`cancel-${event.id}`} prompt={`Simulate cancelling “${event.title}”? Its courts would show as free in this tab only. Nobody is notified.`} confirmLabel="Confirm simulated cancellation" cancelLabel="Keep event" onConfirm={() => { dispatch({ type: 'open-play-cancel', id: event.id, message: `Open-play event “${event.title}” cancelled in this preview. Nobody was notified and nothing was saved.` }); setCancelling(null); }} onCancel={() => setCancelling(null)} />}
     </li>;
    })}</ul>}
   </section>

   <section className="dashboard-panel" aria-labelledby="op-form-heading">
    <p className="eyebrow">{editingId ? 'EDIT (SIMULATED)' : 'NEW EVENT (SIMULATED)'}</p><h2 id="op-form-heading" tabIndex={-1}>{editingId ? 'Edit open-play event' : 'Preview a new open-play event'}</h2>
    <form onSubmit={submit} noValidate className="staff-form">
     {errorCount > 0 && <p className="booking-error" role="alert"><AlertCircle size={16} aria-hidden="true" />Fix {errorCount} {errorCount === 1 ? 'field' : 'fields'} before previewing the event.</p>}
     <label className="filter-label" htmlFor="op-title">Event title<input id="op-title" value={values.title} maxLength={80} aria-invalid={errors.title ? 'true' : undefined} aria-describedby={errors.title ? 'op-title-error' : undefined} onChange={(e) => change('title', e.target.value)} />{errors.title && <span id="op-title-error" className="field-error">{errors.title}</span>}</label>
     <fieldset className="court-checks" aria-describedby={errors.courts ? 'op-courts-error' : undefined}><legend id="op-courts-legend" tabIndex={-1}>Courts</legend>{staffCourts.map((court) => <label key={court.id}><input type="checkbox" checked={values.courtIds.includes(court.id)} aria-invalid={errors.courts ? 'true' : undefined} onChange={() => toggleCourt(court.id)} />Court {court.number}</label>)}{errors.courts && <span id="op-courts-error" className="field-error">{errors.courts}</span>}</fieldset>
     <TimeFields idPrefix="op" values={values} onChange={change} errors={errors} />
     <label className="filter-label" htmlFor="op-description">Description (optional, fictional)<textarea id="op-description" rows={2} maxLength={200} value={values.description} onChange={(e) => change('description', e.target.value)} /></label>
     <label className="filter-label" htmlFor="op-reclub">Reclub Meet link (optional)<input id="op-reclub" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={values.reclubUrl} placeholder="https://reclub.co/…" aria-invalid={errors.reclubUrl ? 'true' : undefined} aria-describedby={`op-reclub-help op-reclub-status${errors.reclubUrl ? ' op-reclub-error' : ''}`} onChange={(e) => change('reclubUrl', e.target.value)} />
      <span id="op-reclub-help" className="booking-helper">Paste the event’s own link from Reclub (open the Meet, tap Share, then Copy Link). Only https links on reclub.co are accepted. Leave empty to show “link pending”. Rally Grounds never creates, edits or syncs Reclub events.</span>
      {errors.reclubUrl && <span id="op-reclub-error" className="field-error">{errors.reclubUrl}</span>}</label>
     <p id="op-reclub-status" className={`reclub-check ${linkCheck.state}`} aria-live="polite">{linkCheck.state === 'pending' ? <><Link2Off size={15} aria-hidden="true" />No link entered — the event will show “Reclub Meet link pending”.</> : linkCheck.state === 'ready' ? <><CheckCircle2 size={15} aria-hidden="true" />Valid Reclub link. Preview: <code>{linkCheck.display}</code></> : <><Link2 size={15} aria-hidden="true" />Not accepted yet: {linkCheck.message}</>}</p>
     {conflicts.length > 0 && <ConflictWarning id="op-conflict" conflicts={conflicts} subject="event" />}
     {values.courtIds.length > 0 && <AffectedSchedule items={items} dateKey={values.date} courtIds={[...values.courtIds].sort()} candidate={Number(values.end) > Number(values.start) ? candidate : null} excludeSourceIds={exclude} />}
     <div className="payment-preview-actions"><button type="submit" className="button button-navy">{editingId ? 'Check and save preview' : 'Check and add to preview'}</button>{editingId && <button type="button" className="button button-outline" onClick={() => { setEditingId(null); setValues(blank()); setErrors({}); setConflicts([]); }}>Stop editing</button>}</div>
    </form>
   </section>
  </div>
 </main>;
}
