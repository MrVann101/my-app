"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const timer = window.setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return offline ? <div className="fixed inset-x-0 top-0 z-50 bg-[var(--sun)] px-4 py-2 text-center text-sm font-semibold text-[var(--foreground)]" role="status">You&apos;re offline. Saving changes is paused until you reconnect.</div> : null;
}