import { useEffect, useState } from 'react'
import { Globe, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import i18n from '../../i18n'
import AuthSplitLayout from '../../components/auth/AuthSplitLayout'

type LangOption = {
  code: string
  label: string
  flag: string
  region: string
}

const LANGUAGES: LangOption[] = [
  { code: 'es', label: 'Español', flag: '🇲🇽', region: 'MX' },
  { code: 'en', label: 'English', flag: '🇺🇸', region: 'US' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', region: 'FR' },
  { code: 'pt', label: 'Português', flag: '🇧🇷', region: 'BR' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', region: 'DE' },
  { code: 'zh', label: '中文', flag: '🇨🇳', region: 'CN' },
]

export default function LanguagePage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string>(localStorage.getItem('preferredLang') || 'es')

  useEffect(() => {
    const hasLang = localStorage.getItem('preferredLang')
    if (hasLang) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const handleContinue = async () => {
    localStorage.setItem('preferredLang', selected)
    try {
      await i18n.changeLanguage(selected)
      navigate('/login')
    } catch (error) {
      console.error(error)
      navigate('/login')
    }
  }

  return (
    <AuthSplitLayout
      heroEyebrow="Configuración inicial"
      heroTitle="Elige tu idioma."
      heroSubtitle="Deja lista la experiencia desde el primer paso para que el acceso, el mapa y la navegación se adapten mejor a ti."
      formEyebrow="Primer paso"
      formTitle="Idioma de la app"
      formSubtitle="Selecciona el idioma principal antes de iniciar sesión."
    >
      <div className="space-y-6">
        <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex rounded-xl bg-[var(--ola-gold-wash)] p-2.5 text-[var(--ola-gold)]">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--ola-gold)]">
                OLA MX
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ola-cream-muted)]">
                Esta selección se puede cambiar después desde tu perfil, pero aquí defines el idioma inicial del recorrido.
              </p>
            </div>
          </div>
        </div>

        <div className="auth-two-up">
          {LANGUAGES.map((lang) => {
            const isActive = selected === lang.code
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelected(lang.code)}
                className={`rounded-[1rem] border px-4 py-4 text-left transition ${
                  isActive
                    ? 'border-[var(--ola-gold)] bg-[var(--ola-gold-wash)] shadow-[0_12px_26px_rgba(244,193,108,0.10)]'
                    : 'border-white/10 bg-white/6 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ola-cream-faint)]">
                      {lang.region}
                    </p>
                    <p className="mt-1 truncate text-[15px] font-black text-white">{lang.label}</p>
                  </div>
                  <span className="text-2xl leading-none">{lang.flag}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-[1rem] border border-white/10 bg-white/6 px-4 py-3.5">
          <p className="flex items-start gap-2 text-[13px] leading-6 text-[var(--ola-cream-muted)]">
            <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--ola-gold)]" />
            <span>Puedes cambiar este idioma en cualquier momento desde tu perfil una vez que entres a la app.</span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,var(--ola-teal),var(--ola-teal-strong))] px-5 py-4 text-[15px] font-black uppercase tracking-[0.08em] text-white shadow-[0_16px_28px_rgba(11,123,104,0.28)] transition hover:brightness-110"
        >
          Continuar
        </button>
      </div>
    </AuthSplitLayout>
  )
}
