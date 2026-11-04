'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, ShieldCheck, ReceiptText } from 'lucide-react';
export function StaffNav() {
 const pathname = usePathname() || '/staff';
 const current = (href) => (pathname === href ? 'page' : undefined);
 return <nav aria-label="Dashboard navigation">
  <Link href="/staff" aria-current={current('/staff')}><LayoutDashboard size={18} aria-hidden="true" />Overview</Link>
  <Link href="/staff#schedule"><CalendarDays size={18} aria-hidden="true" />Sample schedule</Link>
  <Link href="/staff/payments-demo" aria-current={current('/staff/payments-demo')}><ReceiptText size={18} aria-hidden="true" />Receipt review demo</Link>
  <Link href="/staff#upcoming"><ShieldCheck size={18} aria-hidden="true" />Coming next</Link>
 </nav>;
}
