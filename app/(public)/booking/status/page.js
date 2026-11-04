import { BookingResult, BookingAccessUnavailable } from '@/components/booking/booking-result';
import { demoSelection } from '@/lib/demo/booking';
export const metadata={title:'Private status design preview',referrer:'no-referrer'};
export default async function PrivateStatusPage({searchParams}){
 const params=await searchParams;
 const selection=demoSelection(params);
 const query=new URLSearchParams(Object.fromEntries(['day','court','start','duration','players'].filter(key=>typeof params[key]==='string').map(key=>[key,params[key]]))).toString();
 return selection?<BookingResult selection={selection} privateStatus query={query}/>:<BookingAccessUnavailable/>;
}
