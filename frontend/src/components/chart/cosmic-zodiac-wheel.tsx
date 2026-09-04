'use client';

import React, { useState } from 'react';
import { ChartData, PlanetPosition } from '@/lib/types/chart.types';
import { SIGN_INFO, PLANET_DOMAINS, HOUSE_AREAS } from '@/lib/astrology-service';

interface ZodiacWheelProps {
  chart: ChartData;
}

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const GRAHA_GLYPHS: Record<string, string> = {
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

export function CosmicZodiacWheel({ chart }: ZodiacWheelProps) {
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetPosition | null>(null);

  const cx = 220;
  const cy = 220;
  const outerR = 195;
  const signR = 160;
  const innerR = 120;
  const centerR = 65;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="font-mono-code text-[11px] text-slate-300 font-semibold uppercase tracking-[0.2em]">
            360° SIDEREAL NAKSHATRA CHAKRA
          </span>
        </div>
        <span className="font-mono-code text-[10px] text-slate-500 uppercase tracking-widest">
          INTERACTIVE CELESTIAL WHEEL
        </span>
      </div>

      {/* 360 SVG Wheel */}
      <div className="flex justify-center my-4">
        <svg viewBox="0 0 440 440" className="w-full max-w-[460px] aspect-square select-none">
          {/* Subtle Ambient Radial Backing */}
          <circle cx={cx} cy={cy} r={outerR} fill="#0a0f1d" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={signR} fill="#0d1424" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={innerR} fill="#070b14" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={centerR} fill="#05080e" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />

          {/* Center Title */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-brand font-bold text-xs fill-white uppercase tracking-[0.2em]"
          >
            JYOTI
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-mono-code text-[8px] fill-slate-500 uppercase tracking-[0.25em]"
          >
            SIDEREAL D1
          </text>

          {/* 12 Sign Wedges and Symbols */}
          {ZODIAC_SIGNS.map((sign, idx) => {
            const angle = (idx * 30 - 90) * (Math.PI / 180);
            const nextAngle = ((idx + 1) * 30 - 90) * (Math.PI / 180);
            const midAngle = (idx * 30 + 15 - 90) * (Math.PI / 180);

            // Dividing line
            const x1 = cx + Math.cos(angle) * innerR;
            const y1 = cy + Math.sin(angle) * innerR;
            const x2 = cx + Math.cos(angle) * outerR;
            const y2 = cy + Math.sin(angle) * outerR;

            // Text positions
            const glyphX = cx + Math.cos(midAngle) * (signR + 18);
            const glyphY = cy + Math.sin(midAngle) * (signR + 18);
            const labelX = cx + Math.cos(midAngle) * (innerR + 20);
            const labelY = cy + Math.sin(midAngle) * (innerR + 20);

            const isAscSign = chart.ascendant.sign === sign;
            const isMoonSign = chart.moon_rashi === sign;

            return (
              <g key={sign}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                
                {/* Sign Glyph */}
                <text
                  x={glyphX}
                  y={glyphY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`font-serif-poetic text-sm ${
                    isAscSign
                      ? 'fill-emerald-400 font-bold'
                      : isMoonSign
                      ? 'fill-sky-300 font-bold'
                      : 'fill-slate-400'
                  }`}
                >
                  {SIGN_INFO[sign]?.symbol || '✦'}
                </text>

                {/* Sign 3-letter Label */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`font-mono-code text-[8px] font-semibold ${
                    isAscSign ? 'fill-emerald-300' : isMoonSign ? 'fill-sky-200' : 'fill-slate-500'
                  }`}
                >
                  {sign.substring(0, 3).toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Planetary Orbit Nodes & Aspect Rays */}
          {chart.planets.map((planet) => {
            const signIdx = ZODIAC_SIGNS.indexOf(planet.sign);
            if (signIdx === -1) return null;

            const totalDeg = signIdx * 30 + planet.degree;
            const angle = (totalDeg - 90) * (Math.PI / 180);

            const px = cx + Math.cos(angle) * (innerR - 25);
            const py = cy + Math.sin(angle) * (innerR - 25);
            const rayX = cx + Math.cos(angle) * innerR;
            const rayY = cy + Math.sin(angle) * innerR;

            const isSelected = selectedPlanet?.name === planet.name;
            const glyph = GRAHA_GLYPHS[planet.name] || '✦';

            return (
              <g
                key={planet.name}
                onClick={() => setSelectedPlanet(planet)}
                className="cursor-pointer group"
              >
                {/* Aspect ray line to center */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={rayX}
                  y2={rayY}
                  stroke={isSelected ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
                  strokeDasharray="2 2"
                />

                {/* Glowing Node Circle */}
                <circle
                  cx={px}
                  cy={py}
                  r={isSelected ? 13 : 11}
                  fill={isSelected ? '#ffffff' : '#141c2e'}
                  stroke={isSelected ? '#818cf8' : 'rgba(255,255,255,0.3)'}
                  strokeWidth="1.5"
                  className="group-hover:stroke-white transition-all"
                />

                {/* Planet Glyph */}
                <text
                  x={px}
                  y={py + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`font-serif-poetic text-xs ${
                    isSelected ? 'fill-black font-bold' : 'fill-white'
                  }`}
                >
                  {glyph}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Planet Inspector */}
      {selectedPlanet ? (
        <div className="card-cosmic p-5 animate-fadeIn">
          <div className="flex justify-between items-center pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="font-headline text-base font-bold text-white">
                {selectedPlanet.name} in {selectedPlanet.sign} {selectedPlanet.retrograde ? '(Retrograde)' : ''}
              </span>
              <span className="font-mono-code text-[10px] px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-200">
                {HOUSE_AREAS[selectedPlanet.house]}
              </span>
            </div>
            <button
              onClick={() => setSelectedPlanet(null)}
              className="text-xs font-mono-code text-slate-400 hover:text-white uppercase tracking-widest"
            >
              [ CLOSE ✕ ]
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono-code text-slate-400">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">EXACT POSITION</span>
              <span className="text-white font-medium">{selectedPlanet.degree.toFixed(2)}°</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">NAKSHATRA PADA</span>
              <span className="text-white font-medium">{selectedPlanet.nakshatra} (Pada {selectedPlanet.pada})</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">ARCHETYPAL ROLE</span>
              <span className="text-slate-300 font-light">{PLANET_DOMAINS[selectedPlanet.name]?.archetypalRole || 'Planetary Influence'}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center font-mono-code text-[10px] text-slate-500 uppercase tracking-[0.2em]">
          CLICK ANY PLANETARY NODE (☉ ☽ ♂ ☿ ♃ ♀ ♄ ☊ ☋) TO INSPECT 360° RAYS
        </p>
      )}
    </div>
  );
}
