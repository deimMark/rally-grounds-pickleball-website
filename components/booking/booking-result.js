'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Check, ArrowRight, ArrowLeft, LockKeyhole, Info } from 'lucide-react';
import { DemoBadge } from '@/components/ui/demo-notice';
import { formatMoney } from '@/lib/domain/demo-availability';
import { demoDayLabel, demoReceipt } from '@/lib/demo/booking';
const states={held:{title:'Sample unpaid hold',text:'A real request would create an unpaid hold, not a paid or guaranteed reservation.'},expired:{title:'Sample hold expired',text:'An expired hold would no longer reserve a court. A retry must not restart its deadline.'},cancelled:{title:'Sample reservation cancelled',text:'A cancelled reservation would remain cancelled. Its original receipt would be kept unchanged.'}};
export function BookingResult({selection,privateStatus=false,query=''}){
 const [status,setStatus]=useState('held');
 const {receipt,current}=demoReceipt(selection,status),state=states[current.status];
 return <main id="main-content" className="booking-page"><div className="container booking-result-wrap">
  <Link href="/book" className="text-link booking-back"><ArrowLeft size={16} aria-hidden="true"/>Back to booking demo</Link>
  <div className="booking-result-heading"><span className="booking-result-icon">{privateStatus?<LockKeyhole size={29} aria-hidden="true"/>:<Check size={32} aria-hidden="true"/>}</span><DemoBadge>DEMONSTRATION ONLY</DemoBadge><h1>{privateStatus?'Your private-status preview':'Your rally, imagined.'}</h1><p>{privateStatus?'A design preview of one reservation’s private status.':'Your demo confirmation is ready. No court has been reserved.'}</p></div>
  <div className="booking-grid booking-result-grid"><section className="booking-panel"><span className={`booking-state ${status}`}>{state.title}</span><h2>Court {selection.court.number}</h2><p className="booking-result-date">{demoDayLabel(selection.day.id)}</p><div className="booking-result-time">{selection.slot.label} – {selection.slot.endLabel}<small>Asia/Manila · {selection.quote.durationMinutes/60}-hour demo session</small></div>
   <dl className="booking-receipt"><div><dt>Demo reference</dt><dd>{receipt.reference}</dd></div><div><dt>Estimated players</dt><dd>{selection.players}</dd></div><div><dt>Original demo total</dt><dd>{formatMoney(receipt.totalCentavos)}</dd></div><div><dt>Receipt state at creation</dt><dd>Unpaid hold (demo)</dd></div><div><dt>Current demo status</dt><dd>{state.title}</dd></div></dl>
   <div className="booking-safe-note"><Info size={19} aria-hidden="true"/><p role="status">{state.text} These states are fictional; nothing is being held, charged or changed.</p></div>
   {privateStatus&&<label className="field-label">Choose a demo status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="held">Unpaid hold</option><option value="expired">Expired hold</option><option value="cancelled">Cancelled reservation</option></select></label>}
   {!privateStatus&&<Link href={`/booking/status?${query}`} className="button button-navy booking-next">View demo private status <ArrowRight size={17} aria-hidden="true"/></Link>}
  </section><aside className="booking-summary"><LockKeyhole size={24} aria-hidden="true"/><h2>{privateStatus?'Private by design.':'What would happen next?'}</h2><p>No payment is due. GCash collection, screenshots and verification are unavailable in this demonstration.</p><div className="booking-terms"><h3>A reference is not a key</h3><p>Real reservation access will require private authorization. A reference, email or phone number alone will never grant access.</p></div><p className="booking-helper">This public demo contains synthetic data only and is not an authenticated booking system. No private credentials are issued or stored.</p><Link href="/booking/status" className="text-link booking-back">Preview unavailable access <ArrowRight size={15} aria-hidden="true"/></Link></aside></div>
 </div></main>;
}
export function BookingAccessUnavailable({confirmation=false}){
 return <main id="main-content" className="booking-page"><div className="container booking-empty-page"><LockKeyhole size={32} aria-hidden="true"/><DemoBadge>DEMO DESIGN STATE</DemoBadge><h1>{confirmation?'Session preview unavailable':'Private access required'}</h1><p>{confirmation?'This sample link is incomplete or the selected interval is not available in the demo. Choose a new sample session.':'No authorized reservation is attached to this demonstration page. Real access will require a private authorization, not a booking reference.'}</p><p className="booking-helper">No customer record was searched or retrieved. Live booking and account recovery are not available.</p><Link href="/book" className="button button-navy">Explore the booking demo <ArrowRight size={16} aria-hidden="true"/></Link></div></main>;
}
