import type { Metadata, Viewport } from 'next';
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/500.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'সহজ ঠিকাদারি | Sohoz Thikadari',
  description: 'খাদ্য পরিবহন, কর্মীর খরচ ও বিলের সহজ হিসাব।',
  applicationName: 'সহজ ঠিকাদারি',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'সহজ ঠিকাদারি' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#146747' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
