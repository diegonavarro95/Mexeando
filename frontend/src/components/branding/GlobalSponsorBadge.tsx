import coppelLogo from '../../assets/LocoCoppel.png'

export default function GlobalSponsorBadge() {
  return (
    <div className="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-[85]">
      <div
        className="flex max-w-[calc(100vw-1.5rem)] items-center sm:max-w-none"
        aria-label="Aliado principal: Coppel"
        title="Coppel"
      >
        <div className="flex h-9 w-[4.5rem] flex-shrink-0 items-center justify-center sm:h-10 sm:w-[5rem]">
          <img src={coppelLogo} alt="Coppel" className="max-h-full w-auto object-contain" />
        </div>
      </div>
    </div>
  )
}
