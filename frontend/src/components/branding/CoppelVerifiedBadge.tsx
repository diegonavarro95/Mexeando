import coppelLogo from '../../assets/LocoCoppel.png'

interface CoppelVerifiedBadgeProps {
  compact?: boolean
  folio?: number | null
}

export default function CoppelVerifiedBadge({
  compact = false,
  folio,
}: CoppelVerifiedBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[#0b7c67]/30 bg-[#0b7c67]/12 ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      }`}
    >
      <span className={`flex items-center justify-center ${compact ? 'h-7 w-10 px-1.5' : 'h-8 w-12 px-2'}`}>
        <img src={coppelLogo} alt="Coppel" className="max-h-full w-auto object-contain" />
      </span>
      <span className="min-w-0">
        <span className={`block font-black uppercase tracking-[0.14em] text-[#79d6c3] ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
          Verificado por Coppel Emprende
        </span>
        {folio ? (
          <span className={`block font-semibold text-white/75 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
            Folio #{folio}
          </span>
        ) : null}
      </span>
    </div>
  )
}
