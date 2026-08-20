'use client';
import { useRouter } from 'next/navigation';
import ParentDashboard from '@/components/dashboard/ParentDashboard';
import Web3Panel from '@/components/dashboard/Web3Panel';

export default function DashboardPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 font-bold text-sm">← Back</button>
        <h1 className="text-2xl font-black text-gray-800">📊 Parent Dashboard</h1>
      </div>
      <ParentDashboard />
      <div className="mt-6">
        <Web3Panel />
      </div>
    </div>
  );
}
