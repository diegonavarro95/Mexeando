import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import garnachin from '../../assets/garnachin.png'
import heroArt from '../../assets/hero.png'

interface AuthSplitLayoutProps {
  heroEyebrow: string
  heroTitle: string
  heroSubtitle: string
  formEyebrow?: string
  formTitle: string
  formSubtitle: string
  children: ReactNode
}

export default function AuthSplitLayout({
  heroEyebrow,
  heroTitle,
  heroSubtitle,
  formEyebrow,
  formTitle,
  formSubtitle,
  children,
}: AuthSplitLayoutProps) {
  const [showDesktopVideo, setShowDesktopVideo] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')

    const syncVideoMode = () => {
      const isStandalone = media.matches
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
      const isDesktopCanvas = window.innerWidth >= 1280 && window.innerHeight >= 760
      setShowDesktopVideo(isDesktopCanvas && !isStandalone && !isTouchDevice)
    }

    syncVideoMode()
    window.addEventListener('resize', syncVideoMode)
    media.addEventListener?.('change', syncVideoMode)

    return () => {
      window.removeEventListener('resize', syncVideoMode)
      media.removeEventListener?.('change', syncVideoMode)
    }
  }, [])

  return (
    <div className="auth-layout-root min-h-screen bg-[var(--ola-bg)] px-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))] text-[var(--ola-cream)] lg:p-4">
      <div className="auth-layout-frame mx-auto min-h-screen bg-[rgba(255,255,255,0.03)] shadow-[0_30px_80px_rgba(0,0,0,0.28)] ring-1 ring-white/6">
        <div className="auth-layout-grid grid min-h-screen">
          <section className="auth-layout-hero relative flex overflow-hidden lg:sticky lg:top-0 lg:h-[calc(100vh-2rem)]">
            {showDesktopVideo && (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              >
                <source src="/videos/home.mp4" type="video/mp4" />
              </video>
            )}
            <div className="absolute inset-0 xl:hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#195f69_0%,#143e53_30%,#1a1128_68%,#110701_100%)]" />
              <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center px-6 pt-8">
                <img
                  src={heroArt}
                  alt=""
                  aria-hidden="true"
                  className="auth-layout-art h-auto max-h-full w-auto object-contain opacity-90 drop-shadow-[0_28px_50px_rgba(0,0,0,0.38)] sm:max-w-[22rem] md:max-w-[25rem]"
                />
              </div>
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,16,24,0.20),rgba(16,12,7,0.58)_42%,rgba(8,7,5,0.82)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(12,109,91,0.20),transparent_30%),radial-gradient(circle_at_bottom,rgba(203,176,135,0.18),transparent_34%)]" />

            <div className="relative z-10 flex h-full w-full flex-col justify-center p-4 sm:p-7 md:p-8 xl:p-12 2xl:p-16">
              <div className="mb-4 flex items-center justify-center sm:mb-5 xl:mb-10">
                <div className="auth-layout-logo flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-black/78 p-3 shadow-[0_24px_45px_rgba(0,0,0,0.38)] ring-1 ring-white/12 sm:h-24 sm:w-24 md:h-28 md:w-28 xl:h-36 xl:w-36 xl:p-5">
                  <img
                    src={garnachin}
                    alt="Mexeando"
                    className="h-full w-full rounded-full object-contain"
                  />
                </div>
              </div>

              <div className="auth-layout-copy mx-auto w-full text-center text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ola-gold)] md:text-[12px] md:tracking-[0.18em]">
                  {heroEyebrow}
                </p>
                <h1 className="auth-layout-hero-title mt-3 text-[clamp(1.9rem,8vw,4.4rem)] font-black leading-[0.95] tracking-[-0.07em] sm:text-[clamp(2.15rem,6vw,4.4rem)] xl:text-[clamp(2.6rem,4vw,4.4rem)]">
                  {heroTitle}
                </h1>
                <div className="mx-auto mt-4 h-1 w-14 rounded-full bg-[var(--ola-gold-strong)] sm:mt-5 sm:w-16" />
                <p className="auth-layout-hero-subtitle mx-auto mt-4 max-w-[34rem] text-[13px] leading-6 text-[var(--ola-cream-muted)] sm:mt-5 md:text-[15px] md:leading-7">
                  {heroSubtitle}
                </p>
              </div>
            </div>
          </section>

          <section className="auth-layout-form relative flex items-center bg-[var(--ola-panel)] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8 xl:px-12 xl:py-10 2xl:px-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,193,108,0.10),transparent_30%),radial-gradient(circle_at_bottom,rgba(13,139,117,0.10),transparent_35%)]" />
            <div className="auth-layout-form-inner mx-auto flex min-h-full w-full flex-col items-center justify-center md:max-w-[32rem] xl:max-w-[30rem]">
              <div className="auth-layout-mobile-brand mb-7 w-full flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Link to="/" className="inline-flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(58,20,35,0.96),rgba(33,15,29,0.92))] p-2 shadow-[0_12px_24px_rgba(0,0,0,0.28)] ring-1 ring-white/10 sm:h-14 sm:w-14 sm:p-2.5">
                      <img src={garnachin} alt="Mexeando" className="h-full w-full rounded-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--ola-gold)]">OLA MX</p>
                      <p className="truncate text-base font-black uppercase tracking-[-0.03em] text-white sm:text-lg">Mexeando</p>
                    </div>
                  </Link>
                </div>
                <Link
                  to="/"
                  className="flex-shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ola-cream)] transition hover:bg-white/10 sm:px-4 sm:text-[11px]"
                >
                  Inicio
                </Link>
              </div>

              {formEyebrow && (
                <div className="auth-layout-form-eyebrow mb-4 w-full text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--ola-gold)]">
                    {formEyebrow}
                  </p>
                </div>
              )}

              <header className="relative mb-6 w-full text-center sm:mb-8">
                <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-black tracking-[-0.06em] text-white">
                  {formTitle}
                </h2>
                <p className="mt-2.5 text-[14px] leading-6 text-[var(--ola-cream-muted)] sm:mt-3 sm:text-[15px] sm:leading-7">
                  {formSubtitle}
                </p>
              </header>

              <div className="relative w-full">
                {children}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
