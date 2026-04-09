import coppelLogo from '../../assets/LocoCoppel.png'

interface PartnerInlineMarkProps {
  compact?: boolean
  large?: boolean
}

export default function PartnerInlineMark({ compact = false, large = false }: PartnerInlineMarkProps) {
  const sizeClass = large
    ? 'h-10 w-24 sm:h-12 sm:w-28'
    : compact
      ? 'h-7 w-10'
      : 'h-8 w-12'

  return (
    <div
      className="inline-flex items-center"
      aria-label="Aliado principal: Coppel"
      title="Coppel"
    >
      <div className={`flex items-center justify-center ${sizeClass}`}>
        <img src={coppelLogo} alt="Coppel" className="max-h-full w-auto object-contain" />
      </div>
    </div>
  )
}
