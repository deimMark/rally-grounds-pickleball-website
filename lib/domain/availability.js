export function validateClubDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') throw new Error('Invalid club day');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid club day');
  return value;
}
export function normalizeAvailability(rows) {
  return rows.map(({ court_id, court_number, starts_at, ends_at, status, timezone }) => ({
    courtId: court_id, courtNumber: court_number, startsAt: new Date(starts_at).toISOString(),
    endsAt: new Date(ends_at).toISOString(), status, timezone,
  }));
}
