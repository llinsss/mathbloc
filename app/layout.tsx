import type { Metadata } from 'next';
import './globals.css';
import Providers from './Providers';

export const metadata: Metadata = {
  title: 'MathBloc – Fun Math for Kids',
  description: 'Educational math game for children aged 2–9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
