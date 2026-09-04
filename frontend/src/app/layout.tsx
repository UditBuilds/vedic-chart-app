import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JyotiAstro // Vedic — Sidereal Astrological Intelligence',
  description:
    'Minimalist Vedic sidereal astrology. Plain human language, daily vibe feed, your natal chart blueprint, and grounded AI companion.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}
