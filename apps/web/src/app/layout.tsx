import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { ThemeProvider, themeInitScript } from '@/providers/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'OpenATS — AI-Powered Recruiting Intelligence',
  description:
    'OpenATS streamlines recruiting with AI-powered resume analysis, tier scoring, and intelligent candidate ranking.',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0D12' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Applies the saved/system theme before hydration to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ReactQueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
