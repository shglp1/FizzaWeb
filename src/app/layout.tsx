import '@/styles/globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title:'FIZZA', description:'Safe Rides. Every Schedule.', manifest:'/manifest.webmanifest' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang='en'><body>{children}</body></html>}
