'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  Zap,
  Server,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiLog, setApiLog] = useState<string>('Ready. Click any action below to test Express backend communication.');
  const [testingHealth, setTestingHealth] = useState<boolean>(false);
  const [testingAuth, setTestingAuth] = useState<boolean>(false);

  // Fallback initial metrics if backend is booting
  const defaultMetrics = [
    { id: 'm1', label: 'Monthly Recurring Revenue', value: '$48,250.00', change: '+14.2%', trend: 'up', description: 'vs. previous 30 days' },
    { id: 'm2', label: 'Active Subscriptions', value: '1,429', change: '+8.1%', trend: 'up', description: 'across 4 enterprise tiers' },
    { id: 'm3', label: 'API Request Throughput', value: '2.84M', change: '+22.5%', trend: 'up', description: 'average 99.98% uptime' },
    { id: 'm4', label: 'Average Latency', value: '42ms', change: '-4.3%', trend: 'down', description: 'global edge CDN latency' },
  ];

  async function fetchDashboard() {
    setLoading(true);
    try {
      // First ensure auth token exists for protected route
      if (typeof window !== 'undefined' && !localStorage.getItem('saas_auth_token')) {
        await api.login({ email: 'alex.morgan@saasplatform.com' });
      }
      const res = await api.getDashboardMetrics();
      if (res) {
        setData(res);
        setApiLog(`[SUCCESS 200] Authenticated GET /api/v1/dashboard\nPayload received with ${res.metrics.length} KPI metrics and ${res.recentActivity.length} events.`);
      }
    } catch (err: any) {
      setApiLog(`[INFO] Operating in initial state: ${err.message || 'Connecting to backend...'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function handleTestHealth() {
    setTestingHealth(true);
    try {
      const res = await api.checkHealth();
      setApiLog(`[SUCCESS 200] GET http://localhost:5001/api/health\n${JSON.stringify(res, null, 2)}`);
    } catch (err: any) {
      setApiLog(`[ERROR ${err.status || 500}] GET /api/health failed: ${err.message}`);
    } finally {
      setTestingHealth(false);
    }
  }

  async function handleTestAuthLogin() {
    setTestingAuth(true);
    try {
      const res = await api.login({ email: 'alex.morgan@saasplatform.com' });
      setApiLog(`[SUCCESS 200] POST /api/v1/auth/login\nJWT Token Generated: ${res.token.substring(0, 32)}...\nUser: ${res.user.name} (${res.user.email})`);
      fetchDashboard();
    } catch (err: any) {
      setApiLog(`[ERROR ${err.status || 500}] POST /api/v1/auth/login failed: ${err.message}`);
    } finally {
      setTestingAuth(false);
    }
  }

  const metricsToDisplay = data?.metrics || defaultMetrics;

  return (
    <div className="space-y-8">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mission Control</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time multi-tenant telemetry and Express API microservice state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboard}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Telemetry
          </Button>
          <Button
            size="sm"
            onClick={handleTestHealth}
            disabled={testingHealth}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Activity className="h-3.5 w-3.5" />
            Check API Liveness
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsToDisplay.map((metric, idx) => (
          <Card key={metric.id || idx} className="border-border/80 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              {idx === 0 ? <DollarSign className="h-4 w-4 text-muted-foreground" /> :
               idx === 1 ? <Users className="h-4 w-4 text-muted-foreground" /> :
               idx === 2 ? <Activity className="h-4 w-4 text-muted-foreground" /> :
               <Zap className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono tracking-tight text-foreground">{metric.value}</div>
              <div className="flex items-center gap-1.5 text-xs mt-1">
                {metric.trend === 'up' ? (
                  <span className="text-emerald-500 font-semibold flex items-center font-mono">
                    <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> {metric.change}
                  </span>
                ) : (
                  <span className="text-blue-400 font-semibold flex items-center font-mono">
                    <TrendingDown className="h-3.5 w-3.5 mr-0.5" /> {metric.change}
                  </span>
                )}
                <span className="text-muted-foreground text-[11px] truncate">{metric.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Section: Live Terminal & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* API Network Tester Console (Col span 2) */}
        <Card className="lg:col-span-2 border-border/80 bg-card flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" /> Full-Stack Network Utility Tester
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Execute live requests from Next.js Axios client directly to the Express backend engine.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                Target: 5001
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Quick Action Trigger Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5 font-mono"
                onClick={handleTestHealth}
              >
                <Send className="h-3 w-3" /> GET /api/health
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5 font-mono"
                onClick={handleTestAuthLogin}
              >
                <Shield className="h-3 w-3" /> POST /api/v1/auth/login
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5 font-mono"
                onClick={fetchDashboard}
              >
                <Activity className="h-3 w-3" /> GET /api/v1/dashboard (JWT)
              </Button>
            </div>

            {/* Live Terminal Log Stream */}
            <div className="rounded-lg bg-black/90 p-4 border border-border font-mono text-xs text-emerald-400 overflow-x-auto min-h-[160px] max-h-[220px] whitespace-pre-wrap leading-relaxed">
              {apiLog}
            </div>
          </CardContent>
        </Card>

        {/* System Health Telemetry Widget */}
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" /> System Diagnostics
            </CardTitle>
            <CardDescription className="text-xs">
              Microservice health telemetry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/50">
              <span className="text-muted-foreground">Engine Port</span>
              <span className="font-bold text-foreground">5001</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/50">
              <span className="text-muted-foreground">CORS Policy</span>
              <span className="text-emerald-400 font-bold">STRICT (3000)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/50">
              <span className="text-muted-foreground">Auth Strategy</span>
              <span className="font-bold text-foreground">JWT (HS256)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/50">
              <span className="text-muted-foreground">Security Layer</span>
              <span className="text-blue-400 font-bold">Helmet Enabled</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Stream */}
      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Audit & Activity Stream
          </CardTitle>
          <CardDescription className="text-xs">
            Recent security, deployment, and workspace telemetry events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.recentActivity || [
              { id: '1', title: 'Production API Release v2.4.0', description: 'Automated CI/CD pipeline deployed to production cluster.', user: 'Alex Morgan', timestamp: '12m ago', type: 'deploy' },
              { id: '2', title: 'New Enterprise Customer Onboarded', description: 'Acme Global activated 250 team licenses.', user: 'System Bot', timestamp: '1h ago', type: 'billing' },
              { id: '3', title: 'API Key Rotated', description: 'Staging environment secrets refreshed.', user: 'Demo Engineer', timestamp: '3h ago', type: 'security' },
            ]).map((act) => (
              <div key={act.id} className="flex items-start justify-between p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">{act.title}</div>
                  <div className="text-[11px] text-muted-foreground">{act.description}</div>
                </div>
                <div className="text-right shrink-0 ml-4 font-mono text-[10px] text-muted-foreground">
                  <div>{act.timestamp}</div>
                  <div className="text-foreground/70">{act.user}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
