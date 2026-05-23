'use client';

interface LogoProps {
  /** 'dark' = white text (for dark sidebar), 'light' = brand green text (for white bg) */
  theme?: 'dark' | 'light';
  /** Show only the icon, no wordmark */
  iconOnly?: boolean;
}

export function Logo({ theme = 'dark', iconOnly = false }: LogoProps) {
  const textColor = theme === 'dark' ? 'text-white' : 'text-fizza-primary';

  return (
    <div className={`flex items-center gap-2.5 select-none ${textColor}`}>
      {/* Icon mark */}
      <div className="relative h-9 w-9 shrink-0">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-fizza-secondary to-fizza-primary" />
        {/* Stylised 'F' letter-mark */}
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect x="10" y="9"  width="10" height="3" rx="1.5" fill="white" fillOpacity="0.95" />
          <rect x="10" y="16" width="7"  height="3" rx="1.5" fill="white" fillOpacity="0.85" />
          <rect x="10" y="23" width="3"  height="4" rx="1.5" fill="white" fillOpacity="0.75" />
          {/* Speed-lines suggesting motion */}
          <rect x="21" y="18" width="5"  height="1.5" rx="0.75" fill="white" fillOpacity="0.40" />
          <rect x="23" y="21" width="3"  height="1.5" rx="0.75" fill="white" fillOpacity="0.25" />
        </svg>
      </div>

      {!iconOnly && (
        <span className="text-lg font-black tracking-wide leading-none">FIZZA</span>
      )}
    </div>
  );
}
