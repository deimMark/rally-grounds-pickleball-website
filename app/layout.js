import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './globals.css';

export const metadata = {
  title: { default: 'Rally Grounds | Pickleball, La Union', template: '%s | Rally Grounds' },
  description: 'A first look at Rally Grounds, a five-court pickleball club concept in San Juan, La Union. Demonstration only; live booking is not available.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a>{children}</body></html>;
}
