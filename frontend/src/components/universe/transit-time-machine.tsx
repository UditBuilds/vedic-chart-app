'use client';

import React, { useState } from 'react';
import { ChartData } from '@/lib/types/chart.types';

interface TimeMachineProps {
  chart: ChartData;
  onConsultDate?: (dateStr: string, query: string) => void;
}

export function TransitTimeMachine({ chart, onConsultDate }: TimeMachineProps) {
  const [offsetYears, setOffsetYears] = useState(2);

  const baseDate = new Date();
  const targetDate = new Date(baseDate.getFullYear() + offsetYears, baseDate.getMonth(), baseDate.getDate());
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const targetYear = targetDate.getFullYear();

  // Approximate major planetary transits for target year
  const saturnSigns = ['Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini', 'Cancer'];
  const saturnIdx = Math.max(0, Math.min(saturnSigns.length - 1, Math.floor((targetYear - 2024) / 2.5) + 1));
  const simulatedSaturnSign = saturnSigns[saturnIdx] || 'Pisces';

  const jupiterSigns = ['Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio'];
  const jupiterIdx = Math.max(0, Math.min(jupiterSigns.length - 1, targetYear - 2024));
  const simulatedJupiterSign = jupiterSigns[jupiterIdx] || 'Gemini';

  // Find active Mahadasha in timeline for target year
  const timeline = chart.dasha?.full_mahadasha_timeline || [];
  const activePeriod = timeline.find((t) => {
    return targetDateStr >= t.start && targetDateStr <= t.end;
  }) || chart.dasha?.current_mahadasha;

  const prompt = `What are the core life themes, career focus, and psychological growth of my ${activePeriod?.lord} Mahadasha era (${activePeriod?.start} to ${activePeriod?.end}) according to my natal chart?`;

  const handleAskAI = () => {
    if (onConsultDate) {
      onConsultDate(targetDateStr, prompt);
    }
  };

  return (
    <div className="py-8 border-b border-white/[0.08] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono-code text-[10px] text-slate-500 uppercase tracking-[0.25em]">
            CHRONOS // TIME-MACHINE //
          </span>
          <span className="font-mono-code text-xs text-white font-bold tracking-widest uppercase">
            {targetDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} ({offsetYears >= 0 ? `+${offsetYears} YRS` : `${offsetYears} YRS`})
          </span>
        </div>
        <span className="font-mono-code text-[10px] text-slate-500 uppercase tracking-widest">
          [ FUTURE TRANSIT SIMULATOR ]
        </span>
      </div>

      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light max-w-3xl">
        Scrub the chronological timeline to simulate upcoming planetary shifts, major Saturn/Jupiter transits, and your running Vimshottari Dasha era.
      </p>

      {/* Scrubber Slider */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center text-[10px] font-mono-code text-slate-500 uppercase">
          <span>-5Y PAST</span>
          <span className={offsetYears === 0 ? 'text-white font-bold' : ''}>PRESENT (TODAY)</span>
          <span>+15Y FUTURE</span>
        </div>
        <input
          type="range"
          min="-5"
          max="15"
          step="1"
          value={offsetYears}
          onChange={(e) => setOffsetYears(parseInt(e.target.value))}
          className="w-full accent-white cursor-pointer h-1.5 bg-slate-800 rounded-none appearance-none"
        />
        <div className="flex justify-between gap-1 overflow-x-auto pt-1 no-scrollbar font-mono-code text-[10px]">
          {[-5, 0, 1, 2, 3, 5, 7, 10, 15].map((y) => (
            <button
              key={y}
              onClick={() => setOffsetYears(y)}
              className={`px-2.5 py-1 uppercase tracking-wider transition-colors border ${
                offsetYears === y
                  ? 'bg-white text-black font-bold border-white'
                  : 'bg-transparent text-slate-500 border-white/10 hover:text-white'
              }`}
            >
              {y === 0 ? 'NOW' : `${y > 0 ? '+' : ''}${y}Y`}
            </button>
          ))}
        </div>
      </div>

      {/* Simulated Dasha & Transits Card */}
      <div className="p-6 border border-white/10 bg-black/40 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono-code text-xs pb-4 border-b border-white/[0.08]">
          <div>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-0.5">ACTIVE DASHA ERA</span>
            <span className="text-white font-bold text-sm block">{activePeriod?.lord} Mahadasha</span>
            <span className="text-slate-400 text-[10px]">{activePeriod?.start} → {activePeriod?.end}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-0.5">SATURN TRANSIT (SHANI)</span>
            <span className="text-slate-200 font-bold block">{simulatedSaturnSign}</span>
            <span className="text-slate-500 text-[10px]">Karma & Structure Focus</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-0.5">JUPITER TRANSIT (GURU)</span>
            <span className="text-slate-200 font-bold block">{simulatedJupiterSign}</span>
            <span className="text-slate-500 text-[10px]">Expansion & Opportunity</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="font-sans text-xs text-slate-300 font-light leading-relaxed max-w-xl">
            In <span className="text-white font-medium">{targetYear}</span> ({offsetYears >= 0 ? `+${offsetYears} yrs` : `${offsetYears} yrs`}), you will be experiencing your <span className="text-white font-medium">{activePeriod?.lord} Mahadasha</span> with Saturn transiting {simulatedSaturnSign}.
          </p>

          <button
            onClick={handleAskAI}
            className="px-5 py-2.5 bg-white text-black font-mono-code text-xs font-bold uppercase tracking-[0.18em] hover:bg-slate-200 transition-colors shrink-0 flex items-center justify-center gap-2"
          >
            ASK AI ABOUT THIS ERA →
          </button>
        </div>
      </div>
    </div>
  );
}
