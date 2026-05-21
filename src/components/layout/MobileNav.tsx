import Link from 'next/link';
export function MobileNav(){return <nav className='md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-2 grid grid-cols-5 text-xs'>{['dashboard','trips','wallet','notifications','profile'].map(l=><Link key={l} className='text-center capitalize' href={`/${l}`}>{l}</Link>)}</nav>}
