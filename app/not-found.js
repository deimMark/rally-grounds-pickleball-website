import Link from 'next/link';
export default function NotFound() {
  return <main id="main-content" className="container error-page"><p className="eyebrow">OUT OF BOUNDS</p><h1>This page isn’t on the court.</h1><p>Head back to explore the Rally Grounds demo.</p><Link className="button button-navy" href="/">Back to the club</Link></main>;
}
