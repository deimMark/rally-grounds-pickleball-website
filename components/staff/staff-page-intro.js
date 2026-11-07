'use client';
import Link from 'next/link';
import { ArrowUpRight, FlaskConical, RotateCcw } from 'lucide-react';
import { DemoBadge } from '@/components/ui/demo-notice';
import { useStaffDemo } from './staff-demo-context';

export function StaffPageIntro({ crumb, eyebrow, title, description, notice = 'Every customer, booking, payment and request on this page is fictional. No staff account is signed in, nothing is saved, and no booking, payment or customer is changed.' }) {
 const { data, dispatch } = useStaffDemo();
 return <>
  <header className="dashboard-header"><span>RALLY GROUNDS <span className="breadcrumb">/ {crumb}</span></span><Link href="/">Public website <ArrowUpRight size={15} aria-hidden="true" /></Link></header>
  <div className="dashboard-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><div className="staff-badges"><DemoBadge>SYNTHETIC STAFF DEMONSTRATION</DemoBadge><span className="staff-example-note">Example data — no live bookings or payments</span></div></div>
  <div className="dashboard-notice"><FlaskConical size={21} aria-hidden="true" /><div><strong>A walkthrough, not live operations.</strong><p>{notice}</p></div></div>
  {data.changeCount > 0 && <div className="simulation-count"><p><strong>{data.changeCount} simulated {data.changeCount === 1 ? 'change' : 'changes'}</strong> held in this browser tab’s memory only. Nothing was saved.</p><button type="button" className="text-link" onClick={() => dispatch({ type: 'reset', message: 'All simulations cleared. The original sample data is shown again.' })}><RotateCcw size={14} aria-hidden="true" />Clear simulations</button></div>}
 </>;
}

export function StatusPill({ tone, children }) {
 return <span className={`status-pill ${tone}`}><i aria-hidden="true" />{children}</span>;
}

// Inline confirmation for simulated destructive actions.
export function ConfirmBox({ id, prompt, confirmLabel, cancelLabel = 'Keep as is', onConfirm, onCancel }) {
 return <div className="confirm-box" role="group" aria-labelledby={`${id}-prompt`}>
  <p id={`${id}-prompt`}>{prompt}</p>
  <div className="payment-preview-actions"><button type="button" className="button button-navy" autoFocus onClick={onConfirm}>{confirmLabel}</button><button type="button" className="button button-outline" onClick={onCancel}>{cancelLabel}</button></div>
 </div>;
}
