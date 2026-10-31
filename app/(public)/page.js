import Image from 'next/image';
import { ArrowDown, ArrowUpRight, MapPin, Sun, Users, ArrowRight } from 'lucide-react';
import { getPublicExperience } from '@/lib/server/demo-data';
import { CourtSelector } from '@/components/public/court-selector';
import { DemoBadge } from '@/components/ui/demo-notice';
import { formatMoney } from '@/lib/domain/demo-availability';

export default async function HomePage() {
  const { club, courts, days, availability, features } = await getPublicExperience();
  return <main id="main-content">
    <section className="hero" id="the-club" aria-labelledby="hero-heading"><div className="container hero-grid">
      <div className="hero-copy"><p className="eyebrow"><MapPin size={13} aria-hidden="true" />SAN JUAN, LA UNION, PHILIPPINES</p><h1 id="hero-heading">YOUR PEOPLE.<br />YOUR COURT.<br /><span>YOUR GROUNDS.</span></h1><p className="hero-description">Where a good rally becomes a great day.<br />A place to play, connect, and belong—right here in Elyu.</p><div className="hero-actions"><a href="#courts" className="button button-navy">Find your court <ArrowUpRight size={18} aria-hidden="true" /></a><a href="#community" className="text-link">Meet the spirit of the club <ArrowRight size={16} aria-hidden="true" /></a></div><div className="hero-meta"><span><strong>{String(courts.length).padStart(2, '0')}</strong> COURTS TO CALL HOME</span><span className="hero-meta-divider" /><span><Sun size={20} aria-hidden="true" /> COASTAL ROOTS. COURTSIDE ENERGY.</span></div></div>
      <div className="hero-art" role="img" aria-label="Illustrated pickleball court, a Rally Grounds design concept, not a facility photograph">
        <div className="art-top"><span>THE RALLY STARTS HERE</span><span>LU / PH</span></div>
        <div className="hero-court"><div className="hero-court-inner"><div className="hero-kitchen" /><span className="hero-center-line" /><span className="hero-net" /><span className="hero-ball" /></div></div>
        <div className="art-type" aria-hidden="true">LET’S<br /><span>RALLY.</span></div>
        <div className="art-bottom"><span>GOOD GAMES.<br />GREAT COMPANY.</span><span className="art-star" aria-hidden="true">✳︎</span></div>
        <span className="art-caption">COURT ILLUSTRATION · DESIGN CONCEPT</span>
      </div>
    </div></section>
    <div className="club-strip"><div className="container strip-inner"><span><span className="strip-dot" />MORE THAN A GAME</span><span>Five courts. One community.</span><a href="#courts">Explore the grounds <ArrowDown size={15} aria-hidden="true" /></a></div></div>
    <CourtSelector club={club} courts={courts} days={days} availability={availability} />
    <section id="community" className="community-section section" aria-labelledby="community-heading"><div className="container community-grid">
      <figure className="community-photo"><Image src={club.media.src} alt={club.media.alt} fill sizes="(max-width: 760px) 100vw, 50vw" /><div className="photo-top-label"><MapPin size={13} aria-hidden="true" />INSPIRED BY COASTAL LIVING</div><figcaption>{club.media.caption}<br />{club.media.attribution}</figcaption></figure>
      <div className="community-copy"><p className="eyebrow"><span />THE HEART OF THE GROUNDS</p><h2 id="community-heading">Some come to compete.<br />Everyone comes<br /><em>to belong.</em></h2><p>New to pickleball? Chasing your next great rally? There’s room for both. We’re building a space where the game is the beginning, and the people are the reason you come back.</p><div className="community-features">{features.map((feature) => <article key={feature.number}><span>{feature.number}</span><div><h3>{feature.title}</h3><p>{feature.text}</p></div></article>)}</div></div>
    </div></section>
    <section className="visit-section section" aria-labelledby="visit-heading"><div className="container"><div className="visit-card"><div><p className="eyebrow">A PLACE FOR YOUR NEXT GOOD GAME</p><h2 id="visit-heading">See you at the grounds.</h2><p>San Juan, La Union · Exact location and opening details to be confirmed.</p><a href="#courts" className="button button-gold">Take a look around <ArrowUpRight size={17} aria-hidden="true" /></a></div><div className="visit-facts"><DemoBadge>CLUB CONCEPT</DemoBadge><div><Sun size={21} aria-hidden="true" /><span><strong>{club.hoursLabel}</strong><small>{club.hoursNote}</small></span></div><div><Users size={21} aria-hidden="true" /><span><strong>{formatMoney(club.rateCentavos)} / court hour</strong><small>{club.rateNote}</small></span></div></div></div></div></section>
  </main>;
}
