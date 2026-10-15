"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2 } from "lucide-react";

interface ConnectServiceCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isConnected: boolean;
  onConnect?: () => Promise<void> | void;
  onReconnect?: () => void;
  onDisconnect?: () => Promise<void> | void;
  signupUrl: string;
}

export function ConnectServiceCard({
  id,
  name,
  description,
  icon,
  isConnected,
  onConnect,
  onReconnect,
  onDisconnect,
  signupUrl,
}: ConnectServiceCardProps) {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      if (onConnect) {
        await onConnect();
      } else {
        router.push(`/protected/services/connect?service=${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect service");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setIsDisconnecting(true);
    setError(null);
    try {
      await onDisconnect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect service");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-4 shadow-sm relative overflow-hidden">
      {/* Connected Indicator Background */}
      {isConnected && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full -z-10 pointer-events-none" />
      )}

      <div className="flex w-full justify-between items-start">
        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        {isConnected && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium border border-green-500/20">
            <Check size={14} />
            Connected
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3 className="text-xl font-bold">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {description}
        </p>
      </div>

      {error && (
        <div className="w-full text-xs text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/20">
          {error}
        </div>
      )}

      <div className="mt-auto w-full flex flex-col gap-2 pt-4">
        {isConnected ? (
          <div className="flex flex-col gap-2 w-full">
            <Link
              href={`/protected/services/connect?service=${id}`}
              onClick={onReconnect}
              className="w-full inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground shadow-sm"
            >
              Reconnect
            </Link>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full inline-flex h-10 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive text-sm font-medium transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Service"
              )}
            </button>
            <a
              href={signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            >
              Get a free account
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
