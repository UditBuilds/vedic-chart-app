'use client';

import React from 'react';
import { DashaPeriod } from '@/lib/types/chart.types';

interface DashaBarProps {
  timeline: DashaPeriod[];
  currentMaha: DashaPeriod;
  currentAntara: DashaPeriod;
}

export function DashaProgressBar({ timeline, currentMaha, currentAntara }: DashaBarProps) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Single thin continuous timeline */}
      <div className="h-[2px] w-full bg-zinc-900 flex overflow-hidden">
        {timeline.map((period, idx) => {
          const isActive = period.lord === currentMaha?.lord;
          return (
            <div
              key={`${period.lord}-${idx}`}
              title={`${period.lord} Mahadasha (${period.start} → ${period.end})`}
              className={`h-full flex-1 ${
                isActive ? 'bg-white' : 'bg-transparent'
              }`}
            />
          );
        })}
      </div>

      {/* Sub-Period Active Callout — unboxed plain text */}
      <div className="space-y-0.5 pt-1 font-mono-code text-xs">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
          ACTIVE SUB-PERIOD (BHUKTI)
        </span>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-white font-semibold">
            {currentAntara?.lord || 'Current'} Antardasha
          </span>
          <span className="text-zinc-600 select-none">•</span>
          <span className="text-[11px] text-zinc-400">
            {currentAntara?.start} → {currentAntara?.end}
          </span>
        </div>
      </div>
    </div>
  );
}
