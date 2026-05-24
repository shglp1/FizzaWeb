/** Layout class constants for fixed admin sidebar shell. */

export const ADMIN_SIDEBAR_WIDTH = 'w-64';

export const ADMIN_SIDEBAR_CLASSES = {
  root: `hidden md:flex fixed inset-y-0 left-0 z-40 flex-col ${ADMIN_SIDEBAR_WIDTH} h-screen bg-fizza-primary shrink-0`,
  header: 'shrink-0 flex items-center justify-between gap-2 px-5 py-5 border-b border-white/10',
  nav: 'flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin',
  footer: 'shrink-0 px-3 pb-4 pt-2 border-t border-white/10',
} as const;

export const ADMIN_MAIN_OFFSET = `md:pl-64`;
