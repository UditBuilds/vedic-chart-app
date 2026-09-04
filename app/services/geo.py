"""Offline city lookup service.

Provides instant city search with pre-computed latitude, longitude, and UTC
timezone offsets. 100% offline, zero network requests or API keys required.
"""

from __future__ import annotations

import unicodedata
from typing import Any, Final

#: Curated list of major global and Indian cities with accurate coordinates and standard UTC offsets.
CITIES: Final[tuple[dict[str, Any], ...]] = (
    # --- India ---
    {"name": "New Delhi", "country": "India", "region": "Delhi", "lat": 28.6139, "lon": 77.2090, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Mumbai", "country": "India", "region": "Maharashtra", "lat": 19.0760, "lon": 72.8777, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Bengaluru", "country": "India", "region": "Karnataka", "lat": 12.9716, "lon": 77.5946, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Bangalore", "country": "India", "region": "Karnataka", "lat": 12.9716, "lon": 77.5946, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Kolkata", "country": "India", "region": "West Bengal", "lat": 22.5726, "lon": 88.3639, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Chennai", "country": "India", "region": "Tamil Nadu", "lat": 13.0827, "lon": 80.2707, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Hyderabad", "country": "India", "region": "Telangana", "lat": 17.3850, "lon": 78.4867, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Pune", "country": "India", "region": "Maharashtra", "lat": 18.5204, "lon": 73.8567, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Ahmedabad", "country": "India", "region": "Gujarat", "lat": 23.0225, "lon": 72.5714, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Jaipur", "country": "India", "region": "Rajasthan", "lat": 26.9124, "lon": 75.7873, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Lucknow", "country": "India", "region": "Uttar Pradesh", "lat": 26.8467, "lon": 80.9462, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Varanasi", "country": "India", "region": "Uttar Pradesh", "lat": 25.3176, "lon": 82.9739, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Chandigarh", "country": "India", "region": "Punjab/Haryana", "lat": 30.7333, "lon": 76.7794, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Indore", "country": "India", "region": "Madhya Pradesh", "lat": 22.7196, "lon": 75.8577, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Surat", "country": "India", "region": "Gujarat", "lat": 21.1702, "lon": 72.8311, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Bhopal", "country": "India", "region": "Madhya Pradesh", "lat": 23.2599, "lon": 77.4126, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Patna", "country": "India", "region": "Bihar", "lat": 25.5941, "lon": 85.1376, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Vadodara", "country": "India", "region": "Gujarat", "lat": 22.3072, "lon": 73.1812, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Nagpur", "country": "India", "region": "Maharashtra", "lat": 21.1458, "lon": 79.0882, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Coimbatore", "country": "India", "region": "Tamil Nadu", "lat": 11.0168, "lon": 76.9558, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Kochi", "country": "India", "region": "Kerala", "lat": 9.9312, "lon": 76.2673, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Thiruvananthapuram", "country": "India", "region": "Kerala", "lat": 8.5241, "lon": 76.9366, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Guwahati", "country": "India", "region": "Assam", "lat": 26.1445, "lon": 91.7362, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Bhubaneswar", "country": "India", "region": "Odisha", "lat": 20.2961, "lon": 85.8245, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Amritsar", "country": "India", "region": "Punjab", "lat": 31.6340, "lon": 74.8723, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Agra", "country": "India", "region": "Uttar Pradesh", "lat": 27.1767, "lon": 78.0081, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Noida", "country": "India", "region": "Uttar Pradesh", "lat": 28.5355, "lon": 77.3910, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Gurugram", "country": "India", "region": "Haryana", "lat": 28.4595, "lon": 77.0266, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Gurgaon", "country": "India", "region": "Haryana", "lat": 28.4595, "lon": 77.0266, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Porbandar", "country": "India", "region": "Gujarat", "lat": 21.6417, "lon": 69.6293, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Ujjain", "country": "India", "region": "Madhya Pradesh", "lat": 23.1765, "lon": 75.7885, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Haridwar", "country": "India", "region": "Uttarakhand", "lat": 29.9457, "lon": 78.1642, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Rishikesh", "country": "India", "region": "Uttarakhand", "lat": 30.0869, "lon": 78.2676, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Dehradun", "country": "India", "region": "Uttarakhand", "lat": 30.3165, "lon": 78.0322, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Shimla", "country": "India", "region": "Himachal Pradesh", "lat": 31.1048, "lon": 77.1734, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Srinagar", "country": "India", "region": "Jammu & Kashmir", "lat": 34.0837, "lon": 74.7973, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},
    {"name": "Goa (Panaji)", "country": "India", "region": "Goa", "lat": 15.4909, "lon": 73.8278, "tz_offset": 5.5, "tz_name": "Asia/Kolkata"},

    # --- United States ---
    {"name": "New York", "country": "United States", "region": "New York", "lat": 40.7128, "lon": -74.0060, "tz_offset": -5.0, "tz_name": "America/New_York"},
    {"name": "Los Angeles", "country": "United States", "region": "California", "lat": 34.0522, "lon": -118.2437, "tz_offset": -8.0, "tz_name": "America/Los_Angeles"},
    {"name": "San Francisco", "country": "United States", "region": "California", "lat": 37.7749, "lon": -122.4194, "tz_offset": -8.0, "tz_name": "America/Los_Angeles"},
    {"name": "Chicago", "country": "United States", "region": "Illinois", "lat": 41.8781, "lon": -87.6298, "tz_offset": -6.0, "tz_name": "America/Chicago"},
    {"name": "Houston", "country": "United States", "region": "Texas", "lat": 29.7604, "lon": -95.3698, "tz_offset": -6.0, "tz_name": "America/Chicago"},
    {"name": "Dallas", "country": "United States", "region": "Texas", "lat": 32.7767, "lon": -96.7970, "tz_offset": -6.0, "tz_name": "America/Chicago"},
    {"name": "Austin", "country": "United States", "region": "Texas", "lat": 30.2672, "lon": -97.7431, "tz_offset": -6.0, "tz_name": "America/Chicago"},
    {"name": "Miami", "country": "United States", "region": "Florida", "lat": 25.7617, "lon": -80.1918, "tz_offset": -5.0, "tz_name": "America/New_York"},
    {"name": "Seattle", "country": "United States", "region": "Washington", "lat": 47.6062, "lon": -122.3321, "tz_offset": -8.0, "tz_name": "America/Los_Angeles"},
    {"name": "Boston", "country": "United States", "region": "Massachusetts", "lat": 42.3601, "lon": -71.0589, "tz_offset": -5.0, "tz_name": "America/New_York"},
    {"name": "Denver", "country": "United States", "region": "Colorado", "lat": 39.7392, "lon": -104.9903, "tz_offset": -7.0, "tz_name": "America/Denver"},
    {"name": "Atlanta", "country": "United States", "region": "Georgia", "lat": 33.7490, "lon": -84.3880, "tz_offset": -5.0, "tz_name": "America/New_York"},
    {"name": "Washington, D.C.", "country": "United States", "region": "District of Columbia", "lat": 38.9072, "lon": -77.0369, "tz_offset": -5.0, "tz_name": "America/New_York"},
    {"name": "San Jose", "country": "United States", "region": "California", "lat": 37.3382, "lon": -121.8863, "tz_offset": -8.0, "tz_name": "America/Los_Angeles"},
    {"name": "San Diego", "country": "United States", "region": "California", "lat": 32.7157, "lon": -117.1611, "tz_offset": -8.0, "tz_name": "America/Los_Angeles"},

    # --- United Kingdom & Europe ---
    {"name": "London", "country": "United Kingdom", "region": "England", "lat": 51.5074, "lon": -0.1278, "tz_offset": 0.0, "tz_name": "Europe/London"},
    {"name": "Manchester", "country": "United Kingdom", "region": "England", "lat": 53.4808, "lon": -2.2426, "tz_offset": 0.0, "tz_name": "Europe/London"},
    {"name": "Edinburgh", "country": "United Kingdom", "region": "Scotland", "lat": 55.9533, "lon": -3.1883, "tz_offset": 0.0, "tz_name": "Europe/London"},
    {"name": "Paris", "country": "France", "region": "Île-de-France", "lat": 48.8566, "lon": 2.3522, "tz_offset": 1.0, "tz_name": "Europe/Paris"},
    {"name": "Berlin", "country": "Germany", "region": "Berlin", "lat": 52.5200, "lon": 13.4050, "tz_offset": 1.0, "tz_name": "Europe/Berlin"},
    {"name": "Munich", "country": "Germany", "region": "Bavaria", "lat": 48.1351, "lon": 11.5820, "tz_offset": 1.0, "tz_name": "Europe/Berlin"},
    {"name": "Frankfurt", "country": "Germany", "region": "Hesse", "lat": 50.1109, "lon": 8.6821, "tz_offset": 1.0, "tz_name": "Europe/Berlin"},
    {"name": "Amsterdam", "country": "Netherlands", "region": "North Holland", "lat": 52.3676, "lon": 4.9041, "tz_offset": 1.0, "tz_name": "Europe/Amsterdam"},
    {"name": "Rome", "country": "Italy", "region": "Lazio", "lat": 41.9028, "lon": 12.4964, "tz_offset": 1.0, "tz_name": "Europe/Rome"},
    {"name": "Milan", "country": "Italy", "region": "Lombardy", "lat": 45.4642, "lon": 9.1900, "tz_offset": 1.0, "tz_name": "Europe/Rome"},
    {"name": "Madrid", "country": "Spain", "region": "Madrid", "lat": 40.4168, "lon": -3.7038, "tz_offset": 1.0, "tz_name": "Europe/Madrid"},
    {"name": "Barcelona", "country": "Spain", "region": "Catalonia", "lat": 41.3851, "lon": 2.1734, "tz_offset": 1.0, "tz_name": "Europe/Madrid"},
    {"name": "Dublin", "country": "Ireland", "region": "Leinster", "lat": 53.3498, "lon": -6.2603, "tz_offset": 0.0, "tz_name": "Europe/Dublin"},
    {"name": "Zurich", "country": "Switzerland", "region": "Zurich", "lat": 47.3769, "lon": 8.5417, "tz_offset": 1.0, "tz_name": "Europe/Zurich"},
    {"name": "Vienna", "country": "Austria", "region": "Vienna", "lat": 48.2082, "lon": 16.3738, "tz_offset": 1.0, "tz_name": "Europe/Vienna"},
    {"name": "Stockholm", "country": "Sweden", "region": "Stockholm", "lat": 59.3293, "lon": 18.0686, "tz_offset": 1.0, "tz_name": "Europe/Stockholm"},
    {"name": "Athens", "country": "Greece", "region": "Attica", "lat": 37.9838, "lon": 23.7275, "tz_offset": 2.0, "tz_name": "Europe/Athens"},

    # --- Asia-Pacific & Middle East ---
    {"name": "Dubai", "country": "United Arab Emirates", "region": "Dubai", "lat": 25.2048, "lon": 55.2708, "tz_offset": 4.0, "tz_name": "Asia/Dubai"},
    {"name": "Abu Dhabi", "country": "United Arab Emirates", "region": "Abu Dhabi", "lat": 24.4539, "lon": 54.3773, "tz_offset": 4.0, "tz_name": "Asia/Dubai"},
    {"name": "Singapore", "country": "Singapore", "region": "Singapore", "lat": 1.3521, "lon": 103.8198, "tz_offset": 8.0, "tz_name": "Asia/Singapore"},
    {"name": "Kuala Lumpur", "country": "Malaysia", "region": "Federal Territory", "lat": 3.1390, "lon": 101.6869, "tz_offset": 8.0, "tz_name": "Asia/Kuala_Lumpur"},
    {"name": "Bangkok", "country": "Thailand", "region": "Bangkok", "lat": 13.7563, "lon": 100.5018, "tz_offset": 7.0, "tz_name": "Asia/Bangkok"},
    {"name": "Tokyo", "country": "Japan", "region": "Tokyo", "lat": 35.6762, "lon": 139.6503, "tz_offset": 9.0, "tz_name": "Asia/Tokyo"},
    {"name": "Seoul", "country": "South Korea", "region": "Seoul", "lat": 37.5665, "lon": 126.9780, "tz_offset": 9.0, "tz_name": "Asia/Seoul"},
    {"name": "Hong Kong", "country": "Hong Kong", "region": "Hong Kong", "lat": 22.3193, "lon": 114.1694, "tz_offset": 8.0, "tz_name": "Asia/Hong_Kong"},
    {"name": "Shanghai", "country": "China", "region": "Shanghai", "lat": 31.2304, "lon": 121.4737, "tz_offset": 8.0, "tz_name": "Asia/Shanghai"},
    {"name": "Beijing", "country": "China", "region": "Beijing", "lat": 39.9042, "lon": 116.4074, "tz_offset": 8.0, "tz_name": "Asia/Shanghai"},
    {"name": "Sydney", "country": "Australia", "region": "New South Wales", "lat": -33.8688, "lon": 151.2093, "tz_offset": 10.0, "tz_name": "Australia/Sydney"},
    {"name": "Melbourne", "country": "Australia", "region": "Victoria", "lat": -37.8136, "lon": 144.9631, "tz_offset": 10.0, "tz_name": "Australia/Melbourne"},
    {"name": "Brisbane", "country": "Australia", "region": "Queensland", "lat": -27.4698, "lon": 153.0251, "tz_offset": 10.0, "tz_name": "Australia/Brisbane"},
    {"name": "Auckland", "country": "New Zealand", "region": "Auckland", "lat": -36.8485, "lon": 174.7633, "tz_offset": 12.0, "tz_name": "Pacific/Auckland"},

    # --- Americas & Canada ---
    {"name": "Toronto", "country": "Canada", "region": "Ontario", "lat": 43.6532, "lon": -79.3832, "tz_offset": -5.0, "tz_name": "America/Toronto"},
    {"name": "Vancouver", "country": "Canada", "region": "British Columbia", "lat": 49.2827, "lon": -123.1207, "tz_offset": -8.0, "tz_name": "America/Vancouver"},
    {"name": "Montreal", "country": "Canada", "region": "Quebec", "lat": 45.5017, "lon": -73.5673, "tz_offset": -5.0, "tz_name": "America/Toronto"},
    {"name": "Mexico City", "country": "Mexico", "region": "CDMX", "lat": 19.4326, "lon": -99.1332, "tz_offset": -6.0, "tz_name": "America/Mexico_City"},
    {"name": "São Paulo", "country": "Brazil", "region": "São Paulo", "lat": -23.5505, "lon": -46.6333, "tz_offset": -3.0, "tz_name": "America/Sao_Paulo"},
    {"name": "Buenos Aires", "country": "Argentina", "region": "Buenos Aires", "lat": -34.6037, "lon": -58.3816, "tz_offset": -3.0, "tz_name": "America/Argentina/Buenos_Aires"},

    # --- Africa ---
    {"name": "Cairo", "country": "Egypt", "region": "Cairo", "lat": 30.0444, "lon": 31.2357, "tz_offset": 2.0, "tz_name": "Africa/Cairo"},
    {"name": "Johannesburg", "country": "South Africa", "region": "Gauteng", "lat": -26.2041, "lon": 28.0473, "tz_offset": 2.0, "tz_name": "Africa/Johannesburg"},
    {"name": "Nairobi", "country": "Kenya", "region": "Nairobi", "lat": -1.2921, "lon": 36.8219, "tz_offset": 3.0, "tz_name": "Africa/Nairobi"},
)


def _normalize(text: str) -> str:
    """Normalize string for accent-insensitive, case-insensitive searching."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower().strip()


def search_cities(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search offline city database by prefix or substring.

    Matches against city name, region, or country.
    """
    cleaned = _normalize(query)
    if not cleaned:
        return []

    exact_prefix: list[dict[str, Any]] = []
    name_contains: list[dict[str, Any]] = []
    other_contains: list[dict[str, Any]] = []

    for city in CITIES:
        norm_name = _normalize(city["name"])
        norm_region = _normalize(city.get("region", ""))
        norm_country = _normalize(city.get("country", ""))

        if norm_name.startswith(cleaned):
            exact_prefix.append(city)
        elif cleaned in norm_name:
            name_contains.append(city)
        elif cleaned in norm_region or cleaned in norm_country:
            other_contains.append(city)

    results = (exact_prefix + name_contains + other_contains)[:limit]
    return results
