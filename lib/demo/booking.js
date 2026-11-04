import { demoClub, demoCourts, demoDays, demoAvailability } from './club';
// Explicit presentation fixtures, not published commercial policy or API authority.
export const bookingDemo = {
 timezone: demoClub.timezone, rateCentavos: demoClub.rateCentavos,
 durations: [60,120,180], playerOptions: [1,2,3,4,5,6,7,8], startHour:8,endHour:23,
 profiles:[{id:'alex',name:'Alex Demo',contact:{kind:'email',value:'alex@example.invalid'}},{id:'jamie',name:'Jamie Demo',contact:{kind:'email',value:'jamie@example.invalid'}}],
 observedAt:'2026-11-03T00:30:00.000Z',createdAt:'2026-11-03T00:00:00.000Z',expiresAt:'2026-11-03T02:00:00.000Z',
 intentId:'00000000-0000-4000-8000-000000000100',quoteId:'00000000-0000-4000-8000-000000000200',reference:'00000000-0000-4000-8000-000000000300',
};
export const bookingCourts=demoCourts.map(c=>({...c,apiId:`00000000-0000-4000-8000-${String(c.number).padStart(12,'0')}`}));
export function demoHour(hour){const normalized=((hour%24)+24)%24;return `${normalized%12||12}:00 ${normalized<12?'AM':'PM'}`;}
export function demoDayLabel(day){return new Intl.DateTimeFormat('en-PH',{dateStyle:'full',timeZone:bookingDemo.timezone}).format(new Date(`${day}T00:00:00+08:00`));}
export function demoSessionSlots(day,courtId,durationMinutes){
 if(!demoDays.some(d=>d.id===day)||!bookingCourts.some(c=>c.id===courtId)||!bookingDemo.durations.includes(durationMinutes))return [];
 const sample=demoAvailability[day][courtId];
 const statusAt=hour=>sample.every(s=>s.status==='open-play')?'open-play':sample.every(s=>s.status==='reserved')?'reserved':sample.find(s=>s.id===`${String(hour).padStart(2,'0')}:00`)?.status??(hour===12?'maintenance':'available');
 return Array.from({length:bookingDemo.endHour-bookingDemo.startHour},(_,i)=>{
  const hour=i+bookingDemo.startHour,end=hour+durationMinutes/60;
  const statuses=Array.from({length:durationMinutes/60},(_,n)=>statusAt(hour+n));
  const status=end>bookingDemo.endHour?'closed':statuses.find(s=>s!=='available')??'available';
  return {id:`${String(hour).padStart(2,'0')}:00`,label:demoHour(hour),endLabel:demoHour(end),status};
 });
}
export function demoSelection(input){
 const court=bookingCourts.find(c=>c.id===input.court),day=demoDays.find(d=>d.id===input.day);
 if(typeof input.duration!=='string'||!/^\d+$/.test(input.duration)||typeof input.players!=='string'||!/^\d+$/.test(input.players))return null;
 const duration=Number(input.duration),players=Number(input.players);
 const slot=demoSessionSlots(input.day,input.court,duration).find(s=>s.id===input.start&&s.status==='available');
 if(!court||!day||!slot||!bookingDemo.playerOptions.includes(players))return null;
 const startsAt=new Date(`${day.id}T${slot.id}:00+08:00`).toISOString();
 const quote={quoteId:bookingDemo.quoteId,courtId:court.apiId,startsAt,endsAt:new Date(Date.parse(startsAt)+duration*60000).toISOString(),durationMinutes:duration,totalCentavos:bookingDemo.rateCentavos*duration/60,currency:'PHP',terms:{demo:true,policyApprovalPending:true},versionContext:{demo:'presentation-v1'},validUntil:bookingDemo.expiresAt};
 return {court,day,slot,players,quote};
}
export function demoReceipt(selection,status='held'){
 return {receipt:{reference:bookingDemo.reference,createdAt:bookingDemo.createdAt,totalCentavos:selection.quote.totalCentavos,currency:'PHP',expiresAt:bookingDemo.expiresAt,stateAtCreation:'held'},current:{status:['held','expired','cancelled'].includes(status)?status:'held',expiresAt:bookingDemo.expiresAt,observedAt:status==='expired'?'2026-11-03T02:01:00.000Z':bookingDemo.observedAt},replayed:false};
}
