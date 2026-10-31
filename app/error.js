'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }) {
  return <main id="main-content" className="container error-page"><p className="eyebrow">LET’S TRY THAT AGAIN</p><h1>The page couldn’t load.</h1><p>Your demo does not create bookings or collect payments.</p><button className="button button-navy" onClick={reset}>Try again</button><Link href="/">Back to the club</Link></main>;
}
