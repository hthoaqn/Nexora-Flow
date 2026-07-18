'use client'

export function TechGridBg() {
  return (
    <div className="fixed inset-0 z-[-3] pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Vertical grid lines with traces */}
      <div className="absolute inset-0 flex justify-between px-[10%] opacity-[0.06] dark:opacity-[0.03] text-current">
        <div className="w-[1px] h-full bg-current relative">
          <div className="absolute w-[4px] h-[4px] rounded-full bg-current left-[-1.5px] animate-pulse-flow-y" style={{ animationDelay: '0s' }} />
        </div>
        <div className="w-[1px] h-full bg-current relative">
          <div className="absolute w-[4px] h-[4px] rounded-full bg-current left-[-1.5px] animate-pulse-flow-y" style={{ animationDelay: '3s' }} />
        </div>
        <div className="w-[1px] h-full bg-current relative">
          <div className="absolute w-[4px] h-[4px] rounded-full bg-current left-[-1.5px] animate-pulse-flow-y" style={{ animationDelay: '7s' }} />
        </div>
        <div className="w-[1px] h-full bg-current relative">
          <div className="absolute w-[4px] h-[4px] rounded-full bg-current left-[-1.5px] animate-pulse-flow-y" style={{ animationDelay: '11s' }} />
        </div>
        <div className="w-[1px] h-full bg-current relative">
          <div className="absolute w-[4px] h-[4px] rounded-full bg-current left-[-1.5px] animate-pulse-flow-y" style={{ animationDelay: '16s' }} />
        </div>
      </div>

      {/* Horizontal grid lines with traces */}
      <div className="absolute inset-0 flex flex-col justify-between py-[12%] opacity-[0.06] dark:opacity-[0.03] text-current">
        <div className="h-[1px] w-full bg-current relative">
          <div className="absolute h-[4px] w-[4px] rounded-full bg-current top-[-1.5px] animate-pulse-flow-x" style={{ animationDelay: '1s' }} />
        </div>
        <div className="h-[1px] w-full bg-current relative">
          <div className="absolute h-[4px] w-[4px] rounded-full bg-current top-[-1.5px] animate-pulse-flow-x" style={{ animationDelay: '5s' }} />
        </div>
        <div className="h-[1px] w-full bg-current relative">
          <div className="absolute h-[4px] w-[4px] rounded-full bg-current top-[-1.5px] animate-pulse-flow-x" style={{ animationDelay: '10s' }} />
        </div>
        <div className="h-[1px] w-full bg-current relative">
          <div className="absolute h-[4px] w-[4px] rounded-full bg-current top-[-1.5px] animate-pulse-flow-x" style={{ animationDelay: '14s' }} />
        </div>
      </div>
    </div>
  )
}
export default TechGridBg
