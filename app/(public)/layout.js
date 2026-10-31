import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/public/header';
import { DemoNotice } from '@/components/ui/demo-notice';
import { Brand } from '@/components/ui/brand';

export default function PublicLayout({ children }) {
  return <><DemoNotice /><Header />{children}<footer className="site-footer"><div className="container footer-inner"><Brand light /><p>San Juan, La Union, Philippines<br /><span>A little competition. A lot of community.</span></p><div><Link href="/staff">Explore the staff demo <ArrowUpRight size={14} aria-hidden="true" /></Link><small>Phase 1 presentation · No live reservations</small></div></div></footer></>;
}
