import { demoClub, demoCourts, demoDays, demoAvailability } from './club';
// Explicit presentation fixtures, not published commercial policy or API authority.
export const bookingDemo = {
 timezone: demoClub.timezone, rateCentavos: demoClub.rateCentavos,
 durations: [60,120,180], playerOptions: [1,2,3,4,5,6,7,8], startHour:8,endHour:23,
 // Sample grouping of start times for presentation only; not opening-hour policy.
 periods:[{id:'morning',label:'Morning',from:8,to:12},{id:'afternoon',label:'Afternoon',from:12,to:17},{id:'evening',label:'Evening',from:17,to:23}],
 profiles:[{id:'alex',name:'Alex Demo',contact:{kind:'email',value:'alex@example.invalid'}},{id:'jamie',name:'Jamie Demo',contact:{kind:'email',value:'jamie@example.invalid'}}],
 observedAt:'2026-11-03T00:30:00.000Z',createdAt:'2026-11-03T00:00:00.000Z',expiresAt:'2026-11-03T02:00:00.000Z',
 intentId:'00000000-0000-4000-8000-000000000100',quoteId:'00000000-0000-4000-8000-000000000200',reference:'00000000-0000-4000-8000-000000000300',
};
export const bookingCourts=demoCourts.map(c=>({...c,apiId:`00000000-0000-4000-8000-${String(c.number).padStart(12,'0')}`}));
// Plain-language layout description for assistive technology; mirrors the approved geometry.
export const courtLayoutDescription='Five courts. Courts 3, 4 and 5 stand side by side across the top, each in portrait orientation. Courts 2 and 1 lie below them in landscape orientation, stacked on the right so their right edges line up with Court 5.';
export const slotStatusLabels={available:'Available',reserved:'Reserved','open-play':'Open play',maintenance:'Maintenance',closed:'Outside demo hours'};
// Why a sample start cannot be chosen. Shown beside each unavailable slot and in the summary.
export const slotReasons={reserved:'Reserved in this sample',  'open-play':'Open-play block in this sample', maintenance:'Sample maintenance closure', closed:'Would end after the demo closing time'};
export function demoHour(hour){const normalized=((hour%24)+24)%24;return `${normalized%12||12}:00 ${normalized<12?'AM':'PM'}`;}
export function demoDayLabel(day){return new Intl.DateTimeFormat('en-PH',{dateStyle:'full',timeZone:bookingDemo.timezone}).format(new Date(`${day}T00:00:00+08:00`));}
// Formats a UTC instant as a club-local (Asia/Manila) date and time, independent of the browser timezone.
export function formatManila(iso){const date=new Date(iso);if(Number.isNaN(date.getTime()))return '';return new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:bookingDemo.timezone}).format(date);}
// Accepts only canonical non-negative decimal integers ("120", not "0120", "+120", "1e2" or " 120").
export function canonicalInteger(value){if(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value))return null;return Number(value);}
export function demoSessionSlots(day,courtId,durationMinutes){
 if(!demoDays.some(d=>d.id===day)||!bookingCourts.some(c=>c.id===courtId)||!bookingDemo.durations.includes(durationMinutes))return [];
 const sample=demoAvailability[day][courtId];
 const statusAt=hour=>sample.every(s=>s.status==='open-play')?'open-play':sample.every(s=>s.status==='reserved')?'reserved':sample.find(s=>s.id===`${String(hour).padStart(2,'0')}:00`)?.status??(hour===12?'maintenance':'available');
 return Array.from({length:bookingDemo.endHour-bookingDemo.startHour},(_,i)=>{
  const hour=i+bookingDemo.startHour,end=hour+durationMinutes/60;
  const statuses=Array.from({length:durationMinutes/60},(_,n)=>statusAt(hour+n));
  const status=end>bookingDemo.endHour?'closed':statuses.find(s=>s!=='available')??'available';
  return {id:`${String(hour).padStart(2,'0')}:00`,hour,label:demoHour(hour),endLabel:demoHour(end),status};
 });
}
// Groups slots into the sample periods, preserving order; empty periods are omitted.
export function demoSlotGroups(slots){
 return bookingDemo.periods.map(period=>({...period,slots:slots.filter(s=>s.hour>=period.from&&s.hour<period.to)})).filter(group=>group.slots.length);
}
// Counts for the summary sentence and list-view detail: how many sample starts fit the session.
export function demoAvailabilitySummary(slots){
 const counts={available:0,reserved:0,'open-play':0,maintenance:0,closed:0};
 for(const slot of slots)counts[slot.status]=(counts[slot.status]??0)+1;
 return {available:counts.available,total:slots.length,counts};
}
export function describeAvailability(slots,durationMinutes){
 const {available,total,counts}=demoAvailabilitySummary(slots);
 const hours=durationMinutes/60,session=`${hours}-hour`;
 if(!total)return 'No sample starts for this selection.';
 const reasons=Object.entries(counts).filter(([status,count])=>status!=='available'&&count).map(([status,count])=>`${count} ${slotStatusLabels[status].toLowerCase()}`);
 return `${available} of ${total} sample starts fit a ${session} session${reasons.length?` (${reasons.join(', ')})`:''}.`;
}
export function demoSelection(input){
 const court=bookingCourts.find(c=>c.id===input.court),day=demoDays.find(d=>d.id===input.day);
 const duration=canonicalInteger(input.duration),players=canonicalInteger(input.players);
 if(duration===null||players===null||typeof input.start!=='string')return null;
 const slot=demoSessionSlots(input.day,input.court,duration).find(s=>s.id===input.start&&s.status==='available');
 if(!court||!day||!slot||!bookingDemo.playerOptions.includes(players))return null;
 const startsAt=new Date(`${day.id}T${slot.id}:00+08:00`).toISOString();
 const quote={quoteId:bookingDemo.quoteId,courtId:court.apiId,startsAt,endsAt:new Date(Date.parse(startsAt)+duration*60000).toISOString(),durationMinutes:duration,totalCentavos:bookingDemo.rateCentavos*duration/60,currency:'PHP',terms:{demo:true,policyApprovalPending:true},versionContext:{demo:'presentation-v1'},validUntil:bookingDemo.expiresAt};
 return {court,day,slot,players,quote};
}
export function demoReceipt(selection,status='held'){
 return {receipt:{reference:bookingDemo.reference,createdAt:bookingDemo.createdAt,totalCentavos:selection.quote.totalCentavos,currency:'PHP',expiresAt:bookingDemo.expiresAt,stateAtCreation:'held'},current:{status:['held','expired','cancelled'].includes(status)?status:'held',expiresAt:bookingDemo.expiresAt,observedAt:status==='expired'?'2026-11-03T02:01:00.000Z':bookingDemo.observedAt},replayed:false};
}
