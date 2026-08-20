'use client';
import { type ReactNode } from 'react';
import { Web3Provider } from '@/lib/Web3Context';

export default function Providers({ children }: { children: ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
