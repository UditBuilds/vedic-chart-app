'use client';

import React, { useState, useRef } from 'react';
import { Download, Copy, Share2, Check, Sparkles, X } from 'lucide-react';
import { ChartData } from '@/lib/types/chart.types';
import { SIGN_INFO, getDailyTransitWisdom } from '@/lib/astrology-service';

interface SocialCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  chart: ChartData;
}

type CardType = 'bigthree' | 'daily' | 'dasha';
type AspectRatio = 'square' | 'story';

export function SocialCardModal({ isOpen, onClose, chart }: SocialCardModalProps) {
  const [cardType, setCardType] = useState<CardType>('bigthree');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('story');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const wisdom = getDailyTransitWisdom(chart);
  const asc = chart.ascendant;
  const moon = chart.planets.find((p) => p.name === 'Moon');
  const sun = chart.planets.find((p) => p.name === 'Sun');
  const dasha = chart.dasha;

  const handleDownload = async () => {
    setGenerating(true);
    try {
      // Use Canvas to generate high-resolution PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isStory = aspectRatio === 'story';
      const width = isStory ? 1080 : 1080;
      const height = isStory ? 1920 : 1080;
      canvas.width = width;
      canvas.height = height;

      // Draw background
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle radial nebula
      const radGrad = ctx.createRadialGradient(width / 2, height / 3, 50, width / 2, height / 3, width * 0.7);
      radGrad.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
      radGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.1)');
      radGrad.addColorStop(1, 'rgba(6, 7, 10, 0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw hairline outer border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      // Top brandmark
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('✦ JYOTI ASTRO', 80, 110);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '22px "Space Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('VEDIC SIDEREAL INTELLIGENCE', width - 80, 110);

      // Content rendering based on cardType
      if (cardType === 'bigthree') {
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 24px "Space Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('// NATAL BLUEPRINT', 80, 200);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('The Big Three', 80, 270);

        const items = [
          {
            tag: '01 // RISING SIGN (LAGNA)',
            sign: asc.sign,
            sub: `${asc.nakshatra} (Pada ${asc.pada}) • ${asc.degree.toFixed(2)}°`,
            desc: 'Your outward presence, instinctive interface with the physical world.',
          },
          {
            tag: '02 // MOON SIGN (RASHI)',
            sign: chart.moon_rashi,
            sub: `${moon?.nakshatra} (Pada ${moon?.pada}) • ${moon?.degree.toFixed(2)}°`,
            desc: 'Your subconscious mind, internal emotional sanctuary and memory processing.',
          },
          {
            tag: '03 // SUN SIGN (SURYA)',
            sign: sun?.sign || 'Taurus',
            sub: `${sun?.nakshatra} (Pada ${sun?.pada}) • ${sun?.degree.toFixed(2)}°`,
            desc: 'Your core vital essence, sovereign purpose and enduring vitality.',
          },
        ];

        let startY = 360;
        items.forEach((item) => {
          // Box
          ctx.fillStyle = '#0d1322';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.5;
          const boxHeight = isStory ? 340 : 200;
          ctx.fillRect(80, startY, width - 160, boxHeight);
          ctx.strokeRect(80, startY, width - 160, boxHeight);

          ctx.fillStyle = '#818cf8';
          ctx.font = 'bold 20px "Space Mono", monospace';
          ctx.fillText(item.tag, 110, startY + 45);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(item.sign, 110, startY + 105);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '20px "Space Mono", monospace';
          ctx.fillText(item.sub, 110, startY + 145);

          if (isStory) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '22px "Inter", sans-serif';
            ctx.fillText(item.desc, 110, startY + 210);
          }

          startY += boxHeight + (isStory ? 40 : 25);
        });
      } else if (cardType === 'daily') {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px "Space Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('// DAILY CELESTIAL PULSE', 80, 200);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'italic 52px "Instrument Serif", Georgia, serif';
        const headline = `"${wisdom.headline}"`;
        ctx.fillText(headline.length > 38 ? headline.substring(0, 38) + '...' : headline, 80, 280);

        // DO box
        ctx.fillStyle = '#0d1322';
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.fillRect(80, 360, width - 160, isStory ? 420 : 280);
        ctx.strokeRect(80, 360, width - 160, isStory ? 420 : 280);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 26px "Space Mono", monospace';
        ctx.fillText('DO // HARMONIOUS ACTION', 110, 410);

        let doY = 470;
        wisdom.dos.forEach((d) => {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '24px "Inter", sans-serif';
          ctx.fillText(`—  ${d}`, 110, doY);
          doY += isStory ? 70 : 50;
        });

        // DON'T box
        const dontYStart = isStory ? 820 : 660;
        ctx.fillStyle = '#0d1322';
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.fillRect(80, dontYStart, width - 160, isStory ? 420 : 280);
        ctx.strokeRect(80, dontYStart, width - 160, isStory ? 420 : 280);

        ctx.fillStyle = '#fb7185';
        ctx.font = 'bold 26px "Space Mono", monospace';
        ctx.fillText("DON'T // FRICTIONS TO AVOID", 110, dontYStart + 50);

        let dontY = dontYStart + 110;
        wisdom.donts.forEach((d) => {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '24px "Inter", sans-serif';
          ctx.fillText(`✕  ${d}`, 110, dontY);
          dontY += isStory ? 70 : 50;
        });
      } else {
        // Dasha Era Card
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px "Space Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('// 120-YEAR VIMSHOTTARI DASHA', 80, 200);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${dasha?.current_mahadasha?.lord} Mahadasha Era`, 80, 270);

        ctx.fillStyle = '#0d1322';
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
        ctx.fillRect(80, 360, width - 160, isStory ? 700 : 480);
        ctx.strokeRect(80, 360, width - 160, isStory ? 700 : 480);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 28px "Space Mono", monospace';
        ctx.fillText(`ACTIVE PERIOD: ${dasha?.current_mahadasha?.start} → ${dasha?.current_mahadasha?.end}`, 120, 440);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '28px "Inter", sans-serif';
        ctx.fillText(`Sub-cycle (Antardasha): ${dasha?.current_antardasha?.lord} Lord`, 120, 520);
        ctx.fillText(`Governs life themes of vitality, mastery and karmic direction.`, 120, 580);
      }

      // Footer Watermark
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 20px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CALCULATED AT JYOTIASTRO.COM // SIDEREAL EPHEMERIS', width / 2, height - 70);

      // Trigger download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `jyotiastro_${cardType}_${Date.now()}.png`;
      a.click();
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Jyoti Astro Vedic Blueprint',
          text: `My Vedic Placements: ${asc.sign} Rising, ${chart.moon_rashi} Moon. Calculated with Jyoti Astro.`,
          url: window.location.origin,
        });
      } catch (e) {
        // user cancelled or share failed
      }
    } else {
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fadeIn">
      <div className="card-cosmic w-full max-w-xl p-6 sm:p-8 space-y-6 shadow-2xl relative border-white/20">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              <h3 className="font-brand text-lg font-bold text-white uppercase tracking-wider">
                Export Cosmic Social Card
              </h3>
            </div>
            <p className="font-mono-code text-xs text-slate-400 mt-1">
              Download high-res graphic poster formatted for Instagram & X
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white font-mono-code text-sm transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Template Selector */}
        <div className="space-y-3">
          <label className="font-mono-code text-[10px] text-slate-400 uppercase tracking-wider block">
            SELECT TEMPLATE:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'bigthree', label: 'THE BIG THREE' },
              { id: 'daily', label: 'DAILY DO / DONT' },
              { id: 'dasha', label: 'DASHA ERA' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setCardType(t.id as CardType)}
                className={`py-2 px-3 rounded-md font-mono-code text-xs font-bold tracking-wider transition-all uppercase ${
                  cardType === t.id
                    ? 'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-sm'
                    : 'bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="space-y-3">
          <label className="font-mono-code text-[10px] text-slate-400 uppercase tracking-wider block">
            ASPECT RATIO:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAspectRatio('story')}
              className={`py-2 px-3 rounded-md font-mono-code text-xs font-bold tracking-wider transition-all uppercase ${
                aspectRatio === 'story'
                  ? 'bg-white text-black'
                  : 'bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              9:16 STORY (IG / TIKTOK)
            </button>
            <button
              onClick={() => setAspectRatio('square')}
              className={`py-2 px-3 rounded-md font-mono-code text-xs font-bold tracking-wider transition-all uppercase ${
                aspectRatio === 'square'
                  ? 'bg-white text-black'
                  : 'bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              1:1 SQUARE (FEED / X)
            </button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div
          ref={cardRef}
          className="p-5 rounded-lg border border-white/10 bg-[#080c16] space-y-3 font-mono-code text-xs"
        >
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
            <span className="text-indigo-400 font-bold text-[10px]">✦ JYOTI ASTRO</span>
            <span className="text-slate-500 text-[9px] uppercase">
              {cardType === 'bigthree' ? 'BIG THREE BLUEPRINT' : cardType === 'daily' ? 'DAILY VIBE' : 'DASHA ERA'}
            </span>
          </div>
          {cardType === 'bigthree' && (
            <div className="space-y-1.5 text-slate-300">
              <div><span className="text-emerald-400 font-bold">ASC:</span> {asc.sign} ({asc.degree.toFixed(1)}°)</div>
              <div><span className="text-sky-300 font-bold">MOON:</span> {chart.moon_rashi} ({moon?.degree.toFixed(1)}°)</div>
              <div><span className="text-amber-400 font-bold">SUN:</span> {sun?.sign} ({sun?.degree.toFixed(1)}°)</div>
            </div>
          )}
          {cardType === 'daily' && (
            <div className="space-y-1 text-slate-300">
              <div className="text-amber-300 font-serif-poetic text-sm">&ldquo;{wisdom.headline}&rdquo;</div>
              <div className="text-[10px] text-emerald-400 font-bold mt-1">DO: {wisdom.dos[0]}</div>
              <div className="text-[10px] text-rose-400 font-bold">DON&apos;T: {wisdom.donts[0]}</div>
            </div>
          )}
          {cardType === 'dasha' && (
            <div className="space-y-1 text-slate-300">
              <div className="text-amber-300 font-bold">{dasha?.current_mahadasha?.lord} Mahadasha Era</div>
              <div className="text-slate-400 text-[10px]">{dasha?.current_mahadasha?.start} → {dasha?.current_mahadasha?.end}</div>
            </div>
          )}
          <div className="text-[8px] text-slate-500 pt-1 text-center border-t border-white/[0.06]">
            JYOTIASTRO.COM
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-lg border border-white/15 text-slate-200 hover:text-white font-mono-code text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2"
          >
            <Share2 className="h-4 w-4" /> SHARE
          </button>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-mono-code text-xs uppercase tracking-[0.2em] font-bold hover:brightness-110 shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" /> {generating ? 'EXPORTING...' : 'DOWNLOAD PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
