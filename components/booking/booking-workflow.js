'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, ShieldCheck, Map, List, AlertCircle } from 'lucide-react';
import { CourtMap } from '@/components/public/court-map';
import { DemoBadge } from '@/components/ui/demo-notice';
import { getCourtStatus, formatMoney } from '@/lib/domain/demo-availability';
import { bookingDemo, bookingCourts, demoSessionSlots, demoSelection, demoDayLabel, demoSlotGroups, describeAvailability, demoAvailabilitySummary, slotStatusLabels, slotReasons } from '@/lib/demo/booking';
import { demoClub, demoDays } from '@/lib/demo/club';

const consentMessage = 'Tick the box to confirm you understand this is a demonstration only. No court is reserved and no payment is taken.';

export function BookingWorkflow(){
 const router=useRouter(),heading=useRef(null),consent=useRef(null);
 const [day,setDay]=useState(demoDays[0].id),[duration,setDuration]=useState(60),[court,setCourt]=useState(bookingCourts[0].id),[start,setStart]=useState(''),[view,setView]=useState('map');
 const [step,setStep]=useState('session'),[profile,setProfile]=useState('alex'),[players,setPlayers]=useState('4'),[accepted,setAccepted]=useState(false),[pending,setPending]=useState(false);
 const [notice,setNotice]=useState(''),[consentError,setConsentError]=useState('');
 const slots=demoSessionSlots(day,court,duration),groups=demoSlotGroups(slots),chosen=bookingCourts.find(c=>c.id===court),guest=bookingDemo.profiles.find(p=>p.id===profile);
 const selection=demoSelection({day,court,start,duration:String(duration),players});
 const summary=demoAvailabilitySummary(slots);
 const sessionLabel=selection?`${selection.slot.label} – ${selection.slot.endLabel}`:'';
 const total=bookingDemo.rateCentavos*duration/60;
 // Clear a chosen start when the inputs it depended on change, and say so once.
 function reset(reason){setAccepted(false);setConsentError('');if(start){setStart('');setNotice(`Start time cleared because the ${reason} changed. Choose a new start time.`);}else setNotice('');}
 function changeStep(next){setStep(next);setConsentError('');setNotice('');}
 // Move focus to the step heading after a step change, never on first render.
 const mounted=useRef(false);
 useEffect(()=>{if(mounted.current)heading.current?.focus();else mounted.current=true;},[step]);
 function submit(event){
  event.preventDefault();
  if(!selection||pending)return;
  if(!accepted){setConsentError(consentMessage);consent.current?.focus();return;}
  setPending(true);
  const params=new URLSearchParams({day,court,start,duration:String(duration),players});
  router.push(`/booking/confirmation?${params}`);
 }
 const courtSlots=c=>demoSessionSlots(day,c.id,duration).filter(s=>s.status!=='closed');
 return <main id="main-content" className="booking-page"><div className="container">
  <div className="booking-intro"><p className="eyebrow"><CalendarDays size={15} aria-hidden="true"/>MAKE TIME FOR A GOOD GAME</p><h1>Find your next rally.</h1><p>A court for your crew. A little room for friendly competition.</p><DemoBadge>BOOKING DEMONSTRATION</DemoBadge><p className="booking-disclosure">Synthetic availability and profiles only. No court is reserved, no personal information is collected, and no payment is accepted.</p></div>
  <ol className="booking-steps" aria-label="Booking preview steps"><li aria-current={step==='session'?'step':undefined}><span>01</span> Choose a session</li><li aria-current={step==='details'?'step':undefined}><span>02</span> Demo details</li><li><span>03</span> Preview</li></ol>
  <h2 ref={heading} tabIndex={-1} className="booking-step-title">{step==='session'?'Choose your court and session':'Your crew, your session'}</h2>
  <div role="status" aria-live="polite" className="booking-notice-region">{notice&&<p className="booking-notice"><AlertCircle size={16} aria-hidden="true"/>{notice}</p>}</div>
  <div className="booking-grid"><section className="booking-panel" aria-label={step==='session'?'Session selection':'Demo booking details'}>
   {step==='session'?<><div className="booking-fields"><label className="field-label">Demo date<select value={day} onChange={e=>{setDay(e.target.value);reset('demo date');}}>{demoDays.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><label className="field-label">Session duration<select value={duration} onChange={e=>{setDuration(Number(e.target.value));reset('session duration');}}>{bookingDemo.durations.map(d=><option key={d} value={d}>{d/60} {d===60?'hour':'hours'}</option>)}</select></label></div>
    <div className="booking-map-toolbar"><span>All times in Asia/Manila</span><div className="view-switch" role="group" aria-label="Booking court view"><button onClick={()=>setView('map')} aria-pressed={view==='map'}><Map size={15} aria-hidden="true"/>Map</button><button onClick={()=>setView('list')} aria-pressed={view==='list'}><List size={15} aria-hidden="true"/>List</button></div></div>
    <div className="booking-map court-map-panel"><CourtMap club={demoClub} courts={bookingCourts} selectedCourtId={court} onSelect={id=>{setCourt(id);reset('court');}} getStatus={c=>getCourtStatus(courtSlots(c))} getDetail={c=>{const s=demoAvailabilitySummary(demoSessionSlots(day,c.id,duration));return `${s.available} of ${s.total} sample starts`;}} view={view}/><div className="map-legend"><span><i className="legend-dot available"/>Available</span><span><i className="legend-dot reserved"/>Reserved</span><span><i className="legend-dot open-play"/>Open play</span></div><p className="booking-helper booking-map-note">Each court also shows its status in words; the list view adds how many sample starts fit your session.</p></div>
    <fieldset className="booking-slots" aria-describedby="slot-summary"><legend>Court {chosen.number} · Start time</legend><p id="slot-summary">Availability checks the full {duration/60}-hour sample session. {describeAvailability(slots,duration)}</p>
     {groups.map(group=><div key={group.id} className="slot-group" role="group" aria-labelledby={`slot-group-${group.id}`}><h3 id={`slot-group-${group.id}`} className="slot-group-title">{group.label}</h3><div className="time-slots">{group.slots.map(s=>{const unavailable=s.status!=='available',reasonId=`slot-reason-${s.id.replace(':','')}`;
      // The reason sits beside the button as its accessible description, so the button's name stays "8:00 AM Available".
      return <div key={s.id} className={`slot ${unavailable?'unavailable':''}`}><button type="button" disabled={unavailable} aria-pressed={s.id===start} aria-describedby={reasonId} className={s.id===start?'chosen':''} onClick={()=>{setStart(s.id);setNotice('');}}><span>{s.label}</span><small>{slotStatusLabels[s.status]}</small></button><small id={reasonId} className="slot-reason">{unavailable?slotReasons[s.status]:`Ends ${s.endLabel}`}</small></div>;})}</div></div>)}
     {!summary.available&&<p className="booking-empty" role="status">No sample sessions match. Try another court, duration or demo day.</p>}
    </fieldset>
    <button className="button button-navy booking-next" disabled={!selection} aria-describedby="next-hint" onClick={()=>changeStep('details')}>Review demo details <ArrowRight size={17} aria-hidden="true"/></button>
    <p id="next-hint" className="booking-helper">{selection?`Continue with Court ${chosen.number}, ${sessionLabel}.`:'Choose an available start time above to continue.'}</p>
   </>:<form onSubmit={submit} noValidate>
    <button type="button" className="text-link booking-back" onClick={()=>changeStep('session')}><ArrowLeft size={16} aria-hidden="true"/>Change session</button>
    <p className="booking-review-session"><strong>Court {chosen.number} · {sessionLabel}</strong><br/>{demoDayLabel(day)} · Asia/Manila</p>
    <div className="booking-safe-note"><ShieldCheck size={20} aria-hidden="true"/><p>Use a fictional profile to explore the form. Real contact collection is disabled.</p></div>
    <label className="field-label">Synthetic guest profile<select value={profile} onChange={e=>setProfile(e.target.value)}>{bookingDemo.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="booking-fields"><label className="field-label">Guest name<input readOnly value={guest.name}/></label><label className="field-label">Demo email<input type="email" readOnly value={guest.contact.value}/></label></div>
    <label className="field-label">Estimated players<select value={players} onChange={e=>setPlayers(e.target.value)}>{bookingDemo.playerOptions.map(n=><option key={n} value={n}>{n} {n===1?'player':'players'}</option>)}</select></label><p className="booking-helper">Sample player counts only. Owner-approved capacity limits are still pending.</p>
    <div className="booking-terms"><h3>Before your next real rally</h3><p>Pricing, opening hours, payment deadlines, cancellation and rescheduling terms require owner approval. This preview is not an agreement or a confirmed reservation.</p></div>
    <div className={consentError?'booking-consent-field invalid':'booking-consent-field'}>
     <label className="booking-consent"><input ref={consent} type="checkbox" checked={accepted} aria-invalid={consentError?'true':undefined} aria-describedby={consentError?'consent-error':undefined} onChange={e=>{setAccepted(e.target.checked);if(e.target.checked)setConsentError('');}}/><span>I understand this creates a demonstration only, with no court reservation or payment.</span></label>
     {consentError&&<p id="consent-error" className="booking-error" role="alert"><AlertCircle size={16} aria-hidden="true"/>{consentError}</p>}
    </div>
    <button className="button button-navy booking-next" type="submit" disabled={pending} aria-busy={pending}>{pending?'Opening demo preview…':'Create demo preview'}<ArrowRight size={17} aria-hidden="true"/></button><p className="booking-helper">Opens a synthetic confirmation. No reservation request is sent.</p>
   </form>}
  </section><aside id="booking-summary" className="booking-summary" aria-label="Demo price summary"><DemoBadge>YOUR SAMPLE SESSION</DemoBadge><h2>Court {chosen.number}</h2><p>{demoDayLabel(day)}</p><dl><div><dt><Clock3 size={15} aria-hidden="true"/> Session</dt><dd>{selection?sessionLabel:'Choose a start time'}</dd></div><div><dt>Duration</dt><dd>{duration/60} {duration===60?'hour':'hours'}</dd></div><div><dt>Illustrative hourly rate</dt><dd>{formatMoney(bookingDemo.rateCentavos)}</dd></div><div className="booking-total"><dt>Demo total</dt><dd>{formatMoney(total)}</dd></div></dl><p className="booking-helper">Illustrative calculation only, not a live quote. No amount is due.</p><div className="booking-summary-note"><ShieldCheck size={18} aria-hidden="true"/><span>Guest booking concept.<br/>No customer account required.</span></div><p className="booking-helper">{demoClub.hoursLabel} · provisional operating hours, pending owner confirmation.</p></aside></div>
  <section className="booking-compact-summary" aria-label="Compact sample session summary"><span><strong>Court {chosen.number}</strong> · {selection?sessionLabel:'No start time yet'}</span><span className="booking-compact-total"><strong>{formatMoney(total)}</strong> demo total · <a href="#booking-summary">Full summary</a></span></section>
 </div></main>;
}
