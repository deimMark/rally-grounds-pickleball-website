'use client';
import Link from 'next/link';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { formatMoney } from '@/lib/domain/demo-availability';
import { staffOverview, todayScheduleRows, todayLabel } from '@/lib/demo/staff-overview';
import { dayLabel, weekDays } from '@/lib/demo/staff-schedule';
import { staffFixtureVersion } from '@/lib/demo/staff';
import { DemoSchedule } from './schedule';
import { StaffPageIntro } from './staff-page-intro';
import { useStaffDemo } from './staff-demo-context';

const upcomingModules = [
 { name: 'Live schedule changes', phase: 'Phase 5B', description: 'Open play, closures and staff bookings enforced by PostgreSQL occupancy constraints.' },
 { name: 'Cancellation and refund records', phase: 'Phase 5B', description: 'Owner-approved policy, audited decisions and separately recorded payouts.' },
 { name: 'Owner settings and reports', phase: 'Phase 6', description: 'Versioned rates, hours and verified-cash reporting.' },
];

export function StaffOverview() {
 const { data } = useStaffDemo();
 const overview = staffOverview(data);
 const week = weekDays(overview.today);
 const weekLabel = `${dayLabel(week[0]).slice(0, -5)} – ${dayLabel(week[6])}`;
 const operations = [
  { label: 'Today’s sessions', value: overview.sessionsToday, detail: `Bookings on the courts ${dayLabel(overview.today)}` },
  { label: 'Available court time', value: `${overview.availableHoursToday} h`, detail: `Free of ${overview.totalHoursToday} court-hours today (provisional demo hours)` },
  { label: 'Upcoming reservations', value: overview.upcomingReservations, detail: 'Unpaid holds, pending reviews and confirmed bookings ahead' },
  { label: 'Pending payment reviews', value: overview.pendingPaymentReviews, detail: 'Receipts awaiting comparison with account records' },
  { label: 'Cancellation requests', value: overview.pendingCancellations, detail: 'Pending a staff decision' },
  { label: 'Rescheduling requests', value: overview.pendingReschedules, detail: 'Pending a staff decision' },
  { label: 'Open-play periods', value: overview.openPlayThisWeek, detail: `This week, ${weekLabel}` },
  { label: 'Maintenance closures', value: overview.maintenanceThisWeek, detail: `This week, ${weekLabel}` },
 ];
 const payments = [
  { label: 'Verified payments (fictional)', value: overview.payments.verified, detail: 'Only payments matched in the sample account records count' },
  { label: 'Unverified claims', value: overview.payments.unverified, detail: 'Pending and rejected receipts · excluded from verified totals' },
  { label: 'Completed refunds (sample)', value: overview.payments.refundsCompleted, detail: 'Recorded payouts only · approvals alone are excluded' },
  { label: 'Net collections (fictional)', value: overview.payments.net, detail: 'Verified payments less completed refunds' },
 ];
 const areas = [
  { href: '/staff/schedule', label: 'Schedule', detail: 'Daily and weekly court view' },
  { href: '/staff/bookings', label: 'Bookings', detail: `${data.bookings.length} sample bookings` },
  { href: '/staff/open-play', label: 'Open play', detail: `${data.openPlay.length} sample events` },
  { href: '/staff/maintenance', label: 'Maintenance', detail: `${data.closures.length} sample closures` },
  { href: '/staff/customers', label: 'Customers', detail: `${data.customers.length} fictional customers` },
  { href: '/staff/requests', label: 'Requests', detail: `${overview.pendingCancellations + overview.pendingReschedules} pending` },
  { href: '/staff/payments-demo', label: 'Receipt review demo', detail: `${overview.pendingPaymentReviews} awaiting review` },
 ];
 return <main id="main-content" className="dashboard-main">
  <StaffPageIntro crumb="Overview" eyebrow="YOUR CLUB, AT A GLANCE" title="A good day starts here." description={`Synthetic operations for ${todayLabel(overview.today)}, demo clock 7:30 AM Asia/Manila.`} />
  <section className="metrics-grid" aria-label="Synthetic operations summary">{operations.map((metric) => <article className="metric-card" key={metric.label}><div><span>{metric.label}</span></div><strong>{metric.value}</strong><p>{metric.detail}</p><small>DEMO FIGURE</small></article>)}</section>
  <section className="metrics-grid" aria-label="Synthetic payment summary, fictional figures">{payments.map((metric) => <article className="metric-card" key={metric.label}><div><span>{metric.label}</span></div><strong>{formatMoney(metric.value)}</strong><p>{metric.detail}</p><small>DEMO FIGURE</small></article>)}</section>
  <div className="dashboard-columns"><DemoSchedule schedule={todayScheduleRows(data, overview.today)} dateLabel={todayLabel(overview.today)} />
   <section className="dashboard-panel next-panel" aria-labelledby="areas-heading"><p className="eyebrow">STAFF AREAS</p><h2 id="areas-heading">Where to next.</h2><p>Every area uses the same sample data set ({staffFixtureVersion}). Simulated actions stay in this tab until you reload.</p>
    <ul className="staff-area-links">{areas.map((area) => <li key={area.href}><Link href={area.href}><span><strong>{area.label}</strong><small>{area.detail}</small></span><ArrowRight size={15} aria-hidden="true" /></Link></li>)}</ul>
   </section></div>
  <section id="upcoming" className="upcoming-section" aria-labelledby="upcoming-heading"><div className="upcoming-heading"><h2 id="upcoming-heading">What live operations still need.</h2><span>PLANNED MODULES</span></div><div className="module-grid">{upcomingModules.map((module) => <article key={module.name}><LockKeyhole size={18} aria-hidden="true" /><span>{module.phase}</span><h3>{module.name}</h3><p>{module.description}</p><small>Not enabled in this demo</small></article>)}</div></section>
  <footer className="dashboard-footer">Rally Grounds · Phase 5A staff demonstration <span>No real bookings, payments or customers can be changed here.</span></footer>
 </main>;
}
