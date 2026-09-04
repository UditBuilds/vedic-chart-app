'use client';

import React from 'react';
import { ChartData } from '@/lib/types/chart.types';

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mars: '♂',
  Mercury: '☿',
  Jupiter: '♃',
  Venus: '♀',
  Saturn: '♄',
  Rahu: '☊',
  Ketu: '☋',
};

const SIGN_ABBR: Record<string, string> = {
  Aries: 'ARI',
  Taurus: 'TAU',
  Gemini: 'GEM',
  Cancer: 'CAN',
  Leo: 'LEO',
  Virgo: 'VIR',
  Libra: 'LIB',
  Scorpio: 'SCO',
  Sagittarius: 'SAG',
  Capricorn: 'CAP',
  Aquarius: 'AQU',
  Pisces: 'PIS',
};

export function LiveEphemerisTicker({ chart }: { chart: ChartData | null }) {
  if (!chart) return null;

  return (
    <div className="w-full border-b border-white/[0.08] bg-black/60 overflow-hidden py-1.5 px-4 font-mono-code text-[10px] text-slate-400 select-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar tracking-widest uppercase">
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-slate-500 font-semibold">[ LIVE EPHEMERIS ]</span>
          <span className="text-slate-300">ASC {SIGN_ABBR[chart.ascendant.sign] || chart.ascendant.sign.slice(0, 3)} {chart.ascendant.degree.toFixed(1)}°</span>
          {chart.planets.map((p) => {
            const deg = Math.floor(p.degree);
            const min = Math.floor((p.degree - deg) * 60);
            return (
              <span key={p.name} className="flex items-center gap-1 shrink-0 text-slate-400">
                <span className="text-slate-200">{PLANET_SYMBOLS[p.name] || p.name[0]}</span>
                <span>{SIGN_ABBR[p.sign] || p.sign.slice(0, 3)} {deg}°{min < 10 ? `0${min}` : min}&apos;{p.retrograde ? '[R]' : ''}</span>
              </span>
            );
          })}
        </div>

        {/* Dasha Telemetry */}
        <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
          <span>RUNNING ERA:</span>
          <span className="text-slate-200 font-bold tracking-wider uppercase">
            {chart.dasha?.current_mahadasha?.lord} / {chart.dasha?.current_antardasha?.lord}
          </span>
        </div>
      </div>
    </div>
  );
}
