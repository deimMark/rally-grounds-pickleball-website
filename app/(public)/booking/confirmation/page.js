import { BookingResult, BookingAccessUnavailable } from '@/components/booking/booking-result';
import { demoSelection } from '@/lib/demo/booking';
export const metadata={title:'Demo confirmation',referrer:'no-referrer'};
export default async function ConfirmationPage({searchParams}){
 const params=await searchParams;
 const selection=demoSelection(params);
 if(!selection)return <BookingAccessUnavailable confirmation/>;
 const query=new URLSearchParams(Object.fromEntries(['day','court','start','duration','players'].map(key=>[key,params[key]]))).toString();
 return <BookingResult selection={selection} query={query}/>;
}
