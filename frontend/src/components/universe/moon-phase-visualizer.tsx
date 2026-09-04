'use client';

import React from 'react';
import { ChartData } from '@/lib/types/chart.types';

export function MoonPhaseVisualizer({ chart }: { chart: ChartData }) {
  const moonPlanet = chart.planets.find((p) => p.name === 'Moon');
  const sunPlanet = chart.planets.find((p) => p.name === 'Sun');

  const moonDeg = moonPlanet ? moonPlanet.degree : 230;
  const sunDeg = sunPlanet ? sunPlanet.degree : 45;

  const diff = (moonDeg - sunDeg + 360) % 360;
  const illumination = Math.round(((1 - Math.cos((diff * Math.PI) / 180)) / 2) * 100);

  const tithiNum = Math.floor(diff / 12) + 1;
  const paksha = tithiNum <= 15 ? 'SHUKLA PAKSHA' : 'KRISHNA PAKSHA';

  let phaseName = 'WAXING GIBBOUS';
  if (diff < 15 || diff > 345) phaseName = 'NEW MOON (AMAVASYA)';
  else if (diff >= 75 && diff <= 105) phaseName = 'FIRST QUARTER';
  else if (diff >= 165 && diff <= 195) phaseName = 'FULL MOON (PURNIMA)';
  else if (diff >= 255 && diff <= 285) phaseName = 'LAST QUARTER';
  else if (diff > 195) phaseName = 'WANING CRESCENT';

  return (
    <div className="py-8 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-8">
      {/* Editorial Typographic Telemetry */}
      <div className="space-y-3 max-w-xl">
        <div className="flex items-center gap-3 font-mono-code text-[10px] text-slate-500 tracking-[0.25em] uppercase">
          <span>LUNAR TELEMETRY //</span>
          <span className="text-slate-300 font-semibold">{illumination}% ILLUMINATED</span>
          <span>•</span>
          <span>{paksha}</span>
        </div>

        <div>
          <h2 className="font-serif-poetic text-4xl sm:text-5xl lg:text-6xl text-white font-normal tracking-tight leading-none">
            Moon in {chart.moon_rashi}
          </h2>
          <p className="font-mono-code text-xs text-slate-400 mt-2 tracking-widest uppercase">
            {moonPlanet?.nakshatra || 'Jyeshtha'} · Pada {moonPlanet?.pada || 1} · {moonDeg.toFixed(2)}° Sidereal
          </p>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
          Your subconscious instincts operate through deep psychological perception, hyper-vigilance, and emotional self-reliance.
        </p>
      </div>

      {/* High-Contrast Archival Monochrome Moon Disc */}
      <div className="flex items-center gap-6 self-start md:self-auto">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-black border border-white/20 shrink-0 shadow-2xl">
          <div className="absolute inset-0 bg-[#16181d] rounded-full" />
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100">
            <defs>
              <radialGradient id="lunarGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="85%" stopColor="#888888" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#222222" stopOpacity="0.95" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#lunarGlow)" />
            <circle cx="35" cy="40" r="10" fill="#444" opacity="0.3" />
            <circle cx="65" cy="55" r="14" fill="#333" opacity="0.4" />
            <circle cx="48" cy="70" r="8" fill="#333" opacity="0.3" />
            <circle cx="58" cy="28" r="7" fill="#444" opacity="0.25" />
            <path
              d="M 50,2 A 48,48 0 0 0 50,98 A 38,48 0 0 1 50,2"
              fill="#08090c"
              opacity="0.92"
            />
          </svg>
        </div>

        <div className="font-mono-code text-[10px] space-y-1.5 text-slate-400">
          <div className="text-white font-bold tracking-wider uppercase">{phaseName}</div>
          <div>TITHI: {tithiNum} / 30</div>
          <div className="text-slate-500 uppercase tracking-widest">[ CO-STAR CAL ]</div>
        </div>
      </div>
    </div>
  );
}
