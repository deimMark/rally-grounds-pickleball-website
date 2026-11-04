import { describe,it,expect } from 'vitest';
import { demoSessionSlots,demoSelection,demoReceipt,canonicalInteger,demoSlotGroups,demoAvailabilitySummary,describeAvailability,formatManila,courtLayoutDescription,slotReasons,bookingDemo } from '../../lib/demo/booking';
const sample={day:'2026-11-07',court:'court-3',start:'08:00',duration:'120',players:'4'};
describe('synthetic booking presentation boundary',()=>{
 it('checks every hour of the selected duration and rejects closing-time overruns',()=>{
  expect(demoSessionSlots(sample.day,sample.court,60).find(s=>s.id==='11:00').status).toBe('available');
  expect(demoSessionSlots(sample.day,sample.court,120).find(s=>s.id==='11:00').status).toBe('maintenance');
  expect(demoSessionSlots(sample.day,sample.court,120).find(s=>s.id==='22:00').status).toBe('closed');
 });
 it('preserves open-play and all-reserved demo days',()=>{
  expect(demoSessionSlots(sample.day,'court-5',180).every(s=>s.status!=='available')).toBe(true);
  expect(demoSessionSlots('2026-11-08','court-2',60).every(s=>s.status==='reserved')).toBe(true);
 });
 it('produces UTC intervals and integer centavo quotes independently of browser timezone',()=>{
  const s=demoSelection(sample);expect(s.quote.startsAt).toBe('2026-11-07T00:00:00.000Z');expect(s.quote.endsAt).toBe('2026-11-07T02:00:00.000Z');expect(s.quote.totalCentavos).toBe(120000);expect(s.quote.currency).toBe('PHP');expect(s.quote.courtId).toMatch(/^[\da-f-]{36}$/);expect(s.quote.terms.demo).toBe(true);
 });
 it.each(['duration','players','day','court','start'])('rejects array/object values for %s',key=>{
  for(const value of [[sample[key]],{},null])expect(demoSelection({...sample,[key]:value})).toBeNull();
 });
 it('rejects invalid/unavailable links and ignores untrusted money inputs',()=>{
  for(const override of [{day:'not-a-date'},{court:'court-100'},{duration:'90'},{duration:'120junk'},{start:'12:00'},{players:'999'}])expect(demoSelection({...sample,...override})).toBeNull();
  expect(demoSelection({...sample,totalCentavos:'1',paid:true}).quote.totalCentavos).toBe(120000);
 });
 it('separates immutable historical receipt and current design status without extending deadline',()=>{
  const selection=demoSelection(sample),held=demoReceipt(selection),expired=demoReceipt(selection,'expired'),cancelled=demoReceipt(selection,'cancelled');
  expect(expired.receipt).toEqual(held.receipt);expect(cancelled.receipt).toEqual(held.receipt);expect(held.current.status).toBe('held');expect(expired.current.status).toBe('expired');expect(cancelled.current.status).toBe('cancelled');expect(expired.current.expiresAt).toBe(held.current.expiresAt);
 });
});

describe('Phase 3D.2 canonical parameters, slot grouping and club-time formatting',()=>{
 it('accepts only canonical decimal integers',()=>{
  expect(canonicalInteger('120')).toBe(120);expect(canonicalInteger('0')).toBe(0);expect(canonicalInteger('4')).toBe(4);
  for(const bad of ['0120','+120','-1','1e2',' 120','120 ','1.0','',null,undefined,120,['120'],{}])expect(canonicalInteger(bad)).toBeNull();
 });
 it('rejects zero-padded or signed duration and player values in sample links',()=>{
  for(const override of [{duration:'0120'},{duration:'+120'},{players:'04'},{players:'+4'},{players:'4.0'},{start:['08:00']},{start:8}])expect(demoSelection({...sample,...override})).toBeNull();
  expect(demoSelection(sample)).not.toBeNull();
 });
 it('groups sample starts into morning, afternoon and evening in order without losing any slot',()=>{
  const slots=demoSessionSlots(sample.day,sample.court,60),groups=demoSlotGroups(slots);
  expect(groups.map(g=>g.id)).toEqual(['morning','afternoon','evening']);
  expect(groups.flatMap(g=>g.slots.map(s=>s.id))).toEqual(slots.map(s=>s.id));
  expect(groups[0].slots.map(s=>s.id)).toEqual(['08:00','09:00','10:00','11:00']);
  expect(groups[1].slots.map(s=>s.id)).toEqual(['12:00','13:00','14:00','15:00','16:00']);
  expect(groups[2].slots.at(-1).id).toBe('22:00');
  expect(bookingDemo.periods.at(-1).to).toBe(bookingDemo.endHour);
 });
 it('summarises availability counts and reasons for the selected session',()=>{
  const slots=demoSessionSlots(sample.day,sample.court,120);
  const summary=demoAvailabilitySummary(slots);
  expect(summary.total).toBe(15);expect(summary.available+summary.counts.reserved+summary.counts.maintenance+summary.counts.closed+summary.counts['open-play']).toBe(15);
  expect(summary.counts.closed).toBe(1);expect(summary.counts.maintenance).toBe(2);
  expect(describeAvailability(slots,120)).toMatch(/^\d+ of 15 sample starts fit a 2-hour session \(.*maintenance.*outside demo hours\)\.$/);
  expect(describeAvailability(demoSessionSlots(sample.day,'court-5',60),60)).toContain('0 of 15');
  expect(describeAvailability([],60)).toBe('No sample starts for this selection.');
  for(const status of ['reserved','open-play','maintenance','closed'])expect(typeof slotReasons[status]).toBe('string');
 });
 it('formats demonstration instants in Asia/Manila regardless of the process timezone',()=>{
  // 00:00Z is 08:00 in Asia/Manila (UTC+8); the date-part order depends on ICU data, the wall-clock time must not.
  expect(formatManila('2026-11-03T00:00:00.000Z')).toMatch(/^(3 Nov 2026|Nov 3, 2026),? 8:00\s?AM$/i);
  expect(formatManila('2026-11-02T16:00:00.000Z')).toMatch(/^(3 Nov 2026|Nov 3, 2026),? 12:00\s?AM$/i);
  expect(formatManila('2026-11-03T02:00:00.000Z')).toMatch(/10:00\s?AM/i);
  expect(formatManila('not-a-date')).toBe('');
 });
 it('describes the approved court layout in words',()=>{
  expect(courtLayoutDescription).toMatch(/Courts 3, 4 and 5/);expect(courtLayoutDescription).toMatch(/Courts 2 and 1/);expect(courtLayoutDescription).toMatch(/right edges line up with Court 5/);
 });
});
