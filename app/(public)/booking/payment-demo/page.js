import { PaymentDemo } from '@/components/payment/payment-demo';
import { BookingAccessUnavailable } from '@/components/booking/booking-result';
import { paymentDemoContext } from '@/lib/demo/payment';
export const metadata = { title: 'Payment receipt demonstration', referrer: 'no-referrer' };
const keys = ['day', 'court', 'start', 'duration', 'players', 'scenario'];
export default async function PaymentDemoPage({ searchParams }) {
 const params = await searchParams;
 const context = paymentDemoContext(params);
 if (!context) return <BookingAccessUnavailable confirmation payment />;
 const query = new URLSearchParams(Object.fromEntries(keys.filter((key) => typeof params[key] === 'string').map((key) => [key, params[key]]))).toString();
 return <PaymentDemo context={context} query={query} />;
}
