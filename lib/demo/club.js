// Presentation fixtures only. Replace through the server data loader, not UI constants.
export const demoClub = {
  name: 'Rally Grounds',
  location: 'San Juan, La Union',
  timezone: 'Asia/Manila',
  tagline: 'Good games. Great company.',
  hoursLabel: '8 AM – 11 PM',
  hoursNote: 'Provisional hours · pending owner confirmation',
  rateCentavos: 60000,
  rateNote: 'Illustrative rate, not a booking quote',
  media: {
    src: '/images/club-placeholder.jpg',
    alt: 'A traveler looking out at the sea in Bulgaria, stock coastal photography',
    caption: 'Stock photography · not Rally Grounds facilities',
    attribution: 'Karolina Grabowska / Kaboompics',
  },
};

export const demoDays = [
  { id: '2026-11-07', label: 'Sat, 7 Nov 2026', longLabel: 'Saturday, 7 November 2026' },
  { id: '2026-11-08', label: 'Sun, 8 Nov 2026', longLabel: 'Sunday, 8 November 2026' },
  { id: '2026-11-09', label: 'Mon, 9 Nov 2026', longLabel: 'Monday, 9 November 2026' },
];

export const demoCourts = [
  { id: 'court-3', number: 3, row: 1, column: 1 },
  { id: 'court-4', number: 4, row: 1, column: 2 },
  { id: 'court-5', number: 5, row: 1, column: 3 },
  { id: 'court-2', number: 2, row: 2, column: 3 },
  { id: 'court-1', number: 1, row: 3, column: 3 },
];

const morning = [
  { id: '08:00', label: '8:00 AM', endLabel: '9:00 AM' },
  { id: '09:00', label: '9:00 AM', endLabel: '10:00 AM' },
  { id: '16:00', label: '4:00 PM', endLabel: '5:00 PM' },
  { id: '17:00', label: '5:00 PM', endLabel: '6:00 PM' },
];

// Explicit synthetic availability; no lead-time, pricing or reservation rules execute here.
const patterns = {
  '2026-11-07': { 'court-3': ['available', 'available', 'reserved', 'available'], 'court-4': ['reserved', 'available', 'available', 'available'], 'court-5': ['open-play', 'open-play', 'open-play', 'open-play'], 'court-2': ['available', 'reserved', 'available', 'available'], 'court-1': ['reserved', 'reserved', 'available', 'available'] },
  '2026-11-08': { 'court-3': ['reserved', 'available', 'available', 'reserved'], 'court-4': ['available', 'available', 'available', 'reserved'], 'court-5': ['available', 'available', 'reserved', 'available'], 'court-2': ['reserved', 'reserved', 'reserved', 'reserved'], 'court-1': ['available', 'reserved', 'available', 'available'] },
  '2026-11-09': { 'court-3': ['available', 'available', 'reserved', 'available'], 'court-4': ['available', 'reserved', 'available', 'available'], 'court-5': ['open-play', 'open-play', 'open-play', 'open-play'], 'court-2': ['available', 'available', 'available', 'available'], 'court-1': ['available', 'available', 'available', 'available'] },
};

export const demoAvailability = Object.fromEntries(Object.entries(patterns).map(([day, courts]) => [
  day, Object.fromEntries(Object.entries(courts).map(([court, statuses]) => [
    court, morning.map((slot, index) => ({ ...slot, status: statuses[index] })),
  ])),
]));

export const demoFeatures = [
  { number: '01', title: 'Your court, your crew.', text: 'Room for the friendly rivalries, the first-timers, and the “one more game” crowd.' },
  { number: '02', title: 'Come for a game. Stay for the people.', text: 'A home for a growing pickleball community on the La Union coast.' },
  { number: '03', title: 'Make time for play.', text: 'Explore our five-court concept and imagine your next session together.' },
];
