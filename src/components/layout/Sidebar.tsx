import Link from 'next/link';
import { Logo } from './Logo';
const links=['dashboard','riders','subscriptions','trips','wallet','safety','notifications','profile','admin'];
export function Sidebar(){return <aside className='hidden md:block w-64 min-h-screen bg-emerald-950 text-white p-4'><Logo/><nav className='mt-6 space-y-2'>{links.map(l=><Link key={l} href={`/${l}`} className='block rounded-lg px-3 py-2 hover:bg-emerald-800 capitalize'>{l}</Link>)}</nav></aside>}
