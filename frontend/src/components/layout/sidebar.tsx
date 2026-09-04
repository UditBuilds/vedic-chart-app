'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  ShieldAlert,
  Server,
  Layers,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, badge: 'Live' },
  { label: 'Team & Members', href: '/dashboard/team', icon: Users },
  { label: 'Security & Auth', href: '/dashboard/security', icon: ShieldAlert },
  { label: 'Infrastructure', href: '/dashboard/infrastructure', icon: Server },
  { label: 'Platform Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card/60 flex flex-col justify-between hidden md:flex shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 border-b border-border flex items-center px-6 gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground">APEX.SaaS</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Enterprise v2.4</div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="p-4 space-y-1">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            Core Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-4 w-4', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold tracking-wide',
                      isActive ? 'bg-background text-foreground' : 'bg-primary/15 text-primary'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer Profile Box */}
      <div className="p-4 border-t border-border space-y-2">
        <Link
          href="/"
          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5" /> Marketing Site
          </span>
        </Link>
        <div className="flex items-center justify-between pt-2 px-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
              AM
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">Alex Morgan</div>
              <div className="text-[10px] text-muted-foreground font-mono">admin@saas.com</div>
            </div>
          </div>
          <button
            title="Log Out"
            className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('saas_auth_token');
                window.location.href = '/';
              }
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
