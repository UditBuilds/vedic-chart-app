import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Platform Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure multi-tenant organization boundaries, security keys, and environment variables.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Workspace Profile</CardTitle>
          <CardDescription className="text-xs">Manage organization profile and tenant identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Organization Name</label>
              <Input defaultValue="Acme SaaS Labs Inc." className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Contact Email</label>
              <Input defaultValue="admin@saasplatform.com" className="h-9 text-xs" />
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <Button size="sm" className="text-xs">Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">API Secret Keys</CardTitle>
          <CardDescription className="text-xs">Manage cryptographic keys for microservice communication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase">Production Secret Key</label>
            <div className="flex gap-2">
              <Input defaultValue="saas_prod_sk_892348923498234823904" type="password" readOnly className="h-9 text-xs font-mono" />
              <Button variant="outline" size="sm" className="text-xs">Rotate</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
