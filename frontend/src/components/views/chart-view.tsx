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
      role: 'RISING SIGN (LAGNA)',
      sign: ascendant.sign,
      subtitle: `${ascendant.nakshatra} (Pada ${ascendant.pada}) • ${ascendant.degree.toFixed(2)}°`,
      desc: 'Your outward presence, instinctive interface with the physical world, and how you naturally organize experience.',
      element: SIGN_INFO[ascendant.sign]?.element || 'Fire',
    },
    {
      role: 'MOON SIGN (RASHI)',
      sign: chart.moon_rashi,
      subtitle: `${moonPlanet?.nakshatra || ''} (Pada ${moonPlanet?.pada || 1}) • ${moonPlanet?.degree.toFixed(2) || '0.00'}°`,
      desc: 'Your subconscious mind, internal emotional sanctuary, memory processing, and instinctive needs.',
      element: SIGN_INFO[chart.moon_rashi]?.element || 'Water',
    },
    {
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
      className="space-y-16 md:space-y-24 max-w-5xl mx-auto"
    >
      {/* ========================================================================= */}
      {/* 1. THE BIG THREE HIGHLIGHT                                                */}
      {/* ========================================================================= */}
      <section className="space-y-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
              NATAL ANATOMY
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-bold text-white tracking-tight">
              The Big Three Blueprint
            </h2>
          </div>
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase tracking-widest">
            WHOLE-SIGN SIDEREAL
          </span>
        </div>

        {/* Vertically Stacked with Generous Whitespace */}
        <div className="space-y-12 md:space-y-16">
          {bigThree.map((item, idx) => (
            <div
              key={item.role}
              className={`space-y-4 ${idx !== 0 ? 'pt-12 md:pt-16 border-t border-zinc-900' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono-code text-[11px] text-zinc-500 font-semibold uppercase tracking-widest">
                  {item.role}
                </span>
                <span className="font-mono-code text-xs text-zinc-500 uppercase tracking-wider">
                  {item.element}
                </span>
              </div>

              <div>
                <h3 className="font-headline text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-none mb-2">
                  {item.sign}
                </h3>
                <p className="font-mono-code text-xs sm:text-sm text-zinc-400">
                  {item.subtitle}
                </p>
              </div>

              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-3xl font-normal">
                {item.desc}
              </p>

              <p className="font-mono-code text-[11px] text-zinc-500 tracking-wide">
                {SIGN_INFO[item.sign]?.essence}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CURRENT LIFE CHAPTER (VIMSHOTTARI DASHA)                               */}
      {/* ========================================================================= */}
      <section className="pt-16 border-t border-zinc-900 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div>
            <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
              CURRENT LIFE CHAPTER
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-bold text-white tracking-tight">
              {chart.dasha?.current_mahadasha?.lord} Mahadasha Cycle
            </h2>
          </div>
          <div className="font-mono-code text-xs text-zinc-400">
            {chart.dasha?.current_mahadasha?.start} → {chart.dasha?.current_mahadasha?.end}
          </div>
        </div>

        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-3xl font-normal">
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
      <section className="pt-16 border-t border-zinc-900 space-y-8">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
              NATAL BLUEPRINT
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Planetary Placements & Life Areas
            </h2>
          </div>
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase tracking-widest">
            9 GRAHAS
          </span>
        </div>

        {/* Flat Rows with Hairline Dividers */}
        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          {chart.planets.map((planet) => {
            const domainInfo = PLANET_DOMAINS[planet.name];
            return (
              <div
                key={planet.name}
                className="py-5 sm:py-6 flex flex-col md:flex-row md:items-baseline justify-between gap-4"
              >
                {/* Left: Planet, Sign, Degree + Retrograde ℞ */}
                <div className="md:w-1/3 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-xl sm:text-2xl font-bold text-white">
                      {planet.name}
                    </span>
                    <span className="text-zinc-500 text-sm font-serif-poetic">in</span>
                    <span className="font-headline text-xl sm:text-2xl font-bold text-white">
                      {planet.sign}
                    </span>
                  </div>
                  <div className="font-mono-code text-xs text-zinc-400 flex items-center gap-2">
                    <span>{planet.degree.toFixed(2)}°</span>
                    {planet.retrograde && (
                      <span className="text-white font-serif font-bold text-sm select-none" title="Retrograde">
                        ℞
                      </span>
                    )}
                    <span className="text-zinc-600">•</span>
                    <span>{HOUSE_AREAS[planet.house]}</span>
                  </div>
                </div>

                {/* Middle: Domain & Archetypal Role */}
                <div className="md:w-1/2 space-y-1">
                  <span className="font-mono-code text-[10px] text-zinc-500 uppercase tracking-widest block">
                    {domainInfo?.domain || 'LIFE AREA'}
                  </span>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    {domainInfo?.archetypalRole}.
                  </p>
                </div>

                {/* Right: Nakshatra info */}
                <div className="md:w-1/6 md:text-right font-mono-code text-xs text-zinc-500 shrink-0">
                  {planet.nakshatra}
                  <span className="block text-[10px] text-zinc-600">
                    Pada {planet.pada}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. TRADITIONAL KUNDLI SVG (COLLAPSIBLE)                                    */}
      {/* ========================================================================= */}
      <section className="pt-16 border-t border-zinc-900 space-y-6">
        <button
          onClick={() => setKundliOpen(!kundliOpen)}
          className="w-full py-4 text-left flex items-center justify-between group transition-colors"
        >
          <div className="flex items-center gap-3">
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
          <div className="pt-4 border-t border-zinc-900">
            <KundliRenderer chart={chart} />
          </div>
        )}
      </section>
    </motion.div>
  );
}
