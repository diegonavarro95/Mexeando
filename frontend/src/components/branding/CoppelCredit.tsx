import coppelLogo from '../../assets/LocoCoppel.png'

interface CoppelCreditProps {
  compact?: boolean
}

export default function CoppelCredit({ compact = false }: CoppelCreditProps) {
  return (
    <div
      className="flex items-center justify-center"
      aria-label="Coppel"
      title="Coppel"
    >
      <div className={`flex items-center justify-center ${compact ? 'h-10 w-28' : 'h-12 w-36 sm:h-14 sm:w-40'}`}>
        <img src={coppelLogo} alt="Coppel" className="max-h-full w-auto object-contain" />
      </div>
    </div>
  )
}
