// Entirely synthetic. No names, contact details, payment evidence or live records.
export const demoDashboard = {
  dateLabel: 'Saturday, 7 November 2026',
  metrics: [
    { label: 'Verified receipts', value: '₱1,200', detail: 'Synthetic incoming payments', icon: 'receipts' },
    { label: 'Unverified claims', value: '₱600', detail: 'Excluded from collected revenue', icon: 'claims' },
    { label: 'Completed refunds', value: '₱300', detail: 'Synthetic recorded payouts', icon: 'refunds' },
    { label: 'Net collected', value: '₱900', detail: 'Verified receipts less paid refunds', icon: 'net' },
  ],
  schedule: [
    { id: 'DEMO-001', court: 'Court 3', time: '8:00 – 9:00 AM', type: 'Private session', status: 'Confirmed', tone: 'available' },
    { id: 'DEMO-002', court: 'Court 1', time: '8:00 – 9:00 AM', type: 'Private session', status: 'Pending review', tone: 'pending' },
    { id: 'DEMO-003', court: 'Court 5', time: '8:00 – 9:00 AM', type: 'Community open play', status: 'Open play', tone: 'open-play' },
    { id: 'DEMO-004', court: 'Court 4', time: '9:00 – 10:00 AM', type: 'Private session', status: 'Confirmed', tone: 'available' },
  ],
  modules: [
    { name: 'Customer management', phase: 'Phase 5', description: 'Private customer history and staff search.' },
    { name: 'Business & branding', phase: 'Phase 6', description: 'Owner-editable content, rates and scheduled policies.' },
    { name: 'Revenue & utilization', phase: 'Phase 6', description: 'Verified cash reporting and court-minute analytics.' },
  ],
};
