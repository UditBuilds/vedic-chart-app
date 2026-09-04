export interface BirthData {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  lat: number;
  lon: number;
  tz_offset: number;
  city_name?: string;
}

export interface AscendantData {
  sign: string;
  degree: number;
  nakshatra: string;
  pada: number;
}

export interface PlanetPosition {
  name: string;
  sign: string;
  degree: number;
  house: number;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
}

export interface DashaPeriod {
  lord: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  level: number;
}

export interface TransitingPlanet {
  name: string;
  sign: string;
  house_from_ascendant: number;
}

export interface TransitsData {
  as_of: string;
  moon_nakshatra: string;
  moon_pada: number;
  planets: TransitingPlanet[];
}

export interface ChartData {
  input_echo: BirthData;
  ayanamsa: string;
  house_system: string;
  ascendant: AscendantData;
  planets: PlanetPosition[];
  moon_rashi: string;
  dasha: {
    system: string;
    as_of: string;
    current_mahadasha: DashaPeriod;
    current_antardasha: DashaPeriod;
    full_mahadasha_timeline: DashaPeriod[];
  };
  transits?: TransitsData;
}

export interface UserProfile {
  id: string;
  name: string;
  birth: BirthData;
  isPrimary?: boolean;
  notes?: string;
}
