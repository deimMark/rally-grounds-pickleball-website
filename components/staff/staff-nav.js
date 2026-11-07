'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, ClipboardList, Users, Wrench, UserRound, Inbox, ReceiptText, Menu, X } from 'lucide-react';

export const staffLinks = [
 { href: '/staff', label: 'Overview', icon: LayoutDashboard },
 { href: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
 { href: '/staff/bookings', label: 'Bookings', icon: ClipboardList },
 { href: '/staff/open-play', label: 'Open play', icon: Users },
 { href: '/staff/maintenance', label: 'Maintenance', icon: Wrench },
 { href: '/staff/customers', label: 'Customers', icon: UserRound },
 { href: '/staff/requests', label: 'Requests', icon: Inbox },
 { href: '/staff/payments-demo', label: 'Receipt review demo', icon: ReceiptText },
];

// Sidebar on wide screens; a disclosure menu on narrow screens.
export function StaffNav() {
 const pathname = usePathname() || '/staff';
 const [open, setOpen] = useState(false);
 const current = staffLinks.find((link) => link.href === pathname) ?? staffLinks[0];
 return <>
  <button type="button" className="staff-nav-toggle" aria-expanded={open} aria-controls="staff-navigation" onClick={() => setOpen(!open)}>
   {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}<span>Staff menu</span><small>· {current.label}</small>
  </button>
  <nav id="staff-navigation" className="staff-nav" data-open={open} aria-label="Dashboard navigation">
   {staffLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setOpen(false)}><Icon size={18} aria-hidden="true" />{label}</Link>)}
  </nav>
 </>;
}
