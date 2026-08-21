"use client";

import { useEffect, useState } from "react";

type Notice = {
  id: number;
  text: string;
};

/** Keeps legacy alert() calls non-blocking while screens adopt inline status messages. */
export default function AlertSurface() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const originalAlert = window.alert.bind(window);

    const showNotice = (text: string) => {
      const notice = { id: Date.now() + Math.random(), text };
      setNotices((current) => [...current.slice(-2), notice]);
      window.setTimeout(() => {
        setNotices((current) => current.filter((item) => item.id !== notice.id));
      }, 7000);
    };

    window.alert = (message?: unknown) => {
      const text = typeof message === "string" ? message : String(message ?? "");
      if (text.trim()) showNotice(text.trim());
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  if (notices.length === 0) return null;

  return (
    <div className="db-notice-region" aria-live="polite" aria-atomic="true">
      {notices.map((notice) => (
        <div className="db-notice" key={notice.id} role="status">
          {notice.text}
        </div>
      ))}
    </div>
  );
}
