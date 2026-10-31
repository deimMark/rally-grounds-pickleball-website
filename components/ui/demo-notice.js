import { FlaskConical } from 'lucide-react';
export function DemoNotice({ staff = false }) {
  return <div className="demo-notice"><div className="container flex items-center justify-center gap-2">
    <FlaskConical size={13} aria-hidden="true" />
    <span>{staff ? 'Staff dashboard demo · Synthetic data only · No authentication or live operations' : 'A first look at Rally Grounds · Demo data only. Booking is not yet available.'}</span>
  </div></div>;
}
export function DemoBadge({ children = 'DEMO PREVIEW' }) {
  return <span className="demo-badge"><span aria-hidden="true" />{children}</span>;
}
