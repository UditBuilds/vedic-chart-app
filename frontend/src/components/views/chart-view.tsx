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

function formatHouse(house: number | undefined | null): string | null {
  if (!house || typeof house !== 'number' || house < 1 || house > 12) return null;
  const suffix = ['th', 'st', 'nd', 'rd'][(house % 10 < 4 && (house % 100 < 10 || house % 100 > 20)) ? house % 10 : 0];
  return `${house}${suffix} House`;
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
    },
    {
      roleKey: 'Moon',
      role: 'MOON SIGN (RASHI)',
      sign: chart.moon_rashi,
      subtitle: `${moonPlanet?.nakshatra || ''} (Pada ${moonPlanet?.pada || 1}) • ${moonPlanet?.degree.toFixed(2) || '0.00'}°`,
      desc: 'Your subconscious mind, internal emotional sanctuary, memory processing, and instinctive needs.',
      element: SIGN_INFO[chart.moon_rashi]?.element || 'Water',
    },
    {
      roleKey: 'Sun',
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
      className="space-y-16"
    >
      {/* ========================================================================= */}
      {/* 1. THE BIG THREE HIGHLIGHT                                                */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div>
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            NATAL ANATOMY • WHOLE-SIGN SIDEREAL
          </span>
          <h2 className="font-headline text-lg sm:text-xl font-bold text-zinc-300 tracking-tight">
            The Big Three Blueprint
          </h2>
        </div>

        {/* Vertically Stacked with Strict Spacing Scale */}
        <div className="space-y-8">
          {bigThree.map((item, idx) => {
            const isPrimary = idx === 0;
            return (
              <div
                key={item.role}
                className={`space-y-2 ${idx !== 0 ? 'pt-8 border-t border-zinc-900' : ''}`}
              >
                {/* Placement Role + Element Inline */}
                <div className="flex items-center gap-2 font-mono-code text-[11px]">
                  <span className="text-zinc-500 font-semibold uppercase tracking-widest">
                    {item.role}
                  </span>
                  <span className="text-zinc-700 select-none">•</span>
                  <span className="text-zinc-600 uppercase tracking-wider">
                    {item.element}
                  </span>
                </div>

                {/* Sign Title & Degree — Only Rising (idx 0) is Display + pure white */}
                <div>
                  <h3
                    className={`font-headline tracking-tight leading-tight ${
                      isPrimary
                        ? 'text-4xl sm:text-5xl font-extrabold text-white'
                        : 'text-xl sm:text-2xl font-bold text-zinc-300'
                    }`}
                  >
                    {item.sign}
                  </h3>
                  <p className="font-mono-code text-xs text-zinc-500 mt-1">
                    {item.subtitle}
                  </p>
                </div>

                {/* Archetypal Description */}
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
                  {item.desc}
                </p>

                {/* Essence line appears once only on the Rising sign */}
                {item.roleKey === 'Rising' && SIGN_INFO[item.sign]?.essence && (
                  <p className="font-mono-code text-[11px] text-zinc-500 tracking-wide pt-0.5">
                    <span className="text-zinc-500 uppercase tracking-wider font-semibold">ESSENCE:</span>{' '}
                    <span className="text-zinc-400">{SIGN_INFO[item.sign].essence}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CURRENT LIFE CHAPTER (VIMSHOTTARI DASHA)                               */}
      {/* ========================================================================= */}
      <section className="pt-16 border-t border-zinc-900 space-y-4">
        <div className="space-y-1">
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
            CURRENT LIFE CHAPTER
          </span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="font-headline text-lg sm:text-xl font-bold text-zinc-300 tracking-tight">
              {chart.dasha?.current_mahadasha?.lord} Mahadasha
            </h2>
            <span className="font-mono-code text-xs text-zinc-500">
              ({chart.dasha?.current_mahadasha?.start} → {chart.dasha?.current_mahadasha?.end})
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
          The overarching era is governed by <span className="text-zinc-200 font-semibold">{chart.dasha?.current_mahadasha?.lord}</span> ({PLANET_DOMAINS[chart.dasha?.current_mahadasha?.lord]?.domain || 'Karmic Growth'}). You are cultivating long-term mastery in this life area.
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
      <section className="pt-16 border-t border-zinc-900 space-y-4">
        <div>
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            NATAL BLUEPRINT • 9 GRAHAS
          </span>
          <h2 className="font-headline text-lg sm:text-xl font-bold text-zinc-300 tracking-tight">
            Planetary Placements & Life Areas
          </h2>
        </div>

        {/* Single-Baseline Planetary Rows — Stepped down from Rising sign */}
        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          {chart.planets.map((planet) => {
            const domainInfo = PLANET_DOMAINS[planet.name];
            const details: { text: string; className: string }[] = [];
            if (typeof planet.degree === 'number') {
              details.push({
                text: `${planet.degree.toFixed(2)}°${planet.retrograde ? ' ℞' : ''}`,
                className: 'text-zinc-400',
              });
            }
            const houseLabel = formatHouse(planet.house);
            if (houseLabel) {
              details.push({
                text: houseLabel,
                className: 'text-zinc-500',
              });
            }
            if (planet.nakshatra) {
              details.push({
                text: `${planet.nakshatra}${planet.pada ? ` (Pada ${planet.pada})` : ''}`,
                className: 'text-zinc-500',
              });
            }

            return (
              <div key={planet.name} className="py-3 space-y-1">
                {/* Line 1: Single consistent baseline reading left-to-right without overflow */}
                <div className="flex items-baseline gap-x-2 text-sm flex-wrap">
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    <span className="font-headline font-bold text-zinc-200">
                      {planet.name}
                    </span>
                    <span className="text-zinc-600 text-xs font-serif-poetic">in</span>
                    <span className="font-headline font-bold text-zinc-200">
                      {planet.sign}
                    </span>
                  </div>

                  {details.length > 0 && (
                    <div className="flex items-baseline gap-1.5 font-mono-code text-xs">
                      {details.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && (
                            <span className="text-zinc-700 select-none shrink-0">•</span>
                          )}
                          <span className={`${item.className} shrink-0`}>
                            {item.text}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* Line 2: Category domain and role description */}
                <p className="text-xs text-zinc-400 leading-relaxed">
                  <span className="font-mono-code text-[10px] text-zinc-600 uppercase tracking-wider mr-2 font-semibold">
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
      <section className="pt-16 border-t border-zinc-900 space-y-4">
        <button
          onClick={() => setKundliOpen(!kundliOpen)}
          className="w-full py-3 text-left flex items-center justify-between group transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Compass className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            <span className="font-mono-code text-xs font-bold text-zinc-400 group-hover:text-zinc-200 uppercase tracking-wider transition-colors">
              {kundliOpen ? 'Hide Traditional Vedic Kundli (D1)' : 'View Traditional Vedic Kundli (D1)'}
            </span>
          </div>
          <span className="font-mono-code text-xs text-zinc-600 group-hover:text-zinc-400">
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
