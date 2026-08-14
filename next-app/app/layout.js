import { DM_Sans } from 'next/font/google';
import './globals.css';

// Self-hosted at build time: no request to fonts.googleapis.com at runtime, so
// no render-blocking third party and nothing to allow in the CSP.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata = {
  title: 'Session Q&A',
  description: 'Live Q&A tool for Salesforce training workshops.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}
