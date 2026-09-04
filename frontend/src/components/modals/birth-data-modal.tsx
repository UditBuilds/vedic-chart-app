'use client';

import React, { useState } from 'react';
import { BirthData } from '@/lib/types/chart.types';
import { searchCities as searchLocalCities, CityLocation } from '@/lib/city-database';
import { astrologyApi } from '@/lib/api-client';

interface BirthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (birth: BirthData) => void;
  currentBirth: BirthData;
}

export function BirthDataModal({ isOpen, onClose, onSubmit, currentBirth }: BirthModalProps) {
  const [date, setDate] = useState(currentBirth.date);
  const [time, setTime] = useState(currentBirth.time);
  const [citySearch, setCitySearch] = useState(currentBirth.city_name || '');
  const [lat, setLat] = useState(currentBirth.lat);
  const [lon, setLon] = useState(currentBirth.lon);
  const [tzOffset, setTzOffset] = useState(currentBirth.tz_offset);
  const [suggestions, setSuggestions] = useState<CityLocation[]>([]);
  const [showManual, setShowManual] = useState(false);

  if (!isOpen) return null;

  const handleCityChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCitySearch(val);
    if (val.trim().length > 0) {
      try {
        const geoResults = await astrologyApi.searchGeoCities(val, 8);
        if (geoResults && geoResults.length > 0) {
          setSuggestions(
            geoResults.map((r) => ({
              city: r.name,
              country: r.country,
              lat: r.lat,
              lon: r.lon,
              tz_offset: r.tz_offset,
            }))
          );
          return;
        }
      } catch (err) {
        // Fallback to local database below
      }
      setSuggestions(searchLocalCities(val));
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectCity = (city: CityLocation) => {
    setCitySearch(`${city.city}, ${city.country}`);
    setLat(city.lat);
    setLon(city.lon);
    setTzOffset(city.tz_offset);
    setSuggestions([]);
  };

  const handlePreset = (preset: { label: string; date: string; time: string; city: string; lat: number; lon: number; tz: number }) => {
    setDate(preset.date);
    setTime(preset.time);
    setCitySearch(preset.city);
    setLat(preset.lat);
    setLon(preset.lon);
    setTzOffset(preset.tz);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let formattedTime = time.trim();
    if (formattedTime.length === 5) {
      formattedTime = `${formattedTime}:00`;
    }
    onSubmit({
      date,
      time: formattedTime,
      lat: Number(lat),
      lon: Number(lon),
      tz_offset: Number(tzOffset),
      city_name: citySearch || 'Custom Location',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-zinc-800">
          <div>
            <h2 className="font-headline text-xl font-bold text-white tracking-tight">
              CALCULATE YOUR CHART
            </h2>
            <p className="font-mono-code text-xs text-zinc-500 mt-0.5">
              100% deterministic offline Sidereal calculation engine
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white font-mono-code text-sm"
          >
            [✕]
          </button>
        </div>

        {/* Quick Presets */}
        <div className="p-3 rounded border border-zinc-900 bg-zinc-900/50 space-y-2">
          <span className="font-mono-code text-[10px] text-zinc-500 uppercase tracking-wider block">
            FAST PRESETS FOR VERIFICATION:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePreset({ label: '1998 Reference', date: '1998-05-24', time: '14:30:00', city: 'New Delhi, India', lat: 28.6139, lon: 77.209, tz: 5.5 })}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 font-mono-code text-[11px] text-zinc-300 hover:border-white hover:text-white transition-colors"
            >
              ★ 1998 Reference (New Delhi)
            </button>
            <button
              type="button"
              onClick={() => handlePreset({ label: '2000 London', date: '2000-01-01', time: '06:00:00', city: 'London, UK', lat: 51.5074, lon: -0.1278, tz: 0.0 })}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 font-mono-code text-[11px] text-zinc-300 hover:border-white hover:text-white transition-colors"
            >
              ★ 2000 London Millennial
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono-code text-xs">
          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-zinc-400 text-[10px] tracking-wider uppercase block font-semibold">
                BIRTH DATE (YYYY-MM-DD)
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-white transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-zinc-400 text-[10px] tracking-wider uppercase block font-semibold">
                BIRTH TIME (HH:MM:SS)
              </label>
              <input
                type="time"
                step="1"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* City Autocomplete */}
          <div className="space-y-1.5 relative">
            <label className="text-zinc-400 text-[10px] tracking-wider uppercase block font-semibold">
              BIRTH CITY (AUTO-COORDINATES)
            </label>
            <input
              type="text"
              placeholder="Search e.g. New Delhi, New York, London, Tokyo..."
              value={citySearch}
              onChange={handleCityChange}
              className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-white transition-colors"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-xl max-h-48 overflow-y-auto z-20">
                {suggestions.map((c) => (
                  <div
                    key={`${c.city}-${c.country}`}
                    onClick={() => handleSelectCity(c)}
                    className="px-3 py-2 cursor-pointer hover:bg-white hover:text-black flex justify-between items-center transition-colors text-xs border-b border-zinc-800 last:border-0"
                  >
                    <span>{c.city}, {c.country}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {c.lat.toFixed(2)}°, {c.lon.toFixed(2)}° (UTC {c.tz_offset >= 0 ? `+${c.tz_offset}` : c.tz_offset})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Manual Coordinates */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 underline"
            >
              {showManual ? '[-] Hide Raw Coordinates' : '[+] Edit Raw Coordinates & Timezone Offset'}
            </button>
          </div>

          {showManual && (
            <div className="grid grid-cols-3 gap-3 p-3 rounded bg-zinc-900/80 border border-zinc-800">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase block">LATITUDE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase block">LONGITUDE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase block">TZ OFFSET (HOURS)</label>
                <input
                  type="number"
                  step="0.5"
                  value={tzOffset}
                  onChange={(e) => setTzOffset(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-white text-xs"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-zinc-800 text-zinc-400 hover:text-white transition-colors text-xs"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded bg-white text-black font-bold hover:bg-zinc-200 transition-colors text-xs tracking-wider uppercase"
            >
              COMPUTE CHART →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
