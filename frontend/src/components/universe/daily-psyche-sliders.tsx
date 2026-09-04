'use client';

import React from 'react';
import { ChartData } from '@/lib/types/chart.types';

interface SliderProps {
  chart: ChartData;
}

export function DailyPsycheSliders({ chart }: SliderProps) {
  const moonSign = chart.moon_rashi || 'Scorpio';

  const dimensions = [
    {
      id: 'routine',
      label: 'ROUTINE & CONTROL',
      score: 84,
      status: 'CONTROLLED',
      verdict: 'Your momentum is steady; do not self-sabotage with premature celebrations.',
    },
    {
      id: 'social',
      label: 'SOCIAL BATTERY & MASK',
      score: 24,
      status: 'DEPLETED',
      verdict: 'Zero tolerance for small talk or performative intimacy today. Protect your boundaries.',
    },
    {
      id: 'thinking',
      label: 'THINKING & COGNITION',
      score: 92,
      status: 'HYPER-VIGILANT',
      verdict: 'Your brain is spinning narrative traps. Stop cross-examining past conversations.',
    },
    {
      id: 'intimacy',
      label: 'INTIMACY & VULNERABILITY',
      score: 38,
      status: 'GUARDED',
      verdict: 'You want deep connection but expect others to read your mind. Speak your unsaid need plainly.',
    },
  ];

  const renderSegmentedBar = (score: number) => {
    const totalSegments = 20;
    const filledSegments = Math.round((score / 100) * totalSegments);
    return (
      <span className="font-mono-code text-[11px] text-slate-300 select-none tracking-tight">
        [{'|'.repeat(filledSegments)}
        <span className="text-slate-700">{'.'.repeat(totalSegments - filledSegments)}</span>]
      </span>
    );
  };

  return (
    <div className="py-8 border-b border-white/[0.08] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono-code text-[10px] text-slate-500 uppercase tracking-[0.25em]">
            PSYCHE TELEMETRY //
          </span>
          <span className="font-mono-code text-xs text-white font-bold tracking-widest uppercase">
            CALIBRATED TO {moonSign.toUpperCase()} MOON
          </span>
        </div>
        <span className="font-mono-code text-[10px] text-slate-500 uppercase tracking-widest">
          [ 4-AXIS INDEX ]
        </span>
      </div>

      {/* 4 Stark Telemetry Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
        {dimensions.map((dim) => (
          <div key={dim.id} className="space-y-2 border-l border-white/10 pl-4 py-1">
            <div className="flex justify-between items-center font-mono-code text-xs">
              <span className="text-slate-300 font-bold tracking-wider uppercase">
                {dim.label}
              </span>
              <div className="flex items-center gap-3">
                {renderSegmentedBar(dim.score)}
                <span className="text-white font-bold">{dim.score}%</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-widest">
                  [{dim.status}]
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              {dim.verdict}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
