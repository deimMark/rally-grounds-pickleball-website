import Link from 'next/link';
import { ArrowUpRight, LayoutDashboard, CalendarDays, ShieldCheck } from 'lucide-react';
import { Brand } from '@/components/ui/brand';
import { DemoNotice } from '@/components/ui/demo-notice';
export const metadata = { title: 'Staff dashboard demo' };
export default function StaffLayout({ children }) {
  return <div className="staff-app"><DemoNotice staff /><div className="staff-frame"><aside className="staff-sidebar"><Brand light /><div className="workspace-label">CLUB WORKSPACE <span>DEMO</span></div><nav aria-label="Dashboard navigation"><Link href="/staff" aria-current="page"><LayoutDashboard size={18} aria-hidden="true" />Overview</Link><a href="#schedule"><CalendarDays size={18} aria-hidden="true" />Sample schedule</a><a href="#upcoming"><ShieldCheck size={18} aria-hidden="true" />Coming next</a></nav><div className="sidebar-bottom"><p>Presentation workspace</p><small>No staff account is signed in.<br />Only synthetic data is shown.</small><Link href="/">View public website <ArrowUpRight size={15} aria-hidden="true" /></Link></div></aside><div className="staff-content">{children}</div></div></div>;
}
