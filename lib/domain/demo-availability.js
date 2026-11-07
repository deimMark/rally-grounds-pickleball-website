export function getDemoSlots(availability, dayId, courtId) {
  return availability[dayId]?.[courtId] ?? [];
}
export function getCourtStatus(slots) {
  if (slots.some((slot) => slot.status === 'available')) return 'available';
  if (slots.length && slots.every((slot) => slot.status === 'open-play')) return 'open-play';
  return 'reserved';
}
export function formatMoney(centavos) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: centavos % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(centavos / 100);
}
export const statusLabels = { available: 'Available', reserved: 'Reserved', 'open-play': 'Open play', maintenance: 'Maintenance' };
