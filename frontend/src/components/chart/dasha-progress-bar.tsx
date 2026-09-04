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
      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1 font-mono-code text-xs">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-0.5">
            ACTIVE SUB-PERIOD (BHUKTI)
          </span>
          <span className="text-white font-semibold">
            {currentAntara?.lord || 'Current'} Antardasha
          </span>
        </div>
        <div className="text-[11px] text-zinc-400">
          {currentAntara?.start} → {currentAntara?.end}
        </div>
      </div>
    </div>
  );
}
