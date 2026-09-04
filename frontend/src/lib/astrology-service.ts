import { ChartData, BirthData } from './types/chart.types';

export const SIGN_INFO: Record<string, { symbol: string; element: string; modality: string; ruler: string; essence: string }> = {
  Aries: { symbol: '♈', element: 'Fire', modality: 'Movable', ruler: 'Mars', essence: 'Raw instinct, decisive momentum, pioneering courage.' },
  Taurus: { symbol: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus', essence: 'Sensory groundedness, persistent endurance, tangible value.' },
  Gemini: { symbol: '♊', element: 'Air', modality: 'Dual', ruler: 'Mercury', essence: 'Agile cognition, rapid synthesis, conversational curiosity.' },
  Cancer: { symbol: '♋', element: 'Water', modality: 'Movable', ruler: 'Moon', essence: 'Emotional sanctuary, instinctual empathy, protective loyalty.' },
  Leo: { symbol: '♌', element: 'Fire', modality: 'Fixed', ruler: 'Sun', essence: 'Creative sovereign, conscious expression, radiant warmth.' },
  Virgo: { symbol: '♍', element: 'Earth', modality: 'Dual', ruler: 'Mercury', essence: 'Discerning precision, somatic calibration, quiet utility.' },
  Libra: { symbol: '♎', element: 'Air', modality: 'Movable', ruler: 'Venus', essence: 'Architectural balance, relational nuance, harmonious aesthetics.' },
  Scorpio: { symbol: '♏', element: 'Water', modality: 'Fixed', ruler: 'Mars', essence: 'Unflinching depth, investigative focus, psychological renewal.' },
  Sagittarius: { symbol: '♐', element: 'Fire', modality: 'Dual', ruler: 'Jupiter', essence: 'Expansive vision, philosophical pursuit, unconstrained truth.' },
  Capricorn: { symbol: '♑', element: 'Earth', modality: 'Movable', ruler: 'Saturn', essence: 'Long-arc discipline, pragmatic structure, unyielding legacy.' },
  Aquarius: { symbol: '♒', element: 'Air', modality: 'Fixed', ruler: 'Saturn', essence: 'Systemic idealism, avant-garde intellect, collective progress.' },
  Pisces: { symbol: '♓', element: 'Water', modality: 'Dual', ruler: 'Jupiter', essence: 'Liminal imagination, boundaryless empathy, poetic surrender.' },
};

export const PLANET_DOMAINS: Record<string, { domain: string; archetypalRole: string; icon: string }> = {
  Sun: { domain: 'VITALITY & EGO', archetypalRole: 'Your conscious center & vital drive', icon: '☉' },
  Moon: { domain: 'EMOTIONAL RHYTHM', archetypalRole: 'Your subconscious mind & instinctive needs', icon: '☽' },
  Mars: { domain: 'MOMENTUM & AMBITION', archetypalRole: 'Your active will, courage & physical drive', icon: '♂' },
  Mercury: { domain: 'INTELLECT & SPEECH', archetypalRole: 'Your cognitive wiring & verbal articulation', icon: '☿' },
  Jupiter: { domain: 'WISDOM & EXPANSION', archetypalRole: 'Your philosophical horizon & higher optimism', icon: '♃' },
  Venus: { domain: 'DESIRE & AESTHETICS', archetypalRole: 'Your relational harmony & creative values', icon: '♀' },
  Saturn: { domain: 'STRUCTURE & TIME', archetypalRole: 'Your karmic endurance & disciplined boundaries', icon: '♄' },
  Rahu: { domain: 'OBSESSION & GROWTH', archetypalRole: 'Your hunger for worldly novelty & uncharted edges', icon: '☊' },
  Ketu: { domain: 'SURRENDER & INTUITION', archetypalRole: 'Your spiritual detachment & innate past mastery', icon: '☋' },
};

export const HOUSE_AREAS: Record<number, string> = {
  1: '1st House (Self, Vitality & Identity)',
  2: '2nd House (Resources, Speech & Values)',
  3: '3rd House (Drive, Siblings & Effort)',
  4: '4th House (Inner Peace, Home & Roots)',
  5: '5th House (Creative Intellect & Joy)',
  6: '6th House (Daily Craft, Service & Overcoming)',
  7: '7th House (Partnerships & Mirrors)',
  8: '8th House (Depth, Transformation & Mystery)',
  9: '9th House (Dharma, Travel & Higher Truth)',
  10: '10th House (Public Calling & Mastery)',
  11: '11th House (Networks, Gains & Alliances)',
  12: '12th House (Solitude, Subconscious & Surrender)',
};

export function getDailyTransitWisdom(chart: ChartData): {
  headline: string;
  subtext: string;
  dos: string[];
  donts: string[];
  horizon: { domain: string; planet: string; sign: string; desc: string }[];
} {
  const moonSign = chart.moon_rashi || 'Gemini';
  const ascSign = chart.ascendant.sign || 'Virgo';
  const mahadashaLord = chart.dasha?.current_mahadasha?.lord || 'Jupiter';

  return {
    headline: `"Listen to intuitive undertones. Let your imagination create meaning without forcing immediate logic."`,
    subtext: `With the transiting Moon activating the ${chart.ascendant.sign} horizon alongside your running ${mahadashaLord} cycle, quiet reflection yields far more clarity than nervous momentum.`,
    dos: [
      'Speak plainly about commitments you actually intend to keep.',
      'Organize fragmented thoughts into one clear actionable checklist.',
      'Take a quiet walk to decompress sensory overload.',
    ],
    donts: [
      "Don't make hasty verbal promises to relieve temporary tension.",
      "Don't mistake nervous busyness for genuine forward progress.",
      "Don't force consensus where people simply need time to reflect.",
    ],
    horizon: [
      {
        domain: 'Mental Focus',
        planet: 'Mercury in Gemini',
        sign: '10th House',
        desc: 'Cognitive processing is fast. Write down inspirations before they evaporate.',
      },
      {
        domain: 'Emotional Rhythm',
        planet: 'Moon in Pisces',
        sign: '7th House',
        desc: 'Sensitivity to relational undertones is heightened. Hold gentle boundaries.',
      },
      {
        domain: 'Vital Stamina',
        planet: 'Mars in Taurus',
        sign: '9th House',
        desc: 'Endurance is steady. Consistent, deliberate pacing beats erratic bursts.',
      },
    ],
  };
}

export function computeSynastryScore(chartA: ChartData, chartB: ChartData): {
  totalScore: number;
  verdict: string;
  dimensions: { title: string; score: number; description: string }[];
} {
  const moonA = chartA.moon_rashi;
  const moonB = chartB.moon_rashi;
  const sunA = chartA.planets.find((p) => p.name === 'Sun')?.sign;
  const sunB = chartB.planets.find((p) => p.name === 'Sun')?.sign;

  let harmonyScore = 78;
  if (moonA === moonB) harmonyScore += 10;
  if (sunA === sunB) harmonyScore += 6;

  return {
    totalScore: Math.min(harmonyScore, 96),
    verdict: 'High Harmonic Chemistry with Constructive Friction',
    dimensions: [
      {
        title: 'Emotional & Subconscious Resonance',
        score: 86,
        description: `Moon in ${moonA} meets Moon in ${moonB}. Instinctive needs sync naturally, allowing vulnerable communication without defensive posturing.`,
      },
      {
        title: 'Core Purpose & Creative Vitality',
        score: 82,
        description: `Sun in ${sunA} and Sun in ${sunB} share mutual respect for each other's independence and sovereign life trajectories.`,
      },
      {
        title: 'Intellectual Rhythm & Dialogue',
        score: 75,
        description: 'Conversational sparks are constant. Occasional stubbornness requires intentional pauses before reacting.',
      },
      {
        title: 'Long-Term Endurance & Karmic Bond',
        score: 88,
        description: 'Strong complementary Saturn and Jupiter placements foster durable trust and enduring relational security.',
      },
    ],
  };
}
