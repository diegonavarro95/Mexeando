import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  ChevronRight,
  Compass,
  Languages,
  LockKeyhole,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  Trophy,
} from 'lucide-react';
import { useAuthStore, type UserRole } from '../../store/authStore';
import garnachin from '../../assets/garnachin.png';

const ROLE_HOME: Record<UserRole, string> = {
  tourist: '/explore',
  owner: '/owner/dashboard',
  admin: '/admin',
};

const FEATURES = [
  {
    title: 'Explora cerca',
    text: 'Encuentra la garnacha perfecta a pasos del estadio o de tu hospedaje.',
    icon: MapPinned,
  },
  {
    title: 'Menú en tu idioma',
    text: 'Consulta platillos y descripciones con apoyo multilingüe pensado para turistas.',
    icon: Languages,
  },
  {
    title: 'Colecciona y gana',
    text: 'Haz check-in, suma puntos y completa tu pasaporte de estampas.',
    icon: Trophy,
  },
  {
    title: "Confianza 'Ola'",
    text: 'Negocios visibles, certificados y enfocados en autenticidad local.',
    icon: ShieldCheck,
  },
];

const STEPS = [
  {
    title: 'Descubre',
    text: 'Explora rutas, negocios y recomendaciones cercanas desde la portada pública.',
  },
  {
    title: 'Interactúa',
    text: 'Inicia sesión o regístrate para desbloquear el mapa, tus guardados y la experiencia completa.',
  },
  {
    title: 'Recorre',
    text: 'Usa la app como PWA en móvil para check-ins, álbum, mapa y asistencia contextual.',
  },
];

export default function HomePage() {
  const { accessToken, userRole } = useAuthStore();
  const appHref = accessToken && userRole ? ROLE_HOME[userRole] : '/login';
  const exploreHref = accessToken ? '/explore' : '/login';
  const appLabel = 'Iniciar sesión';
  const registerLabel = 'Registrarse';

  return (
    <>
      <div className="bg-[#120701] pb-24 text-crema sm:pb-28">
        <div className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top,#195f69_0%,#143e53_28%,#1a1128_64%,#110701_100%)]">
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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.34),rgba(10,11,16,0.64)_38%,rgba(14,8,3,0.9)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,112,121,0.24),transparent_34%),radial-gradient(circle_at_bottom,rgba(193,130,43,0.14),transparent_32%)]" />
          <div className="pointer-events-none absolute -left-24 top-20 h-[24rem] w-[24rem] bg-[#c98c31]/18 blur-[120px] sm:h-[28rem] sm:w-[28rem] sm:blur-[130px]" />
          <div className="pointer-events-none absolute right-[-5rem] top-0 h-[26rem] w-[26rem] bg-[#0f6c6f]/28 blur-[120px] sm:h-[32rem] sm:w-[32rem] sm:blur-[140px]" />

          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#120701]/45 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-5 sm:py-3.5 lg:px-6">
              <div className="flex items-center justify-between gap-3">
                <Link to="/" className="flex min-w-0 max-w-[calc(100%-6.5rem)] flex-1 items-center gap-3 sm:max-w-none sm:gap-4">
                  <div className="rounded-[1.1rem] border border-[#f1c98d]/18 bg-[linear-gradient(180deg,rgba(58,20,35,0.96),rgba(33,15,29,0.92))] p-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.3)] sm:rounded-[1.35rem] sm:p-3">
                    <img
                      src={garnachin}
                      alt="Mexeando"
                      className="h-9 w-9 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] sm:h-11 sm:w-11 lg:h-12 lg:w-12"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#f1c98d] sm:text-[10px] sm:tracking-[0.3em]">
                      Ola MX
                    </p>
                    <p className="truncate text-[13px] font-black uppercase tracking-[0.02em] text-white sm:text-[15px] lg:text-lg">
                      Mexeando
                    </p>
                    <p className="mt-0.5 hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:block sm:text-[12px] sm:tracking-[0.2em]">
                      No visites Mexico ¡VIVELO!
                    </p>
                  </div>
                </Link>
                <nav className="hidden items-center gap-5 text-sm font-bold text-crema/78 lg:flex">
                  <a href="#beneficios" className="transition hover:text-white">
                    Beneficios
                  </a>
                  <a href="#como-funciona" className="transition hover:text-white">
                    Cómo funciona
                  </a>
                  <a href="#quienes-somos" className="transition hover:text-white">
                    Quiénes somos
                  </a>
                </nav>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <Link
                    to={appHref}
                    className="hidden rounded-full border border-white/14 bg-white/6 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-crema/85 transition hover:border-white/22 hover:bg-white/10 hover:text-white md:inline-flex"
                  >
                    {appLabel}
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-full bg-[linear-gradient(135deg,#0d8b75,#0a6d5b)] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-[0_14px_28px_rgba(11,123,104,0.32)] transition hover:brightness-110 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-[0.14em]"
                  >
                    {registerLabel}
                  </Link>
                </div>
              </div>

              <nav className="flex items-center gap-2 overflow-x-auto pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-crema/78 lg:hidden">
                <a href="#beneficios" className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-2 transition hover:bg-white/10">
                  Beneficios
                </a>
                <a href="#como-funciona" className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-2 transition hover:bg-white/10">
                  Cómo funciona
                </a>
                <a href="#quienes-somos" className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-2 transition hover:bg-white/10">
                  Quiénes somos
                </a>
                <Link
                  to={appHref}
                  className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-2 transition hover:bg-white/10 md:hidden"
                >
                  {appLabel}
                </Link>
              </nav>
            </div>
          </header>

          <section className="relative mx-auto flex min-h-[calc(100svh-124px)] w-full max-w-6xl items-center px-4 py-10 text-center sm:min-h-[calc(100svh-128px)] sm:px-5 sm:py-12 lg:min-h-[calc(100svh-72px)] lg:px-6 lg:py-16">
            <div className="mx-auto w-full max-w-[42rem]">
              <div className="mx-auto inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-[1.4rem] border border-[#f4c16c]/28 bg-black/30 px-3.5 py-2 text-[10px] font-black uppercase leading-4 tracking-[0.12em] text-[#f4c16c] backdrop-blur-sm sm:rounded-full sm:px-5 sm:py-2.5 sm:text-[11px] sm:tracking-[0.24em]">
                <Sparkles className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                <span>No visites Mexico ¡VIVELO!</span>
              </div>

              <div className="mx-auto mt-7 flex h-20 w-20 items-center justify-center rounded-[1.45rem] border border-[#f4c16c]/22 bg-[radial-gradient(circle_at_top,rgba(110,36,54,0.94)_0%,rgba(58,21,37,0.94)_100%)] shadow-[0_20px_36px_rgba(0,0,0,0.34)] backdrop-blur-sm sm:mt-8 sm:h-24 sm:w-24 sm:rounded-[1.8rem]">
                <img
                  src={garnachin}
                  alt="Mexeando"
                  className="h-16 w-16 object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.35)] sm:h-20 sm:w-20"
                />
              </div>

              <h1 className="mx-auto mt-7 max-w-[12ch] text-[clamp(2.55rem,11vw,4.7rem)] font-black leading-[0.9] tracking-[-0.065em] text-white sm:mt-8">
                Mexeando
              </h1>
              <p className="mx-auto mt-3 max-w-[24ch] text-[clamp(1.05rem,4.6vw,1.55rem)] font-light leading-tight tracking-[-0.03em] text-[#f2d6b6]">
                No visites Mexico ¡VIVELO!
              </p>

              <p className="mx-auto mt-5 max-w-[34rem] text-[15px] leading-7 text-crema/84 sm:mt-6 sm:text-base">
                Un sistema pensado para conectar turistas con negocios auténticos, facilitar el
                acceso al mapa, al registro y al contenido institucional, y luego continuar la
                experiencia como PWA instalada en móvil.
              </p>

              <div className="mx-auto mt-7 grid w-full max-w-md gap-3 sm:mt-8 md:max-w-[28rem] md:grid-cols-2">
                <Link
                  to={appHref}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#e0c09b,#c89b63)] px-5 py-3.5 text-[13px] font-black uppercase tracking-[0.08em] text-[#28170d] shadow-[0_18px_32px_rgba(209,176,139,0.34)] transition hover:translate-y-[-1px] hover:brightness-105 sm:min-h-[3.25rem]"
                >
                  <LockKeyhole className="mr-2.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                  {appLabel}
                </Link>
                <Link
                  to="/register"
                  className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#0d8b75,#0a6d5b)] px-5 py-3.5 text-[13px] font-black uppercase tracking-[0.08em] text-white shadow-[0_18px_32px_rgba(11,123,104,0.32)] transition hover:translate-y-[-1px] hover:brightness-110 sm:min-h-[3.25rem]"
                >
                  {registerLabel}
                </Link>
              </div>

              <div className="mt-6 hidden flex-wrap items-center justify-center gap-2 text-xs font-bold text-crema/78 md:flex">
                <Link to={appHref} className="rounded-full border border-white/12 bg-white/8 px-4 py-2.5 transition hover:bg-white/12">
                  {appLabel}
                </Link>
                <Link to="/register" className="rounded-full border border-white/12 bg-white/8 px-4 py-2.5 transition hover:bg-white/12">
                  {registerLabel}
                </Link>
              </div>
            </div>
          </section>
        </div>

        <main>
          <section id="beneficios" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-10 sm:px-5 sm:py-12 lg:px-6 lg:py-14">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-[#f4c16c]">
                  Beneficios principales
                </p>
                <h2 className="mt-3 text-2xl font-black uppercase leading-tight text-white sm:mt-4 sm:text-3xl lg:text-[2.05rem]">
                  Una entrada clara, usable y coherente con el producto
                </h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-crema/72 sm:text-[15px] sm:leading-7">
                Cada bloque responde a una función del sistema: descubrir negocios, entender el
                proyecto, entrar al flujo de usuario o registrarse.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:border-white/18 hover:bg-white/[0.07] sm:rounded-[1.8rem] sm:p-5"
                  >
                    <div className="inline-flex rounded-2xl bg-[#fff2dc] p-3 text-[#ba7410]">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-black uppercase text-white sm:mt-5 sm:text-xl">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-6 text-crema/68 sm:text-base sm:leading-7">
                      {feature.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:px-6 lg:py-8">
            <div className="rounded-[1.6rem] border border-[#d1b08b]/16 bg-[linear-gradient(135deg,#2b1208,#180b15)] p-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.24)] sm:rounded-[2rem] sm:p-6 lg:text-left">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f4c16c]">
                Acciones directas
              </p>
              <h2 className="mt-3 text-2xl font-black uppercase leading-tight text-white sm:mt-4 sm:text-3xl lg:text-[2rem]">
                Accesos principales del sistema
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-crema/72 sm:text-[15px] sm:leading-7 lg:mx-0">
                La portada debe vender confianza, orientar rápido y llevar al usuario a una acción
                concreta sin ruido visual ni copy fuera de contexto.
              </p>

              <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 lg:max-w-md">
                <Link
                  to={exploreHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e0c09b,#c89b63)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.1em] text-[#2f1a0d] transition hover:brightness-105"
                >
                  {accessToken ? 'Ver negocios' : 'Entrar para ver negocios'}
                </Link>
                <Link
                  to={appHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/18 bg-white/5 px-5 py-3.5 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/8"
                >
                  {appLabel}
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <ActionCard
                icon={<Compass className="h-5 w-5" />}
                title="Explorar"
                text="Entrar con tu cuenta para abrir el mapa y descubrir lugares cercanos."
                href={exploreHref}
              />
              <ActionCard
                icon={<Store className="h-5 w-5" />}
                title="Registrarse"
                text="Crear cuenta como turista o dueño de negocio."
                href="/register"
              />
              <ActionCard
                icon={<Route className="h-5 w-5" />}
                title="Entrar"
                text="Iniciar sesión o volver a tu panel si ya tienes cuenta."
                href={appHref}
              />
              <ActionCard
                icon={<Ticket className="h-5 w-5" />}
                title="Quiénes somos"
                text="Ir a la sección institucional y entender el propósito del sistema."
                href="#quienes-somos"
              />
            </div>
          </section>

          <section id="como-funciona" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-10 sm:px-5 sm:py-12 lg:px-6 lg:py-14">
            <div className="mb-10 text-center">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-[#f4c16c]">
                Cómo funciona
              </p>
              <h2 className="mt-3 text-2xl font-black uppercase text-white sm:mt-4 sm:text-3xl lg:text-[2.05rem]">
                Arquitectura de experiencia
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-crema/70 sm:mt-5 sm:text-[15px] sm:leading-7">
                En escritorio se presenta como una entrada sólida de producto. En móvil conserva
                esa jerarquía y se transforma en una experiencia lista para PWA.
              </p>
            </div>

            <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <article
                  key={step.title}
                  className="flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:rounded-[1.8rem] sm:p-5"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4c16c] text-lg font-black text-[#2f1a0d] sm:h-14 sm:w-14 sm:text-xl">
                    0{index + 1}
                  </div>
                  <h3 className="mt-4 text-xl font-black uppercase text-white sm:mt-5 sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-6 text-crema/68 sm:text-base sm:leading-7">
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section id="quienes-somos" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-14 sm:px-5 sm:pb-18 lg:px-6">
            <div className="grid gap-4 rounded-[1.7rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 backdrop-blur-md sm:gap-5 sm:rounded-[2.2rem] sm:p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:p-7">
              <div className="text-center lg:text-left">
                <p className="text-xs font-black uppercase tracking-[0.32em] text-[#f4c16c]">
                  Quiénes somos
                </p>
                <h2 className="mt-3 text-2xl font-black uppercase leading-tight text-white sm:mt-4 sm:text-3xl lg:text-[2.05rem]">
                  Un producto con propósito y claridad institucional
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-crema/74 sm:mt-4 sm:text-[15px] sm:leading-7 lg:mx-0">
                  Mexeando busca que turistas descubran mercados, fondas y negocios
                  pequeños con identidad real, no solo opciones genéricas. La tecnología aquí sirve
                  para orientar, confiar y conectar.
                </p>

                <div className="mt-7 space-y-3">
                  <StoryLine
                    icon={<BadgeCheck className="h-4 w-4" />}
                    text="Negocios locales con más visibilidad durante el torneo."
                  />
                  <StoryLine
                    icon={<Store className="h-4 w-4" />}
                    text="Una entrada clara para turista, dueño de negocio y administración."
                  />
                  <StoryLine
                    icon={<Compass className="h-4 w-4" />}
                    text="Experiencia usable tanto como sitio web como aplicación instalada."
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AboutBox
                  title="Mapa inteligente"
                  text="Ayuda a encontrar lugares relevantes según contexto y cercanía."
                />
                <AboutBox
                  title="Asistente IA"
                  text="Facilita idioma, orientación y contexto para el visitante."
                />
                <AboutBox
                  title="Pasaporte del Barrio"
                  text="Gamifica visitas, check-ins y recompensas dentro de la experiencia."
                />
                <AboutBox
                  title="Impacto local"
                  text="Busca traducir el tráfico turístico en consumo para negocios reales."
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function ActionCard({
  icon,
  title,
  text,
  href,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  href: string;
}) {
  const isAnchor = href.startsWith('#');

  if (isAnchor) {
    return (
      <a
        href={href}
        className="flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm transition hover:border-white/18 hover:bg-white/[0.07]"
      >
        <div className="inline-flex rounded-2xl bg-[#fff2dc] p-3 text-[#ba7410]">{icon}</div>
        <h3 className="mt-4 flex items-center justify-center text-lg font-black uppercase text-white">
          {title}
          <ChevronRight className="ml-2 h-5 w-5 text-[#f4c16c]" />
        </h3>
        <p className="mt-2 text-sm leading-6 text-crema/66">{text}</p>
      </a>
    );
  }

  return (
    <Link
      to={href}
      className="flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm transition hover:border-white/18 hover:bg-white/[0.07]"
    >
      <div className="inline-flex rounded-2xl bg-[#fff2dc] p-3 text-[#ba7410]">{icon}</div>
      <h3 className="mt-4 flex items-center justify-center text-lg font-black uppercase text-white">
        {title}
        <ChevronRight className="ml-2 h-5 w-5 text-[#f4c16c]" />
      </h3>
      <p className="mt-2 text-sm leading-6 text-crema/66">{text}</p>
    </Link>
  );
}

function StoryLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="mt-1 text-[#f4c16c]">{icon}</div>
      <p className="text-left text-sm leading-6 text-crema/70">{text}</p>
    </div>
  );
}

function AboutBox({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-[1.5rem] bg-[#fff2dc] p-4 text-[#2f1a0d] shadow-[0_18px_35px_rgba(0,0,0,0.12)] sm:p-5">
      <h3 className="text-base font-black uppercase sm:text-lg">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6b4f3f] sm:text-[15px] sm:leading-7">{text}</p>
    </article>
  );
}
