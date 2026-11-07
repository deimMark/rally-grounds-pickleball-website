import { BookingsView } from '@/components/staff/bookings-view';
export const metadata = { title: 'Staff bookings demo' };
// `ref` is a synthetic, non-secret sample reference used only to preselect a row.
export default async function StaffBookingsPage({ searchParams }) {
 const params = await searchParams;
 const initialRef = typeof params.ref === 'string' && /^[0-9a-f-]{36}$/.test(params.ref) ? params.ref : null;
 return <BookingsView initialRef={initialRef} />;
}
