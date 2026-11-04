import { describe,it,expect } from 'vitest';
import { demoSessionSlots,demoSelection,demoReceipt } from '../../lib/demo/booking';
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
