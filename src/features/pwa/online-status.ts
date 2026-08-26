import { useEffect, useState } from 'react';

type OnlineStatusListener = (isOnline: boolean) => void;

const listeners = new Set<OnlineStatusListener>();

function readOnlineStatus(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function notifyOnlineStatus(): void {
  const isOnline = readOnlineStatus();

  for (const listener of listeners) {
    listener(isOnline);
  }
}

function subscribe(listener: OnlineStatusListener): () => void {
  if (listeners.size === 0) {
    window.addEventListener('online', notifyOnlineStatus);
    window.addEventListener('offline', notifyOnlineStatus);
  }

  listeners.add(listener);
  listener(readOnlineStatus());

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      window.removeEventListener('online', notifyOnlineStatus);
      window.removeEventListener('offline', notifyOnlineStatus);
    }
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(readOnlineStatus);

  useEffect(() => subscribe(setIsOnline), []);

  return isOnline;
}
