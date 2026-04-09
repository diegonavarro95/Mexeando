import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Eye, EyeOff, Globe, Mail, ShieldCheck, Store, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { supabase } from '../../lib/l-supabase'
import { useAuthStore, type UserRole } from '../../store/authStore'
import { clearStoredTouristPersona } from '../../lib/touristPersona'
import AuthSplitLayout from '../../components/auth/AuthSplitLayout'

type Strength = 'weak' | 'medium' | 'strong'
type Role = 'tourist' | 'owner'

function getStrength(password: string): Strength {
  if (password.length < 8) return 'weak'
  const has = (regex: RegExp) => regex.test(password)
  const score =
    (has(/[a-z]/) ? 1 : 0) +
    (has(/[A-Z]/) ? 1 : 0) +
    (has(/[0-9]/) ? 1 : 0) +
    (has(/[^a-zA-Z0-9]/) ? 1 : 0)

  if (score <= 2) return 'weak'
  if (score === 3) return 'medium'
  return 'strong'
}

const STRENGTH_MAP: Record<Strength, { label: string; color: string; pct: string }> = {
  weak: { label: 'Básica', color: 'bg-[#d07c55]', pct: '33%' },
  medium: { label: 'Media', color: 'bg-[var(--ola-gold-strong)]', pct: '66%' },
  strong: { label: 'Fuerte', color: 'bg-[var(--ola-teal)]', pct: '100%' },
}

const LANGUAGES = [
  { code: 'es', label: 'MX Español', flag: '🇲🇽' },
  { code: 'en', label: 'US English', flag: '🇺🇸' },
  { code: 'fr', label: 'FR Français', flag: '🇫🇷' },
  { code: 'pt', label: 'BR Português', flag: '🇧🇷' },
  { code: 'de', label: 'DE Deutsch', flag: '🇩🇪' },
  { code: 'zh', label: 'CN 中文', flag: '🇨🇳' },
]

const ROLE_REDIRECT: Record<UserRole, string> = {
  tourist: '/tourist/quiz',
  owner: '/owner/dashboard',
  admin: '/admin',
}

export default function RegisterStep1Page() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [folio, setFolio] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [role, setRole] = useState<Role>('tourist')
  const [lang, setLang] = useState<string>(localStorage.getItem('preferredLang') ?? 'es')
  const [accepted, setAccepted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [errorMsg, setErrorMsg] = useState('')

  const strength = password.length > 0 ? getStrength(password) : null
  const isOwner = role === 'owner'

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (displayName.trim().length < 2) nextErrors.displayName = 'El nombre debe tener al menos 2 caracteres.'
    if (displayName.trim().length > 80) nextErrors.displayName = 'Máximo 80 caracteres.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Correo electrónico inválido.'
    if (password.length < 8) nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
    if (isOwner && !/^\d+$/.test(folio.trim())) nextErrors.folio = 'Ingresa un folio válido.'
    if (!accepted) nextErrors.accepted = 'Debes aceptar los Términos y Condiciones.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrorMsg('')

    try {
      const { data } = await api.post<{
        data: {
          accessToken: string
          refreshToken: string
          userId: string
          role: string
          displayName?: string
        }
      }>('/api/v1/auth/register', {
        email,
        password,
        displayName: displayName.trim(),
        role,
        preferredLang: lang,
      })

      const {
        accessToken,
        refreshToken,
        userId,
        role: returnedRole,
        displayName: returnedName,
      } = data.data

      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('preferredLang', lang)
      if (returnedRole === 'owner') {
        sessionStorage.setItem('ownerRegistrationFolio', folio.trim())
      } else {
        sessionStorage.removeItem('ownerRegistrationFolio')
        clearStoredTouristPersona()
      }
      setAuth(accessToken, userId, returnedRole, returnedName ?? displayName, lang)
      const nextRoute =
        returnedRole === 'owner'
          ? '/owner/dashboard'
          : (ROLE_REDIRECT[returnedRole as UserRole] ?? '/explore')
      navigate(nextRoute, { replace: true })
      sessionStorage.removeItem('registerStep1')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error ?? 'Error al crear la cuenta. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocial = async (provider: 'google' | 'apple') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/explore` },
    })
  }

  return (
    <AuthSplitLayout
      heroEyebrow={isOwner ? 'Registro de negocio' : 'Registro de turista'}
      heroTitle={isOwner ? 'Haz visible tu negocio.' : 'Crea tu cuenta.'}
      heroSubtitle={
        isOwner
          ? 'Empieza tu alta y prepara tu negocio para recibir más visibilidad dentro de la ruta.'
          : 'Abre tu cuenta para guardar lugares, sumar puntos y continuar la experiencia completa.'
      }
      formEyebrow={isOwner ? 'Nueva cuenta de negocio' : 'Nueva cuenta'}
      formTitle="Crear cuenta"
      formSubtitle="Completa tus datos para empezar."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FieldBlock label="Nombre visible">
          <div className="relative">
            <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)]" />
            <input
              type="text"
              placeholder="Ej. JuanViajero26"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              required
              className={fieldClass(Boolean(errors.displayName))}
            />
          </div>
          {errors.displayName && <FieldError msg={errors.displayName} />}
        </FieldBlock>

        <FieldBlock label="Correo electrónico">
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)]" />
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className={fieldClass(Boolean(errors.email))}
            />
          </div>
          {errors.email && <FieldError msg={errors.email} />}
        </FieldBlock>

        <FieldBlock label="Contraseña">
          <div className="relative">
            <ShieldCheck size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)]" />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className={`${fieldClass(Boolean(errors.password))} pr-20`}
            />
            <button
              type="button"
              onClick={() => setShowPass((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)] transition hover:text-white"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {strength && (
            <div className="rounded-[1rem] border border-white/10 bg-white/6 px-4 py-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: STRENGTH_MAP[strength].pct }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`h-full rounded-full ${STRENGTH_MAP[strength].color}`}
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[var(--ola-cream-muted)]">
                Seguridad: <span className="font-black text-white">{STRENGTH_MAP[strength].label}</span>
              </p>
            </div>
          )}

          {errors.password && <FieldError msg={errors.password} />}
        </FieldBlock>

        <FieldBlock label="Tipo de cuenta">
          <div className="auth-two-up">
            <RoleCard
              selected={role === 'tourist'}
              onSelect={() => setRole('tourist')}
              icon={<Compass size={20} />}
              title="Turista"
              desc="Explorar y guardar"
            />
            <RoleCard
              selected={role === 'owner'}
              onSelect={() => setRole('owner')}
              icon={<Store size={20} />}
              title="Dueño"
              desc="Registrar negocio"
            />
          </div>
        </FieldBlock>

        {isOwner && (
          <FieldBlock label="Folio">
            <div className="relative">
              <ShieldCheck size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)]" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej. 123456"
                value={folio}
                onChange={(event) => setFolio(event.target.value.replace(/[^\d]/g, ''))}
                className={fieldClass(Boolean(errors.folio))}
                required
              />
            </div>
            {errors.folio && <FieldError msg={errors.folio} />}
          </FieldBlock>
        )}

        <FieldBlock label="Idioma de la app">
          <div className="relative">
            <Globe size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)]" />
            <select
              value={lang}
              onChange={(event) => setLang(event.target.value)}
              className="w-full appearance-none rounded-[1.1rem] border border-white/10 bg-[#1a0a02] px-4 py-4 pl-12 text-[15px] text-[#FFF3DC] outline-none transition focus:border-[var(--ola-gold)] focus:shadow-[0_0_0_4px_rgba(244,193,108,0.10)]"
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code} className="bg-[#1a0a02] text-[#FFF3DC]">
                  {language.flag} {language.label}
                </option>
              ))}
            </select>
          </div>
        </FieldBlock>

        <div className="rounded-[1rem] border border-white/10 bg-white/6 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setAccepted((current) => !current)
              setErrors((current) => ({ ...current, accepted: '' }))
            }}
            className="flex w-full items-start gap-3 text-left"
          >
            <div
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition ${
                accepted
                  ? 'border-[var(--ola-teal)] bg-[var(--ola-teal)] text-white'
                  : 'border-white/16 bg-white/8 text-transparent'
              }`}
            >
              <ShieldCheck size={12} strokeWidth={3} />
            </div>
            <p className="text-[13px] leading-6 text-[var(--ola-cream-muted)]">
              Acepto los{' '}
              <Link to="/terms" className="font-black text-[var(--ola-gold)]" onClick={(event) => event.stopPropagation()}>
                Términos y Condiciones
              </Link>{' '}
              y el aviso de privacidad.
            </p>
          </button>
        </div>
        {errors.accepted && <FieldError msg={errors.accepted} />}

        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-[1rem] border border-[#d07c55]/22 bg-[rgba(208,124,85,0.12)] px-4 py-3 text-sm font-semibold text-[#f3b08b]"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,var(--ola-teal),var(--ola-teal-strong))] px-5 py-4 text-[15px] font-black uppercase tracking-[0.08em] text-white shadow-[0_16px_28px_rgba(11,123,104,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <SpinnerIcon />
              Creando...
            </span>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>

      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ola-cream-faint)]">
            acceso alterno
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="auth-two-up">
          <SocialButton label="Google" icon={<GoogleIcon />} onClick={() => handleSocial('google')} />
          <SocialButton label="Apple" icon={<AppleIcon />} onClick={() => handleSocial('apple')} />
        </div>
      </div>

      <footer className="mt-10 text-center">
        <p className="text-[15px] text-[var(--ola-cream-muted)]">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" className="font-black text-[var(--ola-gold)] transition hover:text-white">
            Iniciar sesión
          </Link>
        </p>
      </footer>
    </AuthSplitLayout>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block px-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ola-cream-faint)]">
        {label}
      </label>
      {children}
    </div>
  )
}

function FieldError({ msg }: { msg: string }) {
  return <p className="px-1 text-[12px] font-semibold text-[#f3b08b]">{msg}</p>
}

function fieldClass(hasError: boolean) {
  return `w-full rounded-[1.1rem] border bg-[#1a0a02] px-4 py-4 pl-12 text-[15px] text-[#FFF3DC] outline-none transition placeholder:text-white/25 ${
    hasError
      ? 'border-[#d07c55]/36 focus:border-[#d07c55] focus:shadow-[0_0_0_4px_rgba(208,124,85,0.10)]'
      : 'border-white/10 focus:border-[var(--ola-gold)] focus:shadow-[0_0_0_4px_rgba(244,193,108,0.10)]'
  }`
}

function RoleCard({
  selected,
  onSelect,
  icon,
  title,
  desc,
}: {
  selected: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[1rem] border px-4 py-4 text-left transition ${
        selected
          ? 'border-[var(--ola-gold)] bg-[var(--ola-gold-wash)] shadow-[0_10px_20px_rgba(244,193,108,0.10)]'
          : 'border-white/10 bg-white/6 hover:bg-white/10'
      }`}
    >
      <div className={`inline-flex rounded-xl p-2 ${selected ? 'bg-[rgba(244,193,108,0.14)] text-[var(--ola-gold)]' : 'bg-white/10 text-[var(--ola-cream-faint)]'}`}>
        {icon}
      </div>
      <p className="mt-3 text-sm font-black uppercase tracking-[0.08em] text-white">{title}</p>
      <p className="mt-1 text-[13px] text-[var(--ola-cream-muted)]">{desc}</p>
    </button>
  )
}

function SocialButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-[1rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-bold text-[var(--ola-cream)] transition hover:bg-white/10"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.39-1.32 2.76-2.53 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
