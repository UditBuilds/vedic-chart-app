'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Compass, Sparkles, Layers, Shield } from 'lucide-react';
import { ChartData, PlanetPosition } from '@/lib/types/chart.types';
import { SIGN_INFO, PLANET_DOMAINS, HOUSE_AREAS } from '@/lib/astrology-service';
import { KundliRenderer } from '@/components/chart/kundli-renderer';
import { DashaProgressBar } from '@/components/chart/dasha-progress-bar';

interface ChartViewProps {
  chart: ChartData;
}

export function ChartView({ chart }: ChartViewProps) {
  const [kundliOpen, setKundliOpen] = useState(false);

  // Big Three Placements
  const ascendant = chart.ascendant;
  const moonPlanet = chart.planets.find((p) => p.name === 'Moon');
  const sunPlanet = chart.planets.find((p) => p.name === 'Sun');

  const bigThree = [
    {
      num: '01',
      role: 'RISING SIGN (LAGNA)',
      sign: ascendant.sign,
      subtitle: `${ascendant.nakshatra} (Pada ${ascendant.pada}) • ${ascendant.degree.toFixed(2)}°`,
      desc: 'Your outward presence, instinctive interface with the physical world, and how you naturally organize experience.',
      element: SIGN_INFO[ascendant.sign]?.element || 'Fire',
    },
    {
      num: '02',
      role: 'MOON SIGN (RASHI)',
      sign: chart.moon_rashi,
      subtitle: `${moonPlanet?.nakshatra || ''} (Pada ${moonPlanet?.pada || 1}) • ${moonPlanet?.degree.toFixed(2) || '0.00'}°`,
      desc: 'Your subconscious mind, internal emotional sanctuary, memory processing, and instinctive needs.',
      element: SIGN_INFO[chart.moon_rashi]?.element || 'Water',
    },
    {
      num: '03',
      role: 'SUN SIGN (SURYA)',
      sign: sunPlanet?.sign || 'Taurus',
      subtitle: `${sunPlanet?.nakshatra || ''} (Pada ${sunPlanet?.pada || 1}) • ${sunPlanet?.degree.toFixed(2) || '0.00'}°`,
      desc: 'Your core vital essence, sovereign purpose, conscious life direction, and enduring vitality.',
      element: SIGN_INFO[sunPlanet?.sign || 'Taurus']?.element || 'Earth',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-12 max-w-4xl mx-auto"
    >
      {/* ========================================================================= */}
      {/* 1. THE BIG THREE HIGHLIGHT                                                */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
              01 // NATAL ANATOMY
            </span>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight">
              The Big Three Blueprint
            </h2>
          </div>
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase">
            WHOLE-SIGN SIDEREAL
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {bigThree.map((item) => (
            <div
              key={item.num}
              className="p-6 rounded border border-zinc-800 bg-zinc-950 flex flex-col justify-between hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-mono-code text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    {item.num} / {item.role}
                  </span>
                  <span className="font-mono-code text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                    {item.element}
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-bold text-white mb-1">
                  {item.sign}
                </h3>
                <p className="font-mono-code text-xs text-zinc-400 mb-4">
                  {item.subtitle}
                </p>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-zinc-900 font-mono-code text-[10px] text-zinc-500">
                {SIGN_INFO[item.sign]?.essence}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CURRENT LIFE CHAPTER (VIMSHOTTARI DASHA)                               */}
      {/* ========================================================================= */}
      <section className="p-6 sm:p-8 rounded border border-zinc-800 bg-zinc-950 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
          <div>
            <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
              02 // CURRENT LIFE CHAPTER
            </span>
            <h2 className="font-headline text-xl font-bold text-white tracking-tight">
              {chart.dasha?.current_mahadasha?.lord} Mahadasha Cycle
            </h2>
          </div>
          <div className="font-mono-code text-xs text-zinc-400">
            Chapter Range: <span className="text-white">{chart.dasha?.current_mahadasha?.start}</span> → <span className="text-white">{chart.dasha?.current_mahadasha?.end}</span>
          </div>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">
          The major theme of this overarching era is governed by <span className="text-white font-semibold">{chart.dasha?.current_mahadasha?.lord}</span> ({PLANET_DOMAINS[chart.dasha?.current_mahadasha?.lord]?.domain || 'Karmic Growth'}). You are cultivating long-term mastery in this life area.
        </p>

        {/* Visual Progress Bar */}
        <DashaProgressBar
          timeline={chart.dasha?.full_mahadasha_timeline || []}
          currentMaha={chart.dasha?.current_mahadasha}
          currentAntara={chart.dasha?.current_antardasha}
        />
      </section>

      {/* ========================================================================= */}
      {/* 3. PLANETARY BLUEPRINT (9 GRAHAS)                                         */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
              03 // COMPLETE BLUEPRINT
            </span>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight">
              Planetary Placements & Life Areas
            </h2>
          </div>
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase">
            9 GRAHAS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chart.planets.map((planet) => {
            const domainInfo = PLANET_DOMAINS[planet.name];
            return (
              <div
                key={planet.name}
                className="p-5 rounded border border-zinc-800 bg-zinc-950 flex flex-col justify-between hover:border-zinc-700 transition-colors"
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono-code text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      {domainInfo?.domain || 'LIFE AREA'}
                    </span>
                    {planet.retrograde && (
                      <span className="font-mono-code text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-white font-bold">
                        RETROGRADE
                      </span>
                    )}
                  </div>
                  <h4 className="font-headline text-lg font-bold text-white mb-0.5">
                    {planet.name} in {planet.sign}
                  </h4>
                  <div className="font-mono-code text-xs text-zinc-400 mb-3">
                    {HOUSE_AREAS[planet.house]} • {planet.degree.toFixed(2)}°
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                    {domainInfo?.archetypalRole}.
                  </p>
                </div>
                <div className="pt-2 border-t border-zinc-900 font-mono-code text-[10px] text-zinc-500">
                  {planet.nakshatra} (Pada {planet.pada})
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. TRADITIONAL KUNDLI SVG (COLLAPSIBLE)                                    */}
      {/* ========================================================================= */}
      <section className="pt-4 border-t border-zinc-800">
        <button
          onClick={() => setKundliOpen(!kundliOpen)}
          className="w-full p-4 rounded border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 text-left flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3">
            <Compass className="h-4 w-4 text-white" />
            <span className="font-mono-code text-xs font-bold text-white uppercase tracking-wider">
              {kundliOpen ? '[-] HIDE TRADITIONAL VEDIC KUNDLI (D1)' : '[+] VIEW TRADITIONAL VEDIC KUNDLI (D1)'}
            </span>
          </div>
          {kundliOpen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        </button>

        {kundliOpen && (
          <div className="mt-4 p-6 rounded border border-zinc-800 bg-zinc-950 animate-fadeIn">
            <KundliRenderer chart={chart} />
          </div>
        )}
      </section>
    </motion.div>
  );
}
