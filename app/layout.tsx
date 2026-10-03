import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Kas Keluarga', template: '%s · Kas Keluarga' },
  description: 'Catat kondisi keuangan keluarga: rekening, pemasukan, pengeluaran rutin, utang, dan aset, lalu lihat kekayaan bersih dan sisa kas per bulan.',
};

export const viewport: Viewport = {
  themeColor: '#0b0d1a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
