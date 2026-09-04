'use client';

import React from 'react';
import { Sparkles, Compass, MapPin } from 'lucide-react';
import { ChartData } from '@/lib/types/chart.types';

interface HeaderProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenBirthModal: () => void;
  chart: ChartData | null;
}

export function CostarHeader({ activeTab, onSelectTab, onOpenBirthModal, chart }: HeaderProps) {
  const tabs = [
    { id: 'feed', label: 'FEED' },
    { id: 'chart', label: 'YOUR CHART' },
    { id: 'companion', label: 'COMPANION' },
    { id: 'compatibility', label: 'COMPATIBILITY' },
  ];

  const profileLabel = chart
    ? `${chart.input_echo.city_name || 'Chart'} (${chart.input_echo.date})`
    : 'Calculate Chart';

  return (
    <header className="h-16 border-b border-zinc-900 bg-black/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between">
      {/* Brandmark */}
      <div className="flex items-baseline gap-2.5 select-none cursor-pointer" onClick={() => onSelectTab('feed')}>
        <span className="font-brand font-bold text-lg text-white tracking-[0.08em]">
          JyotiAstro
        </span>
        <span className="font-mono-code text-[11px] text-zinc-500 tracking-[0.25em] uppercase">
          VEDIC
        </span>
      </div>

      {/* Nav Tabs */}
      <nav className="hidden md:flex items-center gap-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`font-mono-code text-xs tracking-widest transition-colors uppercase ${
                isActive
                  ? 'text-white font-bold'
                  : 'text-zinc-600 font-normal hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Profile Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenBirthModal}
          className="inline-flex items-center gap-2 text-xs font-mono-code text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span className="truncate max-w-[160px] sm:max-w-[200px]">{profileLabel}</span>
        </button>
      </div>
    </header>
  );
}
