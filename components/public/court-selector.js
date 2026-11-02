'use client';
import { useState } from 'react';
import { ArrowRight, Check, Map, List, Clock3, Info, RotateCcw } from 'lucide-react';
import { DemoBadge } from '@/components/ui/demo-notice';
import { formatMoney, getCourtStatus, getDemoSlots, statusLabels } from '@/lib/domain/demo-availability';

export function CourtSelector({ club, courts, days, availability }) {
  const [dayId, setDayId] = useState(days[0].id);
  const [courtId, setCourtId] = useState(courts[0].id);
  const [view, setView] = useState('map');
  const [slotId, setSlotId] = useState(null);
  const [preview, setPreview] = useState(false);
  const court = courts.find((item) => item.id === courtId);
  const day = days.find((item) => item.id === dayId);
  const slots = getDemoSlots(availability, dayId, courtId);
  const selectedSlot = slots.find((item) => item.id === slotId);
  function chooseCourt(id) { setCourtId(id); setSlotId(null); setPreview(false); }
  function reset() { setSlotId(null); setPreview(false); }

  return <section id="courts" className="section court-section" aria-labelledby="courts-heading">
    <div className="container">
      <div className="section-top"><div><p className="eyebrow"><span />FIND YOUR SIDE OF THE COURT</p><h2 id="courts-heading">Five courts. Endless possibilities.</h2></div><p className="section-aside">Pick your court. Find your rhythm.<br />Get a feel for your next game.</p></div>
      <div className="selector-shell">
        <div className="selector-toolbar"><div className="flex items-center gap-3 flex-wrap"><DemoBadge>MOCK AVAILABILITY</DemoBadge><span className="small-muted">All times in {club.timezone}</span></div>
          <div className="view-switch" role="group" aria-label="Court view"><button aria-pressed={view === 'map'} onClick={() => setView('map')}><Map size={15} aria-hidden="true" />Map</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15} aria-hidden="true" />List</button></div>
        </div>
        <div className="selector-body">
          <div className="court-map-panel">
            <div className="map-topline"><span className="map-label">THE GROUNDS / 01</span></div>
            <div className={view === 'map' ? 'court-map' : 'court-list'} role="group" aria-label="Select a demo court">
              {courts.map((item) => {
                const status = getCourtStatus(getDemoSlots(availability, dayId, item.id));
                const selected = item.id === courtId;
                return <button key={item.id} className={`court-tile ${item.orientation} ${status} ${selected ? 'selected' : ''}`} style={{ '--court-row': item.row, '--court-column': item.column, '--court-span': item.columnSpan }} aria-label={`Court ${item.number}, ${statusLabels[status]}`} aria-pressed={selected} onClick={() => chooseCourt(item.id)}>
                  <span className="court-lines" aria-hidden="true"><span /><i /></span>
                  <span className="court-tile-label">COURT <strong>{String(item.number).padStart(2, '0')}</strong></span>
                  <span className="court-status"><span aria-hidden="true" />{statusLabels[status]}</span>
                  {selected && <span className="court-check" aria-hidden="true"><Check size={13} /></span>}
                </button>;
              })}
              {view === 'map' && <div className="map-annotation" aria-hidden="true"><span className="map-cross">+</span><strong>A LITTLE FRIENDLY<br />COMPETITION.</strong><span>A WHOLE LOT OF GOOD TIMES.</span><div className="path-lines" /></div>}
            </div>
            <div className="map-legend"><span><i className="legend-dot available" />Available</span><span><i className="legend-dot reserved" />Reserved</span><span><i className="legend-dot open-play" />Open play</span></div>
            <p className="map-footnote">Illustrative layout · Select any court to explore sample sessions.</p>
          </div>
          <div className="session-panel">
            <div className="session-heading"><div><p className="eyebrow">YOUR NEXT SESSION</p><h3>Court {court.number}</h3></div><span className="court-number" aria-hidden="true">{String(court.number).padStart(2, '0')}</span></div>
            <label className="field-label" htmlFor="demo-day">Explore a demo day</label>
            <select id="demo-day" value={dayId} onChange={(event) => { setDayId(event.target.value); reset(); }}>{days.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
            <fieldset className="slot-fieldset"><legend>Sample start times <span>1-hour sessions</span></legend>
              <div className="time-slots">{slots.map((slot) => <button key={slot.id} disabled={slot.status !== 'available'} aria-pressed={slot.id === slotId} onClick={() => { setSlotId(slot.id); setPreview(false); }} className={slot.id === slotId ? 'chosen' : ''}><span>{slot.label}</span><small>{statusLabels[slot.status]}</small></button>)}</div>
            </fieldset>
            <div className="session-price"><span>Illustrative court rate<small>Per court / hour</small></span><strong>{formatMoney(club.rateCentavos)}</strong></div>
            <button className="button button-navy session-cta" disabled={!selectedSlot} onClick={() => setPreview(true)}>Preview this session <ArrowRight size={16} aria-hidden="true" /></button>
            <div className="selection-message" role="status" aria-live="polite">
              {preview && selectedSlot ? <div className="preview-result"><Check size={17} aria-hidden="true" /><div><strong>Court {court.number} · {selectedSlot.label} – {selectedSlot.endLabel}</strong><p>{day.longLabel}. Preview only. No court has been reserved.</p><button onClick={reset}><RotateCcw size={12} aria-hidden="true" /> Clear selection</button></div></div> : <p className="demo-explanation"><Info size={14} aria-hidden="true" /><span>{slots.every((slot) => slot.status !== 'available') ? 'No sample sessions available here. Try another court or demo day.' : 'A demo, not a reservation. No personal details or payments collected.'}</span></p>}
            </div>
            <div className="session-note"><Clock3 size={14} aria-hidden="true" /><span>Live availability and booking are coming in a later phase.</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
