import { useId } from 'react'
import { cn } from '@/lib/utils'

type LogoProps = {
  size?: number
  showWordmark?: boolean
  className?: string
}

/** Square mark + optional wordmark — mark never stretches */
export function Logo({ size = 32, showWordmark = true, className = '' }: LogoProps) {
  const id = useId().replace(/:/g, '')
  return (
    <span
      className={cn('nf-logo inline-flex shrink-0 items-center gap-2', className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={showWordmark}
        role={showWordmark ? 'presentation' : 'img'}
        className="nf-logo__mark block shrink-0"
        style={{ width: size, height: size }}
      >
        <defs>
          <linearGradient
            id={`${id}-g`}
            x1="6"
            y1="34"
            x2="34"
            y2="6"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#7C3AED" />
            <stop offset="0.55" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill={`url(#${id}-g)`} />
        <path
          d="M12 28V12h3.6L22.2 22.4V12H28v16h-3.6L18.2 17.6V28H12z"
          fill="white"
          fillOpacity="0.96"
        />
        <path
          d="M23.5 25.5c3.6 0 6.2-1.9 6.2-4.8"
          stroke="white"
          strokeOpacity="0.85"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="29.7" cy="20.7" r="1.35" fill="white" fillOpacity="0.95" />
      </svg>
      {showWordmark ? (
        <span className="nf-logo__text">
          Nexora <span className="nf-logo__flow">Flow</span>
        </span>
      ) : null}
    </span>
  )
}

export default Logo
