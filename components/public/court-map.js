import { useId } from 'react';
import { Check } from 'lucide-react';
import { statusLabels } from '@/lib/domain/demo-availability';
import { courtLayoutDescription } from '@/lib/demo/booking';

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
// `getDetail` (optional) supplies a short per-court availability note; it is read as the
// button's accessible description and shown visibly in list view only.
export function CourtMap({ club, courts, selectedCourtId, onSelect, getStatus, getDetail, view = 'map' }) {
 const { width: courtWidth, length: courtLength, gap } = club.courtMap;
 const mapWidth = courtWidth * 3 + gap * 2;
 const mapHeight = courtLength + (courtWidth + gap) * 2;
 const descriptionId = useId();
 return (
<div className={view === 'map' ? 'court-map' : 'court-list'} role="group" aria-label="Select a demo court" aria-describedby={descriptionId} style={{ '--map-width': mapWidth, '--map-height': mapHeight }}>
              <p id={descriptionId} className="sr-only">{courtLayoutDescription}</p>
              {courts.map((item) => {
                const status = getStatus(item);
                const detail = getDetail?.(item);
                const detailId = detail ? `${descriptionId}-${item.id}` : undefined;
                const selected = item.id === selectedCourtId;
                const landscape = item.orientation === 'landscape';
                const geometry = {
                  '--court-x': landscape ? mapWidth - courtLength + 1 : (item.column - 1) * (courtWidth + gap) + 1,
                  '--court-y': landscape ? courtLength + gap + (item.row - 2) * (courtWidth + gap) + 1 : 1,
                  '--court-width': landscape ? courtLength : courtWidth,
                  '--court-height': landscape ? courtWidth : courtLength,
                };
                return <button key={item.id} className={`court-tile ${item.orientation} ${status} ${selected ? 'selected' : ''}`} style={geometry} aria-label={`Court ${item.number}, ${statusLabels[status]}`} aria-pressed={selected} aria-describedby={detailId} onClick={() => onSelect(item.id)}>
                  <CourtMarkings landscape={landscape} width={courtWidth} length={courtLength} />
                  <span className="court-tile-label"><span className="court-name">COURT</span> <strong>{String(item.number).padStart(2, '0')}</strong></span>
                  <span className="court-status"><span aria-hidden="true" />{statusLabels[status]}</span>
                  {detail && <span id={detailId} className="court-detail">{detail}</span>}
                  {selected && <span className="court-check" aria-hidden="true"><Check size={13} /></span>}
                </button>;
              })}
              {view === 'map' && <div className="map-annotation" aria-hidden="true"><span className="map-cross">+</span><strong>A LITTLE FRIENDLY<br />COMPETITION.</strong><span>A WHOLE LOT OF GOOD TIMES.</span><div className="path-lines" /></div>}
            </div>
 );
}
