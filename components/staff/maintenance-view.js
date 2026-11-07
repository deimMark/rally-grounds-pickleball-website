'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { staffClock, staffCourts, courtNumber, clubInstant } from '@/lib/demo/staff';
import { scheduleItems, findConflicts, dayLabel, rangeLabel, clubParts } from '@/lib/demo/staff-schedule';
import { StaffPageIntro, ConfirmBox } from './staff-page-intro';
import { useStaffDemo, SimulationNotice } from './staff-demo-context';
import { TimeFields, AffectedSchedule, ConflictWarning, validateTimes } from './occupancy-tools';

const blank = () => ({ court: 'court-1', date: staffClock.today, start: '12', end: '14', reason: '' });

export function MaintenanceView() {
 const { data, dispatch } = useStaffDemo();
 const items = useMemo(() => scheduleItems(data), [data]);
 const [values, setValues] = useState(blank);
 const [errors, setErrors] = useState({});
 const [review, setReview] = useState(null);
 const [cancelling, setCancelling] = useState(null);
 // Focus is moved by element id after render (validation errors and review results).
 const [focusTarget, setFocusTarget] = useState(null);
 useEffect(() => { if (focusTarget) document.getElementById(focusTarget.id)?.focus(); }, [focusTarget]);
 // Any change invalidates the previous review, so a stale "no conflicts" result is never reused.
 const change = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setReview(null); };
 const candidate = { startsAt: clubInstant(values.date, Number(values.start)), endsAt: clubInstant(values.date, Number(values.end)) };

 function check(event) {
  event.preventDefault();
  const next = validateTimes(values);
  if (!values.reason.trim()) next.reason = 'Enter a fictional maintenance reason.';
  else if (values.reason.trim().length > 120) next.reason = 'Keep the reason to 120 characters or fewer.';
  setErrors(next);
  if (Object.keys(next).length) { setReview(null); setFocusTarget((previous) => ({ id: next.end ? 'mc-end' : 'mc-reason', n: (previous?.n ?? 0) + 1 })); return; }
  const conflicts = findConflicts({ courtIds: [values.court], ...candidate }, items);
  setReview({ conflicts });
  setFocusTarget((previous) => ({ id: conflicts.length ? 'mc-conflict' : 'mc-review-ok', n: (previous?.n ?? 0) + 1 }));
 }
 function create() {
  const closure = { courtId: values.court, ...candidate, reason: values.reason.trim().startsWith('Fictional') ? values.reason.trim() : `Fictional: ${values.reason.trim()}` };
  dispatch({ type: 'closure-add', closure, message: `Closure previewed on Court ${courtNumber(values.court)}, ${dayLabel(values.date)} ${rangeLabel(candidate.startsAt, candidate.endsAt)}. It blocks the court in this tab only.` });
  setValues(blank()); setReview(null);
 }
 const errorCount = Object.keys(errors).length;
 const closures = [...data.closures].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

 return <main id="main-content" className="dashboard-main">
  <StaffPageIntro crumb="Maintenance" eyebrow="COURT CLOSURES" title="Maintenance and closures" description="Review the affected schedule before a closure. Overlapping bookings or open play are reported, never displaced." />
  <div className="staff-split">
   <section className="dashboard-panel" aria-labelledby="closures-heading">
    <p className="eyebrow">SAMPLE CLOSURES</p><h2 id="closures-heading">Scheduled closures</h2>
    <SimulationNotice />
    {closures.length === 0 ? <p className="staff-empty">No closures in the sample data. Use the form to preview one.</p> : <ul className="event-list">{closures.map((closure) => <li key={closure.id} className="event-card"><div className="event-card-head"><h3>Court {courtNumber(closure.courtId)} · {dayLabel(clubParts(closure.startsAt).dateKey)}</h3>{closure.simulated && <strong className="simulated-tag">Simulated</strong>}</div>
     <dl className="staff-dl"><div><dt>Time</dt><dd>{rangeLabel(closure.startsAt, closure.endsAt)}</dd></div><div><dt>Reason</dt><dd>{closure.reason}</dd></div><div><dt>Reference</dt><dd>{closure.id}</dd></div></dl>
     <button type="button" className="button button-outline" onClick={() => setCancelling(closure)}><XCircle size={15} aria-hidden="true" />Cancel closure<span className="sr-only"> {closure.id}</span></button>
     {cancelling?.id === closure.id && <ConfirmBox id={`cancel-${closure.id}`} prompt={`Simulate cancelling closure ${closure.id}? Court ${courtNumber(closure.courtId)} would show as free in this tab only.`} confirmLabel="Confirm simulated cancellation" cancelLabel="Keep closure" onConfirm={() => { dispatch({ type: 'closure-cancel', id: closure.id, message: `Closure ${closure.id} cancelled in this preview. Nothing was saved.` }); setCancelling(null); }} onCancel={() => setCancelling(null)} />}
    </li>)}</ul>}
   </section>

   <section className="dashboard-panel" aria-labelledby="mc-form-heading">
    <p className="eyebrow">NEW CLOSURE (SIMULATED)</p><h2 id="mc-form-heading">Preview a court closure</h2>
    <form onSubmit={check} noValidate className="staff-form">
     {errorCount > 0 && <p className="booking-error" role="alert"><AlertCircle size={16} aria-hidden="true" />Fix {errorCount} {errorCount === 1 ? 'field' : 'fields'} before reviewing the closure.</p>}
     <label className="filter-label" htmlFor="mc-court">Court<select id="mc-court" value={values.court} onChange={(e) => change('court', e.target.value)}>{staffCourts.map((court) => <option key={court.id} value={court.id}>Court {court.number}</option>)}</select></label>
     <TimeFields idPrefix="mc" values={values} onChange={change} errors={errors} />
     <label className="filter-label" htmlFor="mc-reason">Maintenance reason (fictional)<input id="mc-reason" value={values.reason} maxLength={120} aria-invalid={errors.reason ? 'true' : undefined} aria-describedby={errors.reason ? 'mc-reason-error' : 'mc-reason-help'} onChange={(e) => change('reason', e.target.value)} /><span id="mc-reason-help" className="booking-helper">For example “surface sweep”. Kept in memory only.</span>{errors.reason && <span id="mc-reason-error" className="field-error">{errors.reason}</span>}</label>
     <AffectedSchedule items={items} dateKey={values.date} courtIds={[values.court]} candidate={Number(values.end) > Number(values.start) ? candidate : null} />
     {review?.conflicts.length > 0 && <ConflictWarning id="mc-conflict" conflicts={review.conflicts} subject="closure" />}
     {review && review.conflicts.length === 0 && <p id="mc-review-ok" tabIndex={-1} role="status" className="review-ok"><CheckCircle2 size={18} aria-hidden="true" />No conflicts on Court {courtNumber(values.court)} for {dayLabel(values.date)} {rangeLabel(candidate.startsAt, candidate.endsAt)}. You can create the simulated closure.</p>}
     <div className="payment-preview-actions"><button type="submit" className="button button-outline">Review affected schedule</button><button type="button" className="button button-navy" disabled={!review || review.conflicts.length > 0} aria-describedby="mc-create-help" onClick={create}>Create simulated closure</button></div>
     <p id="mc-create-help" className="booking-helper">Available only after a review with no conflicts. Changing any field requires a new review.</p>
    </form>
   </section>
  </div>
 </main>;
}
