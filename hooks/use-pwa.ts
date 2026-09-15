'use client';
import { useEffect, useState } from 'react';
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function usePWA() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [installHelp, setInstallHelp] = useState(false);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    };
    queueMicrotask(update);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const complete = () => {
      setInstallEvent(null);
      setInstalled(true);
      setInstallHelp(false);
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', complete);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('beforeinstallprompt', prompt);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);
  async function install() {
    if (!installEvent) {
      setInstallHelp(true);
      return;
    }
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }
  return {
    installed,
    offlineReady,
    online,
    install,
    installHelp,
    setInstallHelp,
  };
}
