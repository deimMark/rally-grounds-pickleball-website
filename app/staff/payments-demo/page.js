import Link from 'next/link';
import { ArrowUpRight, FlaskConical } from 'lucide-react';
import { DemoBadge } from '@/components/ui/demo-notice';
import { PaymentReview } from '@/components/staff/payment-review';
import { staffPaymentQueue } from '@/lib/demo/payment';
export const metadata = { title: 'Receipt review demo' };
export default function StaffPaymentsDemoPage() {
 // Public read-only demonstration with synthetic fixtures; no staff Auth, no data access.
 return <main id="main-content" className="dashboard-main"><header className="dashboard-header"><span>RALLY GROUNDS <span className="breadcrumb">/ Receipt review demo</span></span><Link href="/">Public website <ArrowUpRight size={15} aria-hidden="true" /></Link></header>
  <div className="dashboard-intro"><div><p className="eyebrow">MANUAL VERIFICATION, DEMONSTRATED</p><h1>Receipts are claims until the money is found.</h1><p>How staff would review customer-submitted GCash and bank-transfer receipts against the club’s own records.</p></div><DemoBadge>DEMONSTRATION ONLY</DemoBadge></div>
  <div className="dashboard-notice"><FlaskConical size={21} aria-hidden="true" /><div><strong>Nothing here is a real payment decision.</strong><p>The queue, customers, images and outcomes are synthetic. No staff account is signed in, no ledger is written and no booking is changed.</p></div></div>
  <PaymentReview queue={staffPaymentQueue} />
  <footer className="dashboard-footer">Rally Grounds · Phase 4A receipt-review demonstration <span>No real payments can be verified or recorded here.</span></footer>
 </main>;
}
