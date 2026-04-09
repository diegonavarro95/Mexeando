import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { api } from '../../services/api'
import { useAuthStore, type UserRole } from '../../store/authStore'
import { supabase } from '../../lib/l-supabase'
import { hasStoredTouristPersona } from '../../lib/touristPersona'
import AuthSplitLayout from '../../components/auth/AuthSplitLayout'

const ROLE_REDIRECT: Record<UserRole, string> = {
  tourist: '/explore',
  owner: '/owner/dashboard',
  admin: '/admin',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (params.get('expired') === '1') {
      setExpired(true)
      const timeout = setTimeout(() => setExpired(false), 4000)
      return () => clearTimeout(timeout)
    }
  }, [params])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMsg('')
    setIsLoading(true)

    try {
      const { data } = await api.post<{
        data: {
          accessToken: string
          refreshToken: string
          userId: string
          role: string
          displayName?: string
          preferredLang?: string
          pointBalance?: number
        }
      }>('/api/v1/auth/login', { email, password })

      const {
        accessToken,
        refreshToken,
        userId,
        role,
        displayName,
        preferredLang,
        pointBalance,
      } = data.data

      localStorage.setItem('refreshToken', refreshToken)
      setAuth(accessToken, userId, role, displayName, preferredLang)

      if (typeof pointBalance === 'number') {
        useAuthStore.getState().setPointBalance(pointBalance)
      }

      const nextRoute =
        role === 'tourist'
          ? (hasStoredTouristPersona() ? '/explore' : '/tourist/quiz')
          : (ROLE_REDIRECT[role as UserRole] ?? '/explore')

      navigate(nextRoute, { replace: true })
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error ?? 'Credenciales inválidas. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/explore` },
    })
  }

  const handleApple = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/explore` },
    })
  }

  return (
    <AuthSplitLayout
      heroEyebrow="Bienvenido de vuelta"
      heroTitle="Tu ruta sigue aquí."
      heroSubtitle="Vuelve a entrar para retomar mapa, favoritos, pasaporte, check-ins y toda la experiencia Mexeando."
      formEyebrow="Inicio de sesión"
      formTitle="Inicia sesión"
      formSubtitle="Ingresa tus credenciales para continuar."
    >
      <AnimatePresence>
        {expired && (
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            className="mb-5 rounded-[1.15rem] border border-[var(--ola-gold)]/18 bg-[var(--ola-gold-wash)] px-4 py-3 text-sm font-semibold text-[var(--ola-gold)]"
          >
            Tu sesión expiró. Vuelve a iniciar sesión para continuar.
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleLogin} className="space-y-5">
        <FieldBlock label="Correo electrónico">
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)]" />
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className={fieldClass()}
            />
          </div>
        </FieldBlock>

        <FieldBlock
          label="Contraseña"
          action={
            <Link
              to="/forgot-password"
              className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ola-gold)] transition hover:text-white"
            >
              ¿Olvidaste?
            </Link>
          }
        >
          <div className="relative">
            <LockKeyhole size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)]" />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className={`${fieldClass()} pr-20`}
            />
            <button
              type="button"
              onClick={() => setShowPass((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ola-cream-faint)] transition hover:text-white"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </FieldBlock>

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
              Iniciando...
            </span>
          ) : (
            'Iniciar sesión'
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
          <SocialButton label="Google" onClick={handleGoogle} icon={<GoogleIcon />} />
          <SocialButton label="Apple" onClick={handleApple} icon={<AppleIcon />} />
        </div>
      </div>

      <footer className="mt-10 text-center">
        <p className="text-[15px] text-[var(--ola-cream-muted)]">
          ¿No tienes una cuenta?{' '}
          <Link to="/register" className="font-black text-[var(--ola-gold)] transition hover:text-white">
            Crear cuenta gratis
          </Link>
        </p>
      </footer>
    </AuthSplitLayout>
  )
}

function FieldBlock({
  label,
  children,
  action,
}: {
  label: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ola-cream-faint)]">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  )
}

function fieldClass() {
  return 'w-full rounded-[1.1rem] border border-white/10 bg-white px-4 py-4 pl-12 text-[15px] text-black outline-none transition placeholder:text-black/35 focus:border-[var(--ola-gold)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(244,193,108,0.10)]'
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
