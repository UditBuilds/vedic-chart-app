'use client';

import React, { useState } from 'react';
import { ChartData, PlanetPosition } from '@/lib/types/chart.types';
import { PLANET_DOMAINS, HOUSE_AREAS } from '@/lib/astrology-service';

interface KundliProps {
  chart: ChartData;
}

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: 'Su',
  Moon: 'Mo',
  Mars: 'Ma',
  Mercury: 'Me',
  Jupiter: 'Ju',
  Venus: 'Ve',
  Saturn: 'Sa',
  Rahu: 'Ra',
  Ketu: 'Ke',
};

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export function KundliRenderer({ chart }: KundliProps) {
  const [chartType, setChartType] = useState<'north' | 'south'>('north');
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetPosition | null>(null);

  const ascSignName = chart.ascendant.sign;
  const ascIndex = ZODIAC_SIGNS.indexOf(ascSignName);

  // Group planets by house (1-indexed, 1 to 12)
  const planetsByHouse: Record<number, PlanetPosition[]> = {};
  for (let h = 1; h <= 12; h++) {
    planetsByHouse[h] = [];
  }
  chart.planets.forEach((p) => {
    if (planetsByHouse[p.house]) {
      planetsByHouse[p.house].push(p);
    }
  });

  // Calculate sign number for each house in North Indian chart
  const signForHouse = (h: number): number => {
    return ((ascIndex + (h - 1)) % 12) + 1;
  };

  // Center positions for 12 houses in North Indian diamond SVG (400x400)
  const northHouseCoords: Record<number, { cx: number; cy: number; lx: number; ly: number }> = {
    1:  { cx: 200, cy: 110, lx: 200, ly: 60 },
    2:  { cx: 105, cy: 65,  lx: 105, ly: 30 },
    3:  { cx: 55,  cy: 110, lx: 25,  ly: 110 },
    4:  { cx: 110, cy: 200, lx: 60,  ly: 200 },
    5:  { cx: 55,  cy: 290, lx: 25,  ly: 290 },
    6:  { cx: 105, cy: 335, lx: 105, ly: 370 },
    7:  { cx: 200, cy: 290, lx: 200, ly: 340 },
    8:  { cx: 295, cy: 335, lx: 295, ly: 370 },
    9:  { cx: 345, cy: 290, lx: 375, ly: 290 },
    10: { cx: 290, cy: 200, lx: 340, ly: 200 },
    11: { cx: 345, cy: 110, lx: 375, ly: 110 },
    12: { cx: 295, cy: 65,  lx: 295, ly: 30 },
  };

  return (
    <div className="space-y-4">
      {/* Chart Style Switcher */}
      <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
        <span className="font-mono-code text-xs text-zinc-400 uppercase tracking-wider">
          Traditional D1 Rashi Kundli
        </span>
        <div className="inline-flex rounded border border-zinc-800 p-0.5 bg-zinc-950">
          <button
            onClick={() => setChartType('north')}
            className={`px-3 py-1 font-mono-code text-xs font-semibold rounded ${
              chartType === 'north' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            } transition-colors`}
          >
            NORTH INDIAN
          </button>
          <button
            onClick={() => setChartType('south')}
            className={`px-3 py-1 font-mono-code text-xs font-semibold rounded ${
              chartType === 'south' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            } transition-colors`}
          >
            SOUTH INDIAN
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="flex justify-center my-4">
        {chartType === 'north' ? (
          <svg viewBox="0 0 400 400" className="w-full max-w-[420px] aspect-square select-none">
            {/* Outer Frame */}
            <rect x="10" y="10" width="380" height="380" fill="#090909" stroke="#27272a" strokeWidth="1.5" />
            
            {/* Diagonals and Diamond Lines */}
            <line x1="10" y1="10" x2="390" y2="390" stroke="#1f1f22" strokeWidth="1.2" />
            <line x1="390" y1="10" x2="10" y2="390" stroke="#1f1f22" strokeWidth="1.2" />
            <line x1="200" y1="10" x2="10" y2="200" stroke="#27272a" strokeWidth="1.2" />
            <line x1="10" y1="200" x2="200" y2="390" stroke="#27272a" strokeWidth="1.2" />
            <line x1="200" y1="390" x2="390" y2="200" stroke="#27272a" strokeWidth="1.2" />
            <line x1="390" y1="200" x2="200" y2="10" stroke="#27272a" strokeWidth="1.2" />

            {/* House Numbers & Lagna Marker */}
            {Object.entries(northHouseCoords).map(([houseStr, coords]) => {
              const h = parseInt(houseStr);
              const signNum = signForHouse(h);
              const isLagna = h === 1;

              return (
                <text
                  key={h}
                  x={coords.lx}
                  y={coords.ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`font-mono-code ${isLagna ? 'fill-white font-bold text-xs' : 'fill-zinc-600 text-[10px]'}`}
                >
                  {isLagna ? `Asc (Sign ${signNum})` : signNum}
                </text>
              );
            })}

            {/* Planets in Houses */}
            {Object.entries(planetsByHouse).map(([houseStr, planets]) => {
              const h = parseInt(houseStr);
              const coords = northHouseCoords[h];
              if (!coords || planets.length === 0) return null;

              return (
                <g key={`g-${h}`}>
                  {planets.map((p, pIdx) => {
                    const offsetY = (pIdx - (planets.length - 1) / 2) * 14;
                    const isSelected = selectedPlanet?.name === p.name;

                    return (
                      <g
                        key={p.name}
                        onClick={() => setSelectedPlanet(p)}
                        className="cursor-pointer group"
                      >
                        <rect
                          x={coords.cx - 24}
                          y={coords.cy + offsetY - 7}
                          width="48"
                          height="14"
                          fill={isSelected ? '#ffffff' : '#18181b'}
                          stroke={isSelected ? '#ffffff' : '#27272a'}
                          rx="2"
                          className="group-hover:stroke-white transition-colors"
                        />
                        <text
                          x={coords.cx}
                          y={coords.cy + offsetY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={`font-mono-code text-[9px] font-bold ${
                            isSelected ? 'fill-black' : 'fill-zinc-200 group-hover:fill-white'
                          }`}
                        >
                          {PLANET_SYMBOLS[p.name] || p.name.substring(0, 2)}
                          {p.retrograde ? '®' : ''} {Math.floor(p.degree)}°
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        ) : (
          /* South Indian 4x4 Grid */
          <svg viewBox="0 0 400 400" className="w-full max-w-[420px] aspect-square select-none">
            <rect x="10" y="10" width="380" height="380" fill="#090909" stroke="#27272a" strokeWidth="1.5" />
            <line x1="105" y1="10" x2="105" y2="390" stroke="#1f1f22" strokeWidth="1.2" />
            <line x1="200" y1="10" x2="200" y2="390" stroke="#1f1f22" strokeWidth="1.2" />
            <line x1="295" y1="10" x2="295" y2="390" stroke="#1f1f22" strokeWidth="1.2" />
            <line x1="10" y1="105" x2="390" y2="105" stroke="#1f1f22" strokeWidth="1.2" />
            <line x1="10" y1="200" x2="390" y2="200" stroke="#1f1f22" strokeWidth="1.2" />
            <line x1="10" y1="295" x2="390" y2="295" stroke="#1f1f22" strokeWidth="1.2" />
            {/* Center block cutout */}
            <rect x="105" y="105" width="190" height="190" fill="#040404" />
            <text x="200" y="200" textAnchor="middle" dominantBaseline="middle" className="font-mono-code text-xs fill-zinc-600 font-bold uppercase tracking-wider">
              D1 RASHI
            </text>
          </svg>
        )}
      </div>

      {/* Interactive Planet Inspector Popover */}
      {selectedPlanet ? (
        <div className="p-4 rounded border border-white/30 bg-zinc-950 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">
                {selectedPlanet.name} in {selectedPlanet.sign} {selectedPlanet.retrograde ? '(Retrograde)' : ''}
              </span>
              <span className="font-mono-code text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                {HOUSE_AREAS[selectedPlanet.house]}
              </span>
            </div>
            <button
              onClick={() => setSelectedPlanet(null)}
              className="text-xs font-mono-code text-zinc-400 hover:text-white"
            >
              [ CLOSE ✕ ]
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-code text-zinc-400">
            <div>
              <span className="text-zinc-600 block text-[10px]">EXACT DEGREE</span>
              <span className="text-zinc-200">{selectedPlanet.degree.toFixed(2)}°</span>
            </div>
            <div>
              <span className="text-zinc-600 block text-[10px]">NAKSHATRA</span>
              <span className="text-zinc-200">{selectedPlanet.nakshatra} (Pada {selectedPlanet.pada})</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-zinc-600 block text-[10px]">ARCHETYPAL ROLE</span>
              <span className="text-zinc-200">{PLANET_DOMAINS[selectedPlanet.name]?.archetypalRole || 'Planetary Influence'}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center font-mono-code text-[11px] text-zinc-500">
          Click any planet symbol in the diagram to inspect exact nakshatra, house, and degrees.
        </p>
      )}
    </div>
  );
}
