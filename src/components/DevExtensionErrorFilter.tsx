'use client';

import { useEffect } from 'react';

/**
 * Wallet extensions (MetaMask, etc.) inject into all origins and sometimes
 * reject promises that Next.js dev treats as app errors. This app does not use Web3.
 * In development only, swallow those rejections/errors so the overlay stays usable.
 */
export function DevExtensionErrorFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const str = (v: unknown) => (typeof v === 'string' ? v : v != null ? String(v) : '');

    const isLikelyExtensionNoise = (message: string, stack?: string) => {
      const combined = `${message}\n${stack || ''}`.toLowerCase();
      if (combined.includes('chrome-extension://') || combined.includes('moz-extension://')) {
        return true;
      }
      if (combined.includes('metamask')) return true;
      if (combined.includes('failed to connect to wallet')) return true;
      if (combined.includes('walletconnect')) return true;
      if (combined.includes('phantom') && combined.includes('extension')) return true;
      return false;
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === 'string'
          ? reason
          : reason && typeof reason === 'object' && 'message' in reason
            ? str((reason as { message?: unknown }).message)
            : str(reason);
      const stack =
        reason && typeof reason === 'object' && 'stack' in reason
          ? str((reason as { stack?: unknown }).stack)
          : '';
      if (isLikelyExtensionNoise(message, stack)) {
        event.preventDefault();
      }
    };

    const onError = (event: ErrorEvent) => {
      const message = event.message || str(event.error);
      const stack = event.error && typeof event.error === 'object' && 'stack' in event.error
        ? str((event.error as { stack?: unknown }).stack)
        : '';
      if (isLikelyExtensionNoise(message, stack)) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
