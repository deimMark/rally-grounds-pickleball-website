'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, ShieldCheck, Map, List } from 'lucide-react';
import { CourtMap } from '@/components/public/court-map';
import { DemoBadge } from '@/components/ui/demo-notice';
import { getCourtStatus, formatMoney } from '@/lib/domain/demo-availability';
import { bookingDemo, bookingCourts, demoSessionSlots, demoSelection, demoDayLabel } from '@/lib/demo/booking';
import { demoClub, demoDays } from '@/lib/demo/club';
const labels={available:'Available',reserved:'Reserved','open-play':'Open play',maintenance:'Maintenance',closed:'Outside demo hours'};
export function BookingWorkflow(){
 const router=useRouter(),heading=useRef(null);
 const [day,setDay]=useState(demoDays[0].id),[duration,setDuration]=useState(60),[court,setCourt]=useState(bookingCourts[0].id),[start,setStart]=useState(''),[view,setView]=useState('map');
 const [step,setStep]=useState('session'),[profile,setProfile]=useState('alex'),[players,setPlayers]=useState('4'),[accepted,setAccepted]=useState(false),[pending,setPending]=useState(false);
 const slots=demoSessionSlots(day,court,duration),chosen=bookingCourts.find(c=>c.id===court),guest=bookingDemo.profiles.find(p=>p.id===profile);
 const selection=demoSelection({day,court,start,duration:String(duration),players});
 function reset(){setStart('');setAccepted(false);}
 function changeStep(next){setStep(next);setTimeout(()=>heading.current?.focus(),0);}
 async function submit(event){event.preventDefault();if(!selection||!accepted||pending)return;setPending(true);await new Promise(resolve=>setTimeout(resolve,250));const params=new URLSearchParams({day,court,start,duration:String(duration),players});router.push(`/booking/confirmation?${params}`);}
 return <main id="main-content" className="booking-page"><div className="container">
  <div className="booking-intro"><p className="eyebrow"><CalendarDays size={15} aria-hidden="true"/>MAKE TIME FOR A GOOD GAME</p><h1>Find your next rally.</h1><p>A court for your crew. A little room for friendly competition.</p><DemoBadge>BOOKING DEMONSTRATION</DemoBadge><p className="booking-disclosure">Synthetic availability and profiles only. No court is reserved, no personal information is collected, and no payment is accepted.</p></div>
  <ol className="booking-steps" aria-label="Booking preview steps"><li aria-current={step==='session'?'step':undefined}><span>01</span> Choose a session</li><li aria-current={step==='details'?'step':undefined}><span>02</span> Demo details</li><li><span>03</span> Preview</li></ol>
  <h2 ref={heading} tabIndex={-1} className="booking-step-title">{step==='session'?'Choose your court and session':'Your crew, your session'}</h2>
  <div className="booking-grid"><section className="booking-panel" aria-label={step==='session'?'Session selection':'Demo booking details'}>
   {step==='session'?<><div className="booking-fields"><label className="field-label">Demo date<select value={day} onChange={e=>{setDay(e.target.value);reset();}}>{demoDays.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><label className="field-label">Session duration<select value={duration} onChange={e=>{setDuration(Number(e.target.value));reset();}}>{bookingDemo.durations.map(d=><option key={d} value={d}>{d/60} {d===60?'hour':'hours'}</option>)}</select></label></div>
    <div className="booking-map-toolbar"><span>All times in Asia/Manila</span><div className="view-switch" role="group" aria-label="Booking court view"><button onClick={()=>setView('map')} aria-pressed={view==='map'}><Map size={15} aria-hidden="true"/>Map</button><button onClick={()=>setView('list')} aria-pressed={view==='list'}><List size={15} aria-hidden="true"/>List</button></div></div>
    <div className="booking-map court-map-panel"><CourtMap club={demoClub} courts={bookingCourts} selectedCourtId={court} onSelect={id=>{setCourt(id);reset();}} getStatus={c=>getCourtStatus(demoSessionSlots(day,c.id,duration).filter(s=>s.status!=='closed'))} view={view}/><div className="map-legend"><span><i className="legend-dot available"/>Available</span><span><i className="legend-dot reserved"/>Reserved</span><span><i className="legend-dot open-play"/>Open play</span></div></div>
    <fieldset className="booking-slots"><legend>Court {chosen.number} · Start time</legend><p>Availability checks the full {duration/60}-hour sample session.</p><div className="time-slots">{slots.map(s=><button key={s.id} disabled={s.status!=='available'} aria-pressed={s.id===start} className={s.id===start?'chosen':''} onClick={()=>setStart(s.id)}><span>{s.label}</span><small>{labels[s.status]}</small></button>)}</div>{!slots.some(s=>s.status==='available')&&<p className="booking-empty" role="status">No sample sessions match. Try another court, duration or demo day.</p>}</fieldset>
    <button className="button button-navy booking-next" disabled={!selection} onClick={()=>changeStep('details')}>Review demo details <ArrowRight size={17} aria-hidden="true"/></button>
   </>:<form onSubmit={submit}>
    <button type="button" className="text-link booking-back" onClick={()=>changeStep('session')}><ArrowLeft size={16} aria-hidden="true"/>Change session</button>
    <p className="booking-review-session"><strong>Court {chosen.number} · {selection?.slot.label} – {selection?.slot.endLabel}</strong><br/>{demoDayLabel(day)} · Asia/Manila</p>
    <div className="booking-safe-note"><ShieldCheck size={20} aria-hidden="true"/><p>Use a fictional profile to explore the form. Real contact collection is disabled.</p></div>
    <label className="field-label">Synthetic guest profile<select value={profile} onChange={e=>setProfile(e.target.value)}>{bookingDemo.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="booking-fields"><label className="field-label">Guest name<input readOnly value={guest.name}/></label><label className="field-label">Demo email<input type="email" readOnly value={guest.contact.value}/></label></div>
    <label className="field-label">Estimated players<select value={players} onChange={e=>setPlayers(e.target.value)}>{bookingDemo.playerOptions.map(n=><option key={n} value={n}>{n} {n===1?'player':'players'}</option>)}</select></label><p className="booking-helper">Sample player counts only. Owner-approved capacity limits are still pending.</p>
    <div className="booking-terms"><h3>Before your next real rally</h3><p>Pricing, opening hours, payment deadlines, cancellation and rescheduling terms require owner approval. This preview is not an agreement or a confirmed reservation.</p></div>
    <label className="booking-consent"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I understand this creates a demonstration only, with no court reservation or payment.</span></label>
    <button className="button button-navy booking-next" type="submit" disabled={!accepted||pending} aria-busy={pending}>{pending?'Preparing demo preview…':'Create demo preview'}<ArrowRight size={17} aria-hidden="true"/></button><div role="status" className="booking-helper">{pending?'Preparing synthetic confirmation. No reservation request is being sent.':''}</div>
   </form>}
  </section><aside className="booking-summary" aria-label="Demo price summary"><DemoBadge>YOUR SAMPLE SESSION</DemoBadge><h2>Court {chosen.number}</h2><p>{demoDayLabel(day)}</p><dl><div><dt><Clock3 size={15} aria-hidden="true"/> Session</dt><dd>{selection?`${selection.slot.label} – ${selection.slot.endLabel}`:'Choose a start time'}</dd></div><div><dt>Duration</dt><dd>{duration/60} {duration===60?'hour':'hours'}</dd></div><div><dt>Illustrative hourly rate</dt><dd>{formatMoney(bookingDemo.rateCentavos)}</dd></div><div className="booking-total"><dt>Demo total</dt><dd>{formatMoney(bookingDemo.rateCentavos*duration/60)}</dd></div></dl><p className="booking-helper">Illustrative calculation only, not a live quote. No amount is due.</p><div className="booking-summary-note"><ShieldCheck size={18} aria-hidden="true"/><span>Guest booking concept.<br/>No customer account required.</span></div><p className="booking-helper">{demoClub.hoursLabel} · provisional operating hours, pending owner confirmation.</p></aside></div>
 </div></main>;
}
