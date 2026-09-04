'use client';

import React from 'react';
import Link from 'next/link';
import { Layers, ArrowRight, Activity, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold">APEX<span className="text-primary font-normal">.SaaS</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="#architecture" className="hover:text-foreground transition-colors">Architecture</Link>
          <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="#telemetry" className="hover:text-foreground transition-colors">Telemetry</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Live Console
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" className="gap-1.5 shadow-sm">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
