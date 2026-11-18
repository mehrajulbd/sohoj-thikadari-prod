'use client';
import { Suspense } from 'react';
import { Provider } from '@/lib/provider';
import { WorkspaceApp } from './workspace';
export default function ClientApp() {
  return (
    <Provider>
      <Suspense fallback={<div className="loading-screen">লোড হচ্ছে…</div>}>
        <WorkspaceApp />
      </Suspense>
    </Provider>
  );
}
