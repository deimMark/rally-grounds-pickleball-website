'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Brand } from '@/components/ui/brand';

export function Header() {
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <div className="container header-inner">
      <Brand />
      <nav aria-label="Main navigation" className="desktop-nav">
        <a href="#the-club">The club</a><a href="#courts">Our courts</a><a href="#community">The community</a>
      </nav>
      <div className="header-actions">
        <Link href="/staff" className="staff-link">Staff demo <ArrowUpRight size={14} aria-hidden="true" /></Link>
        <a className="button button-navy header-cta" href="#courts">Explore the courts <ArrowUpRight size={16} aria-hidden="true" /></a>
        <button className="mobile-menu icon-button" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-navigation">{open ? <X /> : <Menu />}</button>
      </div>
    </div>
    {open && <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile navigation">
      <a href="#the-club" onClick={() => setOpen(false)}>The club</a><a href="#courts" onClick={() => setOpen(false)}>Our courts</a><a href="#community" onClick={() => setOpen(false)}>The community</a>
      <Link href="/staff">Staff dashboard demo <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </nav>}
  </header>;
}
