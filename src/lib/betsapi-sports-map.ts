/** Public BetsAPI sport mapping, safe to import in browser bundles. */
export const BETSAPI_SPORTS = [
  { key: 'football', id: 1, name: 'Football' },
  { key: 'basketball', id: 18, name: 'Basketball' },
  { key: 'tennis', id: 13, name: 'Tennis' },
  { key: 'volleyball', id: 91, name: 'Volleyball' },
  { key: 'ice-hockey', id: 17, name: 'Ice Hockey' },
  { key: 'cricket', id: 3, name: 'Cricket' },
  { key: 'handball', id: 78, name: 'Handball' },
  { key: 'baseball', id: 16, name: 'Baseball' },
  { key: 'american-football', id: 12, name: 'American Football' },
  { key: 'table-tennis', id: 92, name: 'Table Tennis' },
  { key: 'darts', id: 15, name: 'Darts' },
  { key: 'snooker', id: 14, name: 'Snooker' },
  { key: 'futsal', id: 83, name: 'Futsal' },
  { key: 'badminton', id: 94, name: 'Badminton' },
  { key: 'rugby-union', id: 8, name: 'Rugby Union' },
  { key: 'rugby-league', id: 19, name: 'Rugby League' },
  { key: 'australian-rules', id: 36, name: 'Australian Rules' },
  { key: 'floorball', id: 90, name: 'Floorball' },
  { key: 'beach-volleyball', id: 95, name: 'Beach Volleyball' },
  { key: 'water-polo', id: 110, name: 'Water Polo' },
  { key: 'squash', id: 107, name: 'Squash' },
  { key: 'esports', id: 151, name: 'E-sports' },
  { key: 'mma', id: 162, name: 'MMA / UFC' },
  { key: 'boxing', id: 9, name: 'Boxing' },
  { key: 'horse-racing', id: 2, name: 'Horse Racing' },
  { key: 'greyhounds', id: 4, name: 'Greyhounds' },
  { key: 'bowls', id: 66, name: 'Bowls' },
  { key: 'gaelic-sports', id: 75, name: 'Gaelic Sports' },
] as const;
export type BetsMode = 'live' | 'upcoming';
export function sportByKey(key: string) {
  return BETSAPI_SPORTS.find(item => item.key === (key === 'hockey' ? 'ice-hockey' : key));
}
