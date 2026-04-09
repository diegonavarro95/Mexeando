import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Compass, Sparkles } from 'lucide-react'
import garnachin from '../../assets/garnachin.png'

interface AuthHighlight {
  icon: ReactNode
  title: string
  text: string
}

interface AuthShellProps {
  eyebrow: string
  title: string
  subtitle: string
  panelEyebrow: string
  panelTitle: string
  panelDescription: string
  highlights: AuthHighlight[]
  children: ReactNode
}

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  panelEyebrow,
  panelTitle,
  panelDescription,
  highlights,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-[100dvh] overflow-hidden bg-[#120701] text-crema">
      <div className="relative isolate min-h-[100dvh] bg-[radial-gradient(circle_at_top,#195f69_0%,#143e53_24%,#1a1128_58%,#110701_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.28),rgba(10,11,16,0.56)_38%,rgba(14,8,3,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,112,121,0.22),transparent_34%),radial-gradient(circle_at_bottom,rgba(193,130,43,0.14),transparent_34%)]" />
        <div className="pointer-events-none absolute -left-24 top-20 h-[24rem] w-[24rem] rounded-full bg-[#c98c31]/16 blur-[120px] sm:h-[28rem] sm:w-[28rem] sm:blur-[130px]" />
        <div className="pointer-events-none absolute right-[-5rem] top-[-2rem] h-[26rem] w-[26rem] rounded-full bg-[#0f6c6f]/24 blur-[120px] sm:h-[32rem] sm:w-[32rem] sm:blur-[140px]" />

        <div className="relative z-10">
          <header className="border-b border-white/10 bg-[#120701]/35 backdrop-blur-xl">
            <div className="app-shell-wide flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:px-6">
              <Link to="/" className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="rounded-[1.15rem] border border-[#f1c98d]/18 bg-[linear-gradient(180deg,rgba(58,20,35,0.96),rgba(33,15,29,0.92))] p-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.3)] sm:rounded-[1.35rem] sm:p-3">
                  <img
                    src={garnachin}
                    alt="Mexeando"
                    className="h-9 w-9 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] sm:h-11 sm:w-11"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#f1c98d] sm:text-[10px] sm:tracking-[0.3em]">
                    Ola MX
                  </p>
                  <p className="truncate text-[13px] font-black uppercase tracking-[0.02em] text-white sm:text-[15px]">
                    Mexeando
                  </p>
                  <p className="mt-0.5 hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:block">
                    No visites Mexico ¡VIVELO!
                  </p>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <Link
                  to="/"
                  className="hidden rounded-full border border-white/14 bg-white/6 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-crema/85 transition hover:border-white/22 hover:bg-white/10 hover:text-white md:inline-flex"
                >
                  Inicio
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex rounded-full bg-[linear-gradient(135deg,#0d8b75,#0a6d5b)] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-[0_14px_28px_rgba(11,123,104,0.32)] transition hover:brightness-110 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-[0.14em]"
                >
                  Explorar
                </Link>
              </div>
            </div>
          </header>

          <main className="app-shell-wide px-4 py-8 sm:px-5 sm:py-10 lg:px-6 lg:py-12">
            <div className="grid min-h-[calc(100dvh-7rem)] items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,31rem)] lg:gap-10">
              <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(43,18,8,0.72),rgba(18,8,20,0.6))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-7 lg:min-h-[41rem] lg:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,193,108,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(13,139,117,0.12),transparent_30%)]" />
                <div className="relative flex h-full flex-col">
                  <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border border-[#f4c16c]/28 bg-black/30 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#f4c16c] backdrop-blur-sm sm:text-[11px] sm:tracking-[0.24em]">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>{eyebrow}</span>
                  </div>

                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex h-18 w-18 items-center justify-center rounded-[1.45rem] border border-[#f4c16c]/22 bg-[radial-gradient(circle_at_top,rgba(110,36,54,0.94)_0%,rgba(58,21,37,0.94)_100%)] shadow-[0_20px_36px_rgba(0,0,0,0.34)] backdrop-blur-sm sm:h-20 sm:w-20 sm:rounded-[1.8rem]">
                      <img
                        src={garnachin}
                        alt="Mexeando"
                        className="h-14 w-14 object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.35)] sm:h-16 sm:w-16"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-10 rounded-full bg-[#006847]" />
                      <span className="h-1.5 w-10 rounded-full bg-white/85" />
                      <span className="h-1.5 w-10 rounded-full bg-[#C1121F]" />
                    </div>
                  </div>

                  <h1 className="mt-8 max-w-[12ch] text-[clamp(2.6rem,8vw,4.6rem)] font-black leading-[0.92] tracking-[-0.07em] text-white">
                    {title}
                  </h1>
                  <p className="mt-5 max-w-2xl text-[15px] leading-7 text-crema/82 sm:text-base">
                    {subtitle}
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {highlights.map((highlight) => (
                      <article
                        key={highlight.title}
                        className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4 backdrop-blur-sm transition hover:border-white/18 hover:bg-white/[0.08] sm:p-5"
                      >
                        <div className="inline-flex rounded-2xl bg-[#fff2dc] p-3 text-[#ba7410]">
                          {highlight.icon}
                        </div>
                        <h2 className="mt-4 text-lg font-black uppercase text-white">
                          {highlight.title}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-crema/68 sm:text-[15px] sm:leading-7">
                          {highlight.text}
                        </p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-8 space-y-3 lg:mt-auto">
                    <StoryLine text="Tu primera impresión importa: aquí el producto ya debe sentirse premium." />
                    <StoryLine text="La identidad visual se mantiene alineada con la portada pública." />
                    <StoryLine text="Desktop y móvil comparten jerarquía clara y CTA visibles." />
                  </div>
                </div>
              </section>

              <section className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(25,12,7,0.96),rgba(16,8,15,0.92))] shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                <div className="h-1 w-full">
                  <div className="flex h-full">
                    <div className="flex-1 bg-[#006847]" />
                    <div className="flex-1 bg-white/90" />
                    <div className="flex-1 bg-[#C1121F]" />
                  </div>
                </div>
                <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(244,193,108,0.12),transparent_58%)]" />
                <div className="relative p-5 sm:p-7">
                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#f4c16c]/24 bg-[#f4c16c]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#f4c16c]">
                      <Compass className="h-4 w-4" />
                      <span>{panelEyebrow}</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-black uppercase tracking-[-0.05em] text-white sm:text-[2.2rem]">
                      {panelTitle}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-crema/68 sm:text-[15px] sm:leading-7">
                      {panelDescription}
                    </p>
                  </div>

                  {children}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function StoryLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="mt-1 text-[#f4c16c]">
        <ChevronRight className="h-4 w-4" />
      </div>
      <p className="text-left text-sm leading-6 text-crema/70">{text}</p>
    </div>
  )
}
