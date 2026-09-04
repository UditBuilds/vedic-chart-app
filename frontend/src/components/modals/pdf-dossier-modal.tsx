'use client';

import React from 'react';
import { Printer, Download, X, Sparkles, Shield, Compass, Star } from 'lucide-react';
import { ChartData } from '@/lib/types/chart.types';
import { SIGN_INFO, PLANET_DOMAINS, HOUSE_AREAS, computeNavamshaSign, computeSadeSatiStatus } from '@/lib/astrology-service';

interface PdfDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  chart: ChartData;
}

export function PdfDossierModal({ isOpen, onClose, chart }: PdfDossierModalProps) {
  if (!isOpen) return null;

  const asc = chart.ascendant;
  const moon = chart.planets.find((p) => p.name === 'Moon');
  const sun = chart.planets.find((p) => p.name === 'Sun');
  const dasha = chart.dasha;
  const sadeSati = computeSadeSatiStatus(chart.moon_rashi || 'Scorpio');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      <div className="card-cosmic w-full max-w-3xl p-6 sm:p-10 space-y-8 shadow-2xl relative border-white/20 my-8 max-h-[90vh] overflow-y-auto">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex justify-between items-center pb-4 border-b border-white/[0.08] print:hidden">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="font-brand text-lg font-bold text-white uppercase tracking-wider">
              Vedic Astrological Dossier (Print / PDF)
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-mono-code text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:brightness-110 shadow-md"
            >
              <Printer className="h-4 w-4" /> PRINT / SAVE AS PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded text-slate-400 hover:text-white font-mono-code text-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="bg-[#080c16] border border-white/10 p-8 sm:p-12 space-y-10 text-slate-200 font-sans print:border-none print:p-0 print:text-black print:bg-white">
          {/* Header Banner */}
          <div className="border-b border-white/15 pb-8 space-y-3 print:border-black/20">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono-code text-[10px] text-amber-400 uppercase tracking-[0.25em] font-semibold block mb-1">
                  OFFICIAL NATAL EPHEMERIS DOSSIER
                </span>
                <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-white tracking-tight print:text-black">
                  JYOTI ASTRO // VEDIC BLUEPRINT
                </h1>
              </div>
              <div className="text-right font-mono-code text-xs text-slate-400 print:text-black/60">
                <div>LAHIRI AYANAMSA</div>
                <div>SIDEREAL D1 & D9</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 font-mono-code text-xs text-slate-300 print:text-black">
              <div className="p-2.5 rounded bg-white/[0.03] border border-white/[0.06] print:bg-gray-100 print:border-gray-300">
                <span className="text-slate-500 text-[9px] uppercase block">BIRTH DATE</span>
                <span className="font-semibold">{chart.input_echo.date}</span>
              </div>
              <div className="p-2.5 rounded bg-white/[0.03] border border-white/[0.06] print:bg-gray-100 print:border-gray-300">
                <span className="text-slate-500 text-[9px] uppercase block">EXACT TIME</span>
                <span className="font-semibold">{chart.input_echo.time}</span>
              </div>
              <div className="p-2.5 rounded bg-white/[0.03] border border-white/[0.06] print:bg-gray-100 print:border-gray-300">
                <span className="text-slate-500 text-[9px] uppercase block">LOCATION</span>
                <span className="font-semibold truncate block">{chart.input_echo.city_name || 'Delhi'}</span>
              </div>
              <div className="p-2.5 rounded bg-white/[0.03] border border-white/[0.06] print:bg-gray-100 print:border-gray-300">
                <span className="text-slate-500 text-[9px] uppercase block">COORDINATES</span>
                <span className="font-semibold">{chart.input_echo.lat.toFixed(2)}°, {chart.input_echo.lon.toFixed(2)}°</span>
              </div>
            </div>
          </div>

          {/* Big Three Summary */}
          <div className="space-y-4">
            <h2 className="font-mono-code text-xs text-indigo-400 uppercase tracking-[0.2em] font-bold">
              01 // THE BIG THREE PILLARS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded border border-white/10 bg-white/[0.02] print:border-gray-300 print:bg-gray-50">
                <span className="font-mono-code text-[9px] text-slate-500 uppercase block">RISING SIGN (LAGNA)</span>
                <h3 className="font-headline text-lg font-bold text-white print:text-black mt-0.5">{asc.sign}</h3>
                <p className="font-mono-code text-[10px] text-slate-400 print:text-gray-600">{asc.nakshatra} (Pada {asc.pada}) • {asc.degree.toFixed(2)}°</p>
              </div>
              <div className="p-4 rounded border border-white/10 bg-white/[0.02] print:border-gray-300 print:bg-gray-50">
                <span className="font-mono-code text-[9px] text-slate-500 uppercase block">MOON SIGN (RASHI)</span>
                <h3 className="font-headline text-lg font-bold text-white print:text-black mt-0.5">{chart.moon_rashi}</h3>
                <p className="font-mono-code text-[10px] text-slate-400 print:text-gray-600">{moon?.nakshatra} (Pada {moon?.pada}) • {moon?.degree.toFixed(2)}°</p>
              </div>
              <div className="p-4 rounded border border-white/10 bg-white/[0.02] print:border-gray-300 print:bg-gray-50">
                <span className="font-mono-code text-[9px] text-slate-500 uppercase block">SUN SIGN (SURYA)</span>
                <h3 className="font-headline text-lg font-bold text-white print:text-black mt-0.5">{sun?.sign}</h3>
                <p className="font-mono-code text-[10px] text-slate-400 print:text-gray-600">{sun?.nakshatra} (Pada {sun?.pada}) • {sun?.degree.toFixed(2)}°</p>
              </div>
            </div>
          </div>

          {/* Planetary Matrix Table */}
          <div className="space-y-4">
            <h2 className="font-mono-code text-xs text-indigo-400 uppercase tracking-[0.2em] font-bold">
              02 // COMPLETE SIDEREAL PLANETARY POSITIONS (9 GRAHAS)
            </h2>
            <div className="overflow-x-auto border border-white/10 rounded print:border-gray-300">
              <table className="w-full text-left font-mono-code text-xs">
                <thead className="bg-white/[0.04] border-b border-white/10 text-slate-400 print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="p-3">PLANET</th>
                    <th className="p-3">RASHI (D1)</th>
                    <th className="p-3">NAVAMSHA (D9)</th>
                    <th className="p-3">DEGREE</th>
                    <th className="p-3">HOUSE</th>
                    <th className="p-3">NAKSHATRA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-200 print:text-black print:divide-gray-200">
                  {chart.planets.map((planet) => (
                    <tr key={planet.name} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-semibold text-white print:text-black flex items-center gap-1.5">
                        <span>{PLANET_DOMAINS[planet.name]?.icon}</span>
                        <span>{planet.name}</span>
                        {planet.retrograde && <span className="text-[9px] text-rose-400 font-bold">®</span>}
                      </td>
                      <td className="p-3">{planet.sign}</td>
                      <td className="p-3 text-amber-300 print:text-amber-700">{computeNavamshaSign(planet.sign, planet.degree)}</td>
                      <td className="p-3">{planet.degree.toFixed(2)}°</td>
                      <td className="p-3">{planet.house}th House</td>
                      <td className="p-3">{planet.nakshatra} (P{planet.pada})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dasha Timeline & Sade Sati */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-5 rounded border border-white/10 bg-white/[0.02] space-y-2 print:border-gray-300 print:bg-gray-50">
              <span className="font-mono-code text-[10px] text-amber-400 uppercase tracking-wider font-bold">
                ACTIVE VIMSHOTTARI DASHA ERA
              </span>
              <h4 className="font-headline text-base font-bold text-white print:text-black">
                {dasha?.current_mahadasha?.lord} Mahadasha ({dasha?.current_mahadasha?.start} → {dasha?.current_mahadasha?.end})
              </h4>
              <p className="text-xs text-slate-400 print:text-gray-600 leading-relaxed font-light">
                Sub-period (Antardasha): <span className="text-white font-medium print:text-black">{dasha?.current_antardasha?.lord}</span> Lord.
              </p>
            </div>

            <div className="p-5 rounded border border-white/10 bg-white/[0.02] space-y-2 print:border-gray-300 print:bg-gray-50">
              <span className="font-mono-code text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                SATURN 7.5-YR SADE SATI STATUS
              </span>
              <h4 className="font-headline text-base font-bold text-white print:text-black">
                {sadeSati.isActive ? `${sadeSati.phase} Phase Active` : 'Free from Sade Sati'}
              </h4>
              <p className="text-xs text-slate-400 print:text-gray-600 leading-relaxed font-light">
                {sadeSati.remedy}
              </p>
            </div>
          </div>

          {/* Footer Seal */}
          <div className="border-t border-white/15 pt-6 flex justify-between items-center text-[10px] font-mono-code text-slate-500 print:text-black/50">
            <span>JYOTIASTRO.COM // VEDIC INTELLIGENCE ENGINE</span>
            <span>100% DETERMINISTIC SWISS EPHEMERIS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
