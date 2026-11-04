import { BookingResult, BookingAccessUnavailable } from '@/components/booking/booking-result';
import { demoSelection } from '@/lib/demo/booking';
export const metadata={title:'Private status design preview',referrer:'no-referrer'};
export default async function PrivateStatusPage({searchParams}){
 const selection=demoSelection(await searchParams);
 return selection?<BookingResult selection={selection} privateStatus/>:<BookingAccessUnavailable/>;
}
