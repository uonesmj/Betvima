/**
 * Rotate the first sport processed by a time-budgeted core odds sweep.
 * A slow or unavailable league must not permanently starve leagues at the
 * end of a fixed Map insertion order. Does not create or infer any prices.
 */
export function rotateCoreSportGroups<T>(
  groups: readonly (readonly [string, T])[],
  sweep: number,
): Array<[string, T]> {
  if (groups.length === 0) return [];
  const index = ((Math.trunc(sweep) % groups.length) + groups.length) % groups.length;
  const ordered = [...groups.slice(index), ...groups.slice(0, index)];
  return ordered.map(([key, value]): [string, T] => [key, value]);
}
