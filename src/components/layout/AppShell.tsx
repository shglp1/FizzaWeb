import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
export function AppShell({children}:{children:ReactNode}){return <div className='flex'><Sidebar/><main className='flex-1 p-4 pb-24 md:pb-4'>{children}</main><MobileNav/></div>}
