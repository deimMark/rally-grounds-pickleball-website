import { Check } from 'lucide-react';
import { statusLabels } from '@/lib/domain/demo-availability';

function CourtMarkings({ landscape, width, length }) {
  const middle = length / 2;
  const kitchen = length * 7 / 44;
  const near = middle - kitchen, far = middle + kitchen;
  return <svg className="court-lines" viewBox={`0 0 ${landscape ? `${length} ${width}` : `${width} ${length}`}`} aria-hidden="true" focusable="false">
    <g transform={landscape ? `translate(${length} 0) rotate(90)` : undefined}>
      <rect x=".5" y=".5" width={width - 1} height={length - 1} />
      <path d={`M0 ${near}H${width} M0 ${far}H${width} M${width / 2} 0V${near} M${width / 2} ${far}V${length}`} />
      <path className="court-net" d={`M0 ${middle}H${width}`} />
    </g>
  </svg>;
}

// One geometry for the approved floor plan, shared by all demo selectors.
export function CourtMap({ club, courts, selectedCourtId, onSelect, getStatus, view = 'map' }) {
 const { width: courtWidth, length: courtLength, gap } = club.courtMap;
 const mapWidth = courtWidth * 3 + gap * 2;
 const mapHeight = courtLength + (courtWidth + gap) * 2;
 return (
<div className={view === 'map' ? 'court-map' : 'court-list'} role="group" aria-label="Select a demo court" style={{ '--map-width': mapWidth, '--map-height': mapHeight }}>
              {courts.map((item) => {
                const status = getStatus(item);
                const selected = item.id === selectedCourtId;
                const landscape = item.orientation === 'landscape';
                const geometry = {
                  '--court-x': landscape ? mapWidth - courtLength + 1 : (item.column - 1) * (courtWidth + gap) + 1,
                  '--court-y': landscape ? courtLength + gap + (item.row - 2) * (courtWidth + gap) + 1 : 1,
                  '--court-width': landscape ? courtLength : courtWidth,
                  '--court-height': landscape ? courtWidth : courtLength,
                };
                return <button key={item.id} className={`court-tile ${item.orientation} ${status} ${selected ? 'selected' : ''}`} style={geometry} aria-label={`Court ${item.number}, ${statusLabels[status]}`} aria-pressed={selected} onClick={() => onSelect(item.id)}>
                  <CourtMarkings landscape={landscape} width={courtWidth} length={courtLength} />
                  <span className="court-tile-label"><span className="court-name">COURT</span> <strong>{String(item.number).padStart(2, '0')}</strong></span>
                  <span className="court-status"><span aria-hidden="true" />{statusLabels[status]}</span>
                  {selected && <span className="court-check" aria-hidden="true"><Check size={13} /></span>}
                </button>;
              })}
              {view === 'map' && <div className="map-annotation" aria-hidden="true"><span className="map-cross">+</span><strong>A LITTLE FRIENDLY<br />COMPETITION.</strong><span>A WHOLE LOT OF GOOD TIMES.</span><div className="path-lines" /></div>}
            </div>
 );
}
