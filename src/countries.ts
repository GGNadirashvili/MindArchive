// Our country names (from Wikidata) -> the names used by the world-atlas map data.
const ATLAS_NAMES: Record<string, string> = {
  'United States': 'United States of America',
  'Czech Republic': 'Czechia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Ivory Coast': "Côte d'Ivoire",
  'North Macedonia': 'Macedonia',
  'Cape Verde': 'Cabo Verde',
  'Saint Kitts and Nevis': 'St. Kitts and Nevis',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Republic of the Congo': 'Congo',
  'Dominican Republic': 'Dominican Rep.',
  'Central African Republic': 'Central African Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  'South Sudan': 'S. Sudan',
  'Western Sahara': 'W. Sahara',
  Eswatini: 'eSwatini',
  'Solomon Islands': 'Solomon Is.',
}

export const atlasName = (country: string) => ATLAS_NAMES[country] ?? country
