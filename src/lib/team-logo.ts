const FALLBACK = "/sports-new/svg/football.svg";

function validLogo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return v;
  return null;
}

export function getTeamLogo(team: any): string {
  return (
    validLogo(team?.logoUrl) ??
    validLogo(team?.logo) ??
    validLogo(team?.image) ??
    validLogo(team?.badge) ??
    validLogo(team?.icon) ??
    FALLBACK
  );
}
