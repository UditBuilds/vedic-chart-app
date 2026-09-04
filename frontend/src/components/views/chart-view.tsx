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
      roleKey: 'Rising',
      role: 'RISING SIGN (LAGNA)',
      sign: ascendant.sign,
      subtitle: `${ascendant.nakshatra} (Pada ${ascendant.pada}) • ${ascendant.degree.toFixed(2)}°`,
      desc: 'Your outward presence, instinctive interface with the physical world, and how you naturally organize experience.',
      element: SIGN_INFO[ascendant.sign]?.element || 'Fire',
      prefix: 'Lagna essence',
    },
    {
      roleKey: 'Moon',
      role: 'MOON SIGN (RASHI)',
      sign: chart.moon_rashi,
      subtitle: `${moonPlanet?.nakshatra || ''} (Pada ${moonPlanet?.pada || 1}) • ${moonPlanet?.degree.toFixed(2) || '0.00'}°`,
      desc: 'Your subconscious mind, internal emotional sanctuary, memory processing, and instinctive needs.',
      element: SIGN_INFO[chart.moon_rashi]?.element || 'Water',
      prefix: 'Moon essence',
    },
    {
      roleKey: 'Sun',
      role: 'SUN SIGN (SURYA)',
      sign: sunPlanet?.sign || 'Taurus',
      subtitle: `${sunPlanet?.nakshatra || ''} (Pada ${sunPlanet?.pada || 1}) • ${sunPlanet?.degree.toFixed(2) || '0.00'}°`,
      desc: 'Your core vital essence, sovereign purpose, conscious life direction, and enduring vitality.',
      element: SIGN_INFO[sunPlanet?.sign || 'Taurus']?.element || 'Earth',
      prefix: 'Sun essence',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-10 md:space-y-12"
    >
      {/* ========================================================================= */}
      {/* 1. THE BIG THREE HIGHLIGHT                                                */}
      {/* ========================================================================= */}
      <section className="space-y-6">
        <div>
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            NATAL ANATOMY • WHOLE-SIGN SIDEREAL
          </span>
          <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
            The Big Three Blueprint
          </h2>
        </div>

        {/* Vertically Stacked with Compact, Flowing Whitespace */}
        <div className="space-y-6">
          {bigThree.map((item, idx) => (
            <div
              key={item.role}
              className={`space-y-2.5 ${idx !== 0 ? 'pt-5 border-t border-zinc-900' : ''}`}
            >
              {/* Placement Role + Element Inline */}
              <div className="flex items-center gap-2 font-mono-code text-[11px]">
                <span className="text-zinc-400 font-semibold uppercase tracking-widest">
                  {item.role}
                </span>
                <span className="text-zinc-700 select-none">•</span>
                <span className="text-zinc-500 uppercase tracking-wider">
                  {item.element}
                </span>
              </div>

              {/* Sign Title & Degree */}
              <div>
                <h3 className="font-headline text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                  {item.sign}
                </h3>
                <p className="font-mono-code text-xs text-zinc-400 mt-0.5">
                  {item.subtitle}
                </p>
              </div>

              {/* Archetypal Description */}
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                {item.desc}
              </p>

              {/* Role-Qualified Essence (Avoids byte-identical duplicate line across same signs) */}
              <p className="font-mono-code text-[11px] text-zinc-500 tracking-wide pt-0.5">
                <span className="text-zinc-400 uppercase tracking-wider">{item.prefix}:</span> {SIGN_INFO[item.sign]?.essence}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CURRENT LIFE CHAPTER (VIMSHOTTARI DASHA)                               */}
      {/* ========================================================================= */}
      <section className="pt-8 border-t border-zinc-900 space-y-4">
        <div className="space-y-1">
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
            CURRENT LIFE CHAPTER
          </span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
              {chart.dasha?.current_mahadasha?.lord} Mahadasha
            </h2>
            <span className="font-mono-code text-xs text-zinc-400">
              ({chart.dasha?.current_mahadasha?.start} → {chart.dasha?.current_mahadasha?.end})
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
          The overarching era is governed by <span className="text-white font-semibold">{chart.dasha?.current_mahadasha?.lord}</span> ({PLANET_DOMAINS[chart.dasha?.current_mahadasha?.lord]?.domain || 'Karmic Growth'}). You are cultivating long-term mastery in this life area.
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
      <section className="pt-8 border-t border-zinc-900 space-y-4">
        <div>
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            NATAL BLUEPRINT • 9 GRAHAS
          </span>
          <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
            Planetary Placements & Life Areas
          </h2>
        </div>

        {/* Single-Baseline Planetary Rows */}
        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          {chart.planets.map((planet) => {
            const domainInfo = PLANET_DOMAINS[planet.name];
            return (
              <div key={planet.name} className="py-3 space-y-1">
                {/* Line 1: Single consistent baseline reading left-to-right */}
                <div className="flex items-baseline gap-x-2 gap-y-1 flex-wrap text-sm">
                  <span className="font-headline font-bold text-white">
                    {planet.name}
                  </span>
                  <span className="text-zinc-500 text-xs font-serif-poetic">in</span>
                  <span className="font-headline font-bold text-white">
                    {planet.sign}
                  </span>
                  <span className="font-mono-code text-xs text-zinc-300">
                    {planet.degree.toFixed(2)}°{planet.retrograde ? ' ℞' : ''}
                  </span>
                  <span className="text-zinc-700 select-none">•</span>
                  <span className="font-mono-code text-xs text-zinc-400">
                    {HOUSE_AREAS[planet.house]}
                  </span>
                  <span className="text-zinc-700 select-none">•</span>
                  <span className="font-mono-code text-xs text-zinc-500">
                    {planet.nakshatra} (Pada {planet.pada})
                  </span>
                </div>

                {/* Line 2: Category domain and role description */}
                <p className="text-xs text-zinc-400 leading-relaxed">
                  <span className="font-mono-code text-[10px] text-zinc-500 uppercase tracking-wider mr-2 font-semibold">
                    {domainInfo?.domain || 'LIFE AREA'}
                  </span>
                  {domainInfo?.archetypalRole}.
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. TRADITIONAL KUNDLI SVG (COLLAPSIBLE)                                    */}
      {/* ========================================================================= */}
      <section className="pt-8 border-t border-zinc-900 space-y-4">
        <button
          onClick={() => setKundliOpen(!kundliOpen)}
          className="w-full py-3 text-left flex items-center justify-between group transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Compass className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
            <span className="font-mono-code text-xs font-bold text-zinc-300 group-hover:text-white uppercase tracking-wider transition-colors">
              {kundliOpen ? 'Hide Traditional Vedic Kundli (D1)' : 'View Traditional Vedic Kundli (D1)'}
            </span>
          </div>
          <span className="font-mono-code text-xs text-zinc-500 group-hover:text-white">
            {kundliOpen ? '↑' : '↓'}
          </span>
        </button>

        {kundliOpen && (
          <div className="pt-3 border-t border-zinc-900">
            <KundliRenderer chart={chart} />
          </div>
        )}
      </section>
    </motion.div>
  );
}
