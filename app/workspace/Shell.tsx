'use client';

import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { saveMyTheme } from '@/lib/actions';
import Topbar from './Topbar';

type ToastFn = (message: string, kind?: 'ok' | 'err') => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

type ShellProps = {
  children: ReactNode;
  user: { name: string; email: string; role: string; theme: string };
  companyName: string;
  currency: string;
};

export default function Shell({ children, user, companyName, currency }: ShellProps) {
  const pathname = usePathname();
  const toast = useCallback<ToastFn>((msg, kind = 'ok') => {
    const el = document.createElement('div');
    el.className = `toast-item${kind === 'err' ? ' err' : ''}`;
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.getElementById('toastwrap')?.appendChild(el);
    window.setTimeout(() => el.remove(), 3200);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-ws', '');
    root.dataset.theme = user.theme === 'light' ? 'light' : 'dark';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', user.theme === 'light' ? '#f4f6fb' : '#090c14');
    return () => {
      root.removeAttribute('data-ws');
      root.dataset.theme = 'dark';
    };
  }, [user.theme]);

  async function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    await saveMyTheme(next);
  }

  return (
    <ToastCtx.Provider value={toast}>
      <div className="wsapp" id="wsapp">
        {children}
        <div className="sidebar-backdrop" id="sidebarBackdrop" aria-hidden="true" />
        <div style={{ position: 'relative', minWidth: 0, display: 'grid' }}>
          <Topbar pathname={pathname} user={user} companyName={companyName} currency={currency} onToggleTheme={toggleTheme} />
          <main className="wsmain" id="wsmain">
            {children}
          </main>
          <div className="toastwrap" id="toastwrap" aria-live="polite" />
        </div>
      </div>
    </ToastCtx.Provider>
  );
}
