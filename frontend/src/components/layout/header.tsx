'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Search, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';

export function DashboardHeader() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'offline'>('checking');

  useEffect(() => {
    async function checkBackend() {
      try {
        await api.checkHealth();
        setBackendStatus('healthy');
      } catch (e) {
        setBackendStatus('offline');
      }
    }
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search API endpoints, telemetry logs, organizations..."
            className="pl-9 h-9 text-xs bg-muted/30 border-border focus-visible:bg-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Real-time Backend Liveness Status Indicator */}
        <div className="flex items-center gap-2">
          {backendStatus === 'healthy' ? (
            <Badge variant="success" className="gap-1.5 font-mono text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              API: ONLINE (5001)
            </Badge>
          ) : backendStatus === 'checking' ? (
            <Badge variant="secondary" className="gap-1.5 font-mono text-[10px]">
              <Activity className="h-3 w-3 animate-spin" />
              CONNECTING...
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1.5 font-mono text-[10px]">
              <AlertCircle className="h-3 w-3" />
              API: OFFLINE
            </Badge>
          )}
        </div>

        <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        <div className="h-8 w-px bg-border hidden sm:block" />

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="px-2 py-1 rounded bg-muted/60 border border-border">UTC: {new Date().toISOString().substring(11, 19)}</span>
        </div>
      </div>
    </header>
  );
}
