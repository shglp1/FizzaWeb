import { redirect } from 'next/navigation';

/** Legacy route — canonical driver route sheet is /trips */
export default function DriverTripsRedirect() {
  redirect('/trips');
}
