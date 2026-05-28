'use client';

import { ParentLoadingState } from '@/components/parent/ParentUI';

export function ParentTrackingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading tracking">
      <div className="h-8 w-2/3 rounded-lg bg-gray-200" />
      <div className="h-24 rounded-2xl bg-gray-200" />
      <div className="h-[280px] sm:h-[420px] rounded-2xl bg-gray-200" />
      <div className="h-20 rounded-2xl bg-gray-200" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-32 rounded-2xl bg-gray-200" />
        <div className="h-32 rounded-2xl bg-gray-200" />
      </div>
    </div>
  );
}

export function ParentTrackingLoading({ message }: { message?: string }) {
  return (
    <div className="space-y-4">
      <ParentLoadingState message={message ?? 'Loading trip tracking…'} />
      <ParentTrackingSkeleton />
    </div>
  );
}
