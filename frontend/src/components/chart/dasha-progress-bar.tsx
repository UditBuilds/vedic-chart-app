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
    <div className="space-y-4">
      {/* Timeline Segments */}
      <div className="flex h-4 w-full rounded-sm overflow-hidden border border-zinc-800 bg-zinc-950">
        {timeline.map((period, idx) => {
          const isActive = period.lord === currentMaha?.lord;
          return (
            <div
              key={`${period.lord}-${idx}`}
              title={`${period.lord} Mahadasha (${period.start} → ${period.end})`}
              className={`h-full border-r border-black flex-1 transition-all ${
                isActive ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            />
          );
        })}
      </div>

      {/* Sub-Period Active Callout */}
      <div className="p-3 rounded border border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-mono-code text-[10px] text-zinc-500 uppercase tracking-widest block">
            ACTIVE SUB-PERIOD (BHUKTI)
          </span>
          <span className="font-headline text-sm font-bold text-white">
            {currentAntara?.lord || 'Current'} Antardasha
          </span>
        </div>
        <div className="font-mono-code text-xs text-zinc-400">
          Cycle Range: <span className="text-white">{currentAntara?.start}</span> → <span className="text-white">{currentAntara?.end}</span>
        </div>
      </div>
    </div>
  );
}
