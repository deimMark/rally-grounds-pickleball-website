'use client';
import { ExternalLink, Link2Off } from 'lucide-react';
import { reclubLinkState } from '@/lib/demo/reclub';
import { dayLabel, rangeLabel, clubParts } from '@/lib/demo/staff-schedule';

// External link to one specific Reclub Meet, or a non-interactive "pending" state.
// Plain anchor (never nested in a button); the OS may hand official app links to the app.
// Opening it changes nothing in Rally Grounds: no booking, RSVP, registration or payment.
export function ReclubLink({ event, compact = false }) {
 const link = reclubLinkState(event);
 const context = `${event.title}, ${dayLabel(clubParts(event.startsAt).dateKey)}, ${rangeLabel(event.startsAt, event.endsAt)}`;
 if (link.state !== 'ready') {
  return <span className={`reclub-pending ${compact ? 'compact' : ''}`}><Link2Off size={14} aria-hidden="true" />{link.state === 'invalid' ? 'Reclub link unavailable' : 'Reclub Meet link pending'}<span className="sr-only"> for {context}</span></span>;
 }
 return <a className={`reclub-link ${compact ? 'compact' : ''}`} href={link.url} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">
  View Meet on Reclub<span className="sr-only"> for {context} (opens Reclub in a new tab)</span><ExternalLink size={14} aria-hidden="true" />
 </a>;
}
