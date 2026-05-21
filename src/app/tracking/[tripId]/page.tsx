import { AppShell } from '@/components/layout/AppShell';
export default function Page({params}:{params:{tripId:string}}){return <AppShell><h1 className='text-2xl font-semibold'>Live Tracking #{params.tripId}</h1><div className='card mt-4 h-96 bg-gradient-to-br from-emerald-600 to-emerald-900 text-white'>Map integration fallback UI (configure NEXT_PUBLIC_MAPBOX_TOKEN)</div></AppShell>}
