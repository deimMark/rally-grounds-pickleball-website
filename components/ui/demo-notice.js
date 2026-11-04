'use client';
import { usePathname } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
const notices = {
  staff: 'Staff dashboard demo · Synthetic data only · No authentication or live operations',
  booking: 'Booking demonstration · Synthetic data only · No reservation, payment or personal data',
  site: 'A first look at Rally Grounds · Demo data only. Booking is not yet available.',
};
export function DemoNotice({ staff = false }) {
  const pathname = usePathname() || '/';
  const booking = pathname === '/book' || pathname.startsWith('/booking');
  return <div className="demo-notice"><div className="container flex items-center justify-center gap-2">
    <FlaskConical size={13} aria-hidden="true" />
    <span>{staff ? notices.staff : booking ? notices.booking : notices.site}</span>
  </div></div>;
}
export function DemoBadge({ children = 'DEMO PREVIEW' }) {
  return <span className="demo-badge"><span aria-hidden="true" />{children}</span>;
}
