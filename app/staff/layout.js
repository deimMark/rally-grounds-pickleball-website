import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { StaffNav } from '@/components/staff/staff-nav';
import { StaffDemoProvider } from '@/components/staff/staff-demo-context';
import { Brand } from '@/components/ui/brand';
import { DemoNotice } from '@/components/ui/demo-notice';
export const metadata = { title: 'Staff dashboard demo' };
export default function StaffLayout({ children }) {
  return <div className="staff-app"><DemoNotice staff /><div className="staff-frame"><aside className="staff-sidebar"><Brand light /><div className="workspace-label">CLUB WORKSPACE <span>DEMO</span></div><StaffNav /><div className="sidebar-bottom"><p>Presentation workspace</p><small>No staff account is signed in.<br />Only synthetic data is shown.</small><Link href="/">View public website <ArrowUpRight size={15} aria-hidden="true" /></Link></div></aside><div className="staff-content"><StaffDemoProvider>{children}</StaffDemoProvider></div></div></div>;
}
