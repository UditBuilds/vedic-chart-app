export interface CityLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
  tz_offset: number;
}

export const CITIES_DATABASE: CityLocation[] = [
  { city: 'New Delhi', country: 'India', lat: 28.6139, lon: 77.209, tz_offset: 5.5 },
  { city: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777, tz_offset: 5.5 },
  { city: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946, tz_offset: 5.5 },
  { city: 'Kolkata', country: 'India', lat: 22.5726, lon: 88.3639, tz_offset: 5.5 },
  { city: 'Chennai', country: 'India', lat: 13.0827, lon: 80.2707, tz_offset: 5.5 },
  { city: 'Hyderabad', country: 'India', lat: 17.385, lon: 78.4867, tz_offset: 5.5 },
  { city: 'Ahmedabad', country: 'India', lat: 23.0225, lon: 72.5714, tz_offset: 5.5 },
  { city: 'Pune', country: 'India', lat: 18.5204, lon: 73.8567, tz_offset: 5.5 },
  { city: 'Jaipur', country: 'India', lat: 26.9124, lon: 75.7873, tz_offset: 5.5 },
  { city: 'Varanasi', country: 'India', lat: 25.3176, lon: 82.9739, tz_offset: 5.5 },
  { city: 'New York', country: 'USA', lat: 40.7128, lon: -74.006, tz_offset: -4.0 },
  { city: 'Los Angeles', country: 'USA', lat: 34.0522, lon: -118.2437, tz_offset: -7.0 },
  { city: 'San Francisco', country: 'USA', lat: 37.7749, lon: -122.4194, tz_offset: -7.0 },
  { city: 'Chicago', country: 'USA', lat: 41.8781, lon: -87.6298, tz_offset: -5.0 },
  { city: 'Austin', country: 'USA', lat: 30.2672, lon: -97.7431, tz_offset: -5.0 },
  { city: 'Seattle', country: 'USA', lat: 47.6062, lon: -122.3321, tz_offset: -7.0 },
  { city: 'London', country: 'UK', lat: 51.5074, lon: -0.1278, tz_offset: 1.0 },
  { city: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522, tz_offset: 2.0 },
  { city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405, tz_offset: 2.0 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041, tz_offset: 2.0 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, tz_offset: 9.0 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, tz_offset: 8.0 },
  { city: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708, tz_offset: 4.0 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, tz_offset: 10.0 },
  { city: 'Melbourne', country: 'Australia', lat: -37.8136, lon: 144.9631, tz_offset: 10.0 },
  { city: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832, tz_offset: -4.0 },
  { city: 'Vancouver', country: 'Canada', lat: 49.2827, lon: -123.1207, tz_offset: -7.0 },
];

export function searchCities(query: string, limit = 6): CityLocation[] {
  if (!query || query.trim().length === 0) return CITIES_DATABASE.slice(0, limit);
  const q = query.toLowerCase().trim();
  return CITIES_DATABASE.filter(
    (c) => c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
  ).slice(0, limit);
}
