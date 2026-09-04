import React from 'react';
import Link from 'next/link';
import { Layers, Github, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40 text-muted-foreground">
      <div className="container max-w-7xl px-4 py-12 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <span className="text-base font-bold">APEX.SaaS</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Enterprise-grade TypeScript monorepo architecture engineered for high availability, zero-trust security, and instant global scaling.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="#features" className="hover:text-foreground">Architecture</Link></li>
              <li><Link href="#telemetry" className="hover:text-foreground">Live Telemetry</Link></li>
              <li><Link href="#pricing" className="hover:text-foreground">Pricing Tiers</Link></li>
              <li><Link href="/dashboard" className="hover:text-foreground">Developer Console</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Engine</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="text-foreground/70">Next.js 14 App Router</span></li>
              <li><span className="text-foreground/70">Express & TypeScript</span></li>
              <li><span className="text-foreground/70">Axios Network Interceptors</span></li>
              <li><span className="text-foreground/70">Helmet & Strict CORS</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Compliance & Security</h4>
            <ul className="space-y-2 text-xs">
              <li><span>SOC2 Type II Ready</span></li>
              <li><span>Zero-Trust Token Auth</span></li>
              <li><span>Automated Rate Limiting</span></li>
              <li><span>99.99% Availability SLA</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between text-xs gap-4">
          <p>© {new Date().getFullYear()} Apex Enterprise SaaS Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-foreground cursor-pointer">Privacy Policy</span>
            <span className="hover:text-foreground cursor-pointer">Terms of Service</span>
            <span className="hover:text-foreground cursor-pointer">Security Whitepaper</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
