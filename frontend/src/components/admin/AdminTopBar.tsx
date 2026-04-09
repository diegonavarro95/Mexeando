import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import garnachin from '../../assets/garnachin.png';

interface AdminTopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
}

export default function AdminTopBar({
  title,
  subtitle = 'Panel Admin',
  onBack,
  rightSlot,
}: AdminTopBarProps) {
  return (
    <>
      <div className="h-[3px] w-full flex sticky top-0 z-[60]">
        <div className="flex-1 bg-[#006847]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#C1121F]" />
      </div>

      <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 p-5 sticky top-[3px] z-50">
        <div className="max-w-md mx-auto grid grid-cols-[40px_1fr_auto] items-center gap-4">
          <div className="flex justify-start">
            {onBack ? (
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <div className="w-10 h-10" />
            )}
          </div>

          <div className="min-w-0 flex items-center gap-3">
            <img src={garnachin} className="w-10 h-10 object-contain drop-shadow-md flex-shrink-0" alt="Admin" />
            <div className="min-w-0 flex-1">
              <h1 className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C1121F]">
                Control de Mando
              </h1>
              <p className="text-[clamp(1.35rem,4vw,1.95rem)] font-black italic text-white uppercase tracking-tighter leading-none mt-1 break-words">
                {title}
              </p>
              <p className="text-[9px] text-white/25 font-bold uppercase tracking-[0.14em] mt-2">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex justify-end items-center min-w-fit">
            {rightSlot ?? <div className="w-10 h-10" />}
          </div>
        </div>
      </header>
    </>
  );
}
