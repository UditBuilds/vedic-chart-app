import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, ArrowUpRight, Shield, Zap } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics & Telemetry</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Deep observability into API request volume, error rates, and resource utilization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Throughput</span>
              <Badge variant="success" className="font-mono text-[10px]">+18.4%</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Daily API executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">1.84M</div>
            <p className="text-[11px] text-muted-foreground mt-2">Peak load at 14:00 UTC (4,200 req/sec)</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Error Rate</span>
              <Badge variant="outline" className="font-mono text-[10px]">0.02%</Badge>
            </CardTitle>
            <CardDescription className="text-xs">HTTP 5xx & 4xx distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-emerald-400">99.98%</div>
            <p className="text-[11px] text-muted-foreground mt-2">Zero unhandled exception crashes</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Avg Edge Latency</span>
              <Badge variant="secondary" className="font-mono text-[10px]">38ms</Badge>
            </CardTitle>
            <CardDescription className="text-xs">P95 latency across all routes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">38ms</div>
            <p className="text-[11px] text-muted-foreground mt-2">Fastest response: /api/health (2ms)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
