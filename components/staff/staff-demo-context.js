'use client';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { applySimulation, initialSimulation, SIMULATION_LABEL } from '@/lib/demo/staff';

// In-memory simulation shared by the staff pages while the layout stays mounted. Nothing is
// written to a server, cookie or browser storage; a reload returns to the fixtures.
const StaffDemoContext = createContext(null);

function reducer(state, action) {
 const seq = state.seq + 1;
 const log = [...state.log, { id: seq, message: action.message }].slice(-10);
 const next = { ...state, seq, log };
 switch (action.type) {
  case 'booking-status': return { ...next, bookingStatus: { ...state.bookingStatus, [action.reference]: action.status } };
  case 'cancellation': return { ...next, cancellation: { ...state.cancellation, [action.id]: action.decision } };
  case 'reschedule': return { ...next, reschedule: { ...state.reschedule, [action.id]: action.decision } };
  case 'open-play-add': return { ...next, openPlayAdded: [...state.openPlayAdded, { ...action.event, id: `SIM-OP-${seq}`, simulated: true }] };
  case 'open-play-edit': return { ...next, openPlayEdited: { ...state.openPlayEdited, [action.id]: action.changes } };
  case 'open-play-cancel': return { ...next, openPlayCancelled: [...state.openPlayCancelled, action.id] };
  case 'closure-add': return { ...next, closuresAdded: [...state.closuresAdded, { ...action.closure, id: `SIM-MC-${seq}`, simulated: true }] };
  case 'closure-cancel': return { ...next, closuresCancelled: [...state.closuresCancelled, action.id] };
  case 'reset': return { ...initialSimulation, seq, log };
  default: return state;
 }
}

export function StaffDemoProvider({ children }) {
 const [state, dispatch] = useReducer(reducer, initialSimulation);
 const data = useMemo(() => applySimulation(state), [state]);
 const value = useMemo(() => ({ state, dispatch, data }), [state, data]);
 return <StaffDemoContext.Provider value={value}>{children}</StaffDemoContext.Provider>;
}
export function useStaffDemo() {
 const value = useContext(StaffDemoContext);
 if (!value) throw new Error('useStaffDemo must be used inside StaffDemoProvider');
 return value;
}

// Shows the latest simulated action performed since this view mounted and moves focus to it.
export function SimulationNotice({ className = '' }) {
 const { state } = useStaffDemo();
 const [mountedSeq] = useState(state.seq);
 const ref = useRef(null);
 const latest = state.log.at(-1);
 const visible = latest && latest.id > mountedSeq;
 useEffect(() => { if (visible) ref.current?.focus(); }, [visible, latest?.id]);
 return <div ref={ref} tabIndex={-1} role="status" className={`simulation-notice ${visible ? 'shown' : ''} ${className}`}>
  {visible && <><strong>{SIMULATION_LABEL}</strong><span>{latest.message}</span><small>Nothing was saved or sent. Reload the page to return to the original sample data.</small></>}
 </div>;
}
