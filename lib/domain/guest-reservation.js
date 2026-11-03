// Strict input normalization; this milestone accepts synthetic email contacts only.
const guestUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function isGuestUuid(value) {
  return typeof value === 'string' && guestUuid.test(value);
}
export function exactObject(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
export function normalizeGuestReservation(value) {
  if (!exactObject(value, ['intentId', 'quoteId', 'guest', 'estimatedPlayers'])
    || !isGuestUuid(value.intentId) || !isGuestUuid(value.quoteId)
    || !Number.isInteger(value.estimatedPlayers) || value.estimatedPlayers < 1 || value.estimatedPlayers > 1000
    || !exactObject(value.guest, ['name', 'contact']) || !exactObject(value.guest.contact, ['kind', 'value'])
    || typeof value.guest.name !== 'string' || /[\u0000-\u001f\u007f]/.test(value.guest.name)
    || value.guest.contact.kind !== 'email' || typeof value.guest.contact.value !== 'string') return null;
  const name = value.guest.name.normalize('NFC').trim().replace(/\s+/g, ' ');
  const contact = value.guest.contact.value.trim().replace(/@example\.invalid$/i, '@example.invalid');
  // Reserved, non-deliverable domain prevents accidental live contact collection.
  if (!name || [...name].length > 120 || contact.length > 254
    || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@example\.invalid$/.test(contact)) return null;
  return { intentId: value.intentId, quoteId: value.quoteId, guest: { name, contact: { kind: 'email', value: contact } }, estimatedPlayers: value.estimatedPlayers };
}
export function normalizeGuestQuote(value) {
  if (!exactObject(value, ['intentId', 'courtId', 'startsAt', 'durationMinutes'])
    || !isGuestUuid(value.intentId) || !isGuestUuid(value.courtId)
    || typeof value.startsAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:00(?:\.000)?Z$/.test(value.startsAt)
    || !Number.isFinite(Date.parse(value.startsAt))
    || !Number.isInteger(value.durationMinutes) || value.durationMinutes < 1 || value.durationMinutes > 1440) return null;
  const startsAt = new Date(value.startsAt).toISOString();
  if (startsAt.replace('.000', '') !== value.startsAt.replace('.000', '')) return null;
  return { ...value, startsAt };
}
