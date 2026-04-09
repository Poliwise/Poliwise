'use client';

import React from 'react';
import { ToastProvider, ToastContainer } from '@/components/ui/toast';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      {children}
      <ToastContainer />
    </ToastProvider>
  );
}
