import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  X,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallTarget = 'android' | 'ios' | 'desktop';
type BrowserFamily = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'other';

type InstallGuide = {
  title: string;
  description: string;
  badge: string;
  note: string;
  steps: string[];
  actionLabel: string;
};

function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectInstallTarget(): InstallTarget {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIPadOS = /macintosh/.test(ua) && window.navigator.maxTouchPoints > 1;
  const isIos = /iphone|ipad|ipod/.test(ua) || isIPadOS;
  const isAndroid = /android/.test(ua);

  if (isIos) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

function detectBrowserFamily(): BrowserFamily {
  const ua = window.navigator.userAgent.toLowerCase();
  const isEdge = /edg\//.test(ua);
  const isSamsung = /samsungbrowser/.test(ua);
  const isFirefox = /firefox|fxios/.test(ua);
  const isChrome = /chrome|crios/.test(ua) && !isEdge && !isSamsung;
  const isSafari = /safari/.test(ua) && !isChrome && !isEdge && !isSamsung && !isFirefox;

  if (isSafari) return 'safari';
  if (isChrome) return 'chrome';
  if (isEdge) return 'edge';
  if (isFirefox) return 'firefox';
  if (isSamsung) return 'samsung';
  return 'other';
}

function getGuide(
  target: InstallTarget,
  browser: BrowserFamily,
  canNativeInstall: boolean,
): InstallGuide {
  if (target === 'ios') {
    const needsSafari = browser !== 'safari';

    return {
      title: 'Instala en iPhone o iPad',
      description: needsSafari
        ? 'En iOS la instalación se hace desde Safari.'
        : 'En iOS se instala manualmente desde Safari.',
      badge: 'Instalación manual desde Safari',
      note: needsSafari ? 'Primero abre esta página en Safari.' : 'El mismo flujo aplica para iPhone y iPad.',
      steps: needsSafari
        ? [
            'Abre esta misma página en Safari.',
            'Toca Compartir, el icono con flecha hacia arriba.',
            'Elige Agregar a pantalla de inicio.',
          ]
        : [
            'Toca Compartir en Safari.',
            'Selecciona Agregar a pantalla de inicio.',
            'Confirma tocando Agregar.',
          ],
      actionLabel: 'Entendido',
    };
  }

  if (target === 'android') {
    if (canNativeInstall) {
      return {
        title: 'Instala en Android',
        description: 'Tu navegador ya detectó que esta app se puede instalar.',
        badge: 'Instalación directa disponible',
        note: 'También funciona igual en tablets Android.',
        steps: [
          'Toca Instalar ahora y acepta el diálogo.',
          'Abre la app desde tu pantalla principal.',
        ],
        actionLabel: 'Instalar ahora',
      };
    }

    return {
      title: 'Instala en Android',
      description: 'Si no aparece el popup, todavía puedes instalarla manualmente.',
      badge: 'Instalación desde el menú',
      note: 'También aplica en tablets Android.',
      steps: [
        'Abre el menú del navegador.',
        'Toca Instalar app o Agregar a pantalla principal.',
        'Confirma la instalación.',
      ],
      actionLabel: 'Entendido',
    };
  }

  if (canNativeInstall) {
    return {
      title: 'Instala en computadora',
      description: 'En Chrome o Edge puedes instalar la app como una app de escritorio.',
      badge: 'Instalación directa disponible',
      note: 'Luego podrás abrirla desde el escritorio o el menú de aplicaciones.',
      steps: [
        'Haz clic en Instalar ahora y confirma.',
        'Abre la app desde tu escritorio o menú de aplicaciones.',
      ],
      actionLabel: 'Instalar ahora',
    };
  }

  return {
    title: 'Instala en computadora',
    description: 'La instalación en escritorio funciona mejor en Chrome o Edge.',
    badge: browser === 'firefox' ? 'Firefox no ofrece el mejor soporte' : 'Usa Chrome o Edge',
    note: 'Si no ves la opción, abre esta página en Chrome o Edge.',
    steps: [
      'Abre esta página en Chrome o Edge.',
      'Busca el ícono de instalación en la barra de direcciones.',
      'Si no aparece, usa la opción Instalar app del menú.',
    ],
    actionLabel: 'Entendido',
  };
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installTarget, setInstallTarget] = useState<InstallTarget>('desktop');
  const [browserFamily, setBrowserFamily] = useState<BrowserFamily>('other');
  const [pendingNativeInstall, setPendingNativeInstall] = useState(false);

  useEffect(() => {
    const initialTarget = detectInstallTarget();
    setInstallTarget(initialTarget);
    setBrowserFamily(detectBrowserFamily());
    setIsInstalled(isStandaloneMode());

    const refreshInstallState = () => {
      setIsInstalled(isStandaloneMode());
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('focus', refreshInstallState);
    document.addEventListener('visibilitychange', refreshInstallState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('focus', refreshInstallState);
      document.removeEventListener('visibilitychange', refreshInstallState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!pendingNativeInstall || !deferredPrompt || installTarget === 'ios') return;
    setPendingNativeInstall(false);
    void handlePromptInstall(deferredPrompt);
  }, [deferredPrompt, installTarget, pendingNativeInstall]);

  useEffect(() => {
    if (!isOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  if (isInstalled) return null;

  const canNativeInstall = deferredPrompt !== null && installTarget !== 'ios';
  const guide = getGuide(installTarget, browserFamily, canNativeInstall);

  async function handlePromptInstall(promptEvent: BeforeInstallPromptEvent) {
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsOpen(false);
        return;
      }

      setIsOpen(true);
    } catch {
      setIsOpen(true);
    } finally {
      setDeferredPrompt(null);
    }
  }

  async function handlePrimaryAction() {
    if (!canNativeInstall || !deferredPrompt) {
      setIsOpen(false);
      return;
    }

    await handlePromptInstall(deferredPrompt);
  }

  function handleDismiss() {
    setIsOpen(false);
  }

  function handleOpenPrompt() {
    if (canNativeInstall) {
      void handlePrimaryAction();
      return;
    }

    if (installTarget !== 'ios') {
      setPendingNativeInstall(true);
    }

    setIsOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPrompt}
        className="fixed bottom-[max(0.9rem,env(safe-area-inset-bottom))] right-[max(0.9rem,env(safe-area-inset-right))] z-[90] inline-flex min-h-[3rem] max-w-[calc(100vw-1.8rem)] items-center justify-center gap-2 whitespace-nowrap rounded-full border border-stone-200 bg-white px-3.5 py-2.5 text-[13px] font-black text-stone-900 shadow-[0_18px_42px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:right-[max(1.5rem,env(safe-area-inset-right))] sm:min-h-[3.25rem] sm:max-w-none sm:px-5 sm:py-3 sm:text-sm"
      >
        <Download className="h-4 w-4 shrink-0 text-amber-700" />
        <span>Descargar app</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleDismiss();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="mx-auto flex min-h-[100svh] w-full max-w-[23rem] items-end sm:min-h-[calc(100svh-3rem)] sm:items-center"
          >
            <div className="flex max-h-[min(100svh,42rem)] w-full flex-col overflow-hidden rounded-t-[2rem] border border-stone-200 bg-white text-stone-900 shadow-2xl sm:max-h-[calc(100svh-3rem)] sm:rounded-3xl">
              <div className="relative shrink-0 border-b border-stone-100 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="absolute right-4 top-4 z-10 rounded-full border border-stone-200 bg-white p-2 text-stone-500 shadow-sm transition hover:bg-stone-100 hover:text-stone-700"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 shadow-sm">
                  <img
                    src="/pwa/icon-192.png"
                    alt="Mexeando"
                    className="h-9 w-9 object-contain"
                  />
                </div>

                <div className="mt-4 text-center">
                  <h2 id="pwa-install-title" className="text-[1.8rem] font-black tracking-tight text-stone-900">
                    Instalar App
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-5 text-stone-500">
                    Te mostramos el flujo correcto para este dispositivo.
                  </p>
                </div>
              </div>

              <div className="overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-amber-700">
                        {guide.badge}
                      </p>
                      <h3 className="mt-0.5 text-[15px] font-black leading-5 text-stone-900">{guide.title}</h3>
                      <p className="mt-1 text-[13px] leading-5 text-stone-600">{guide.description}</p>
                    </div>
                  </div>

                  <ol className="mt-3 space-y-2">
                    {guide.steps.map((step, index) => (
                      <li key={step} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[11px] font-black text-white">
                          {index + 1}
                        </span>
                        <span className="pt-0.5 text-[13px] leading-5 text-stone-700">{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[13px] leading-5 text-stone-700">
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                    <p>{guide.note}</p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-stone-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-black text-stone-900 transition hover:bg-stone-50 sm:flex-1"
                  >
                    Más tarde
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handlePrimaryAction();
                    }}
                    className="w-full rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-stone-800 sm:flex-1"
                  >
                    {guide.actionLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
