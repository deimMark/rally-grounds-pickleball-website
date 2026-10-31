import Link from 'next/link';

export function Brand({ light = false }) {
  // No approved logo exists in the repository. This is plain club-name text.
  return <Link href="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Rally Grounds home">
    <span>RALLY GROUNDS<span className="brand-period">.</span></span>
    <small>PICKLEBALL · LA UNION</small>
  </Link>;
}
