'use client';
import dynamic from 'next/dynamic';
const ClientApp = dynamic(() => import('@/components/client-app'), {
  ssr: false,
  loading: () => <div className="loading-screen">লোড হচ্ছে…</div>,
});
export default ClientApp;
