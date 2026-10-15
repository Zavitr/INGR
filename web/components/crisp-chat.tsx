"use client";

import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

export function CrispChat() {
  const [showNotice, setShowNotice] = useState(false);
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

  useEffect(() => {
    if (!websiteId) {
      return;
    }

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = websiteId;

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [websiteId]);

  // If Crisp is configured, it renders its own chat widget overlay
  if (websiteId) {
    return null;
  }

  // Graceful fallback placeholder when NEXT_PUBLIC_CRISP_WEBSITE_ID is unset
  return (
    <div className="fixed bottom-5 right-5 z-40">
      {showNotice && (
        <div className="mb-2 p-3 bg-card border border-border shadow-lg rounded-xl max-w-xs text-xs text-card-foreground">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-semibold text-primary">Support Chat</span>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-muted-foreground">
            Crisp live chat is in development mode. Set{" "}
            <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">
              NEXT_PUBLIC_CRISP_WEBSITE_ID
            </code>{" "}
            to connect live support.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowNotice((prev) => !prev)}
        aria-label="Support Chat"
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
      >
        <MessageSquare size={20} />
      </button>
    </div>
  );
}
