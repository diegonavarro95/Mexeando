import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, QrCode, CheckCircle, XCircle, RefreshCw, Zap, Sparkles } from 'lucide-react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next' // 🌍 Importación de idiomas
import { api } from '../../services/api'
import { usePassportStore } from '../../store/passportStore'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type CheckinStatus     = 'idle' | 'scanning' | 'processing' | 'success' | 'error'
type CameraPermission  = 'unknown' | 'granted' | 'denied'

interface CheckinResult {
  business: {
    id:       string
    name:     string
    category: string
  }
  points_earned:    number
  stamp_earned?: {
    icon:     string   // URL o emoji
    name:     string
    rarity?:  string
  }
  point_balance:       number
  message:             string
  already_checked_in?: boolean
}

const QR_READER_ID  = 'qr-reader-garnacha'
const SCAN_COOLDOWN = 2000

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CheckinPage() {
  const navigate                = useNavigate()
  const { t }                   = useTranslation() // 🌍 Hook de idiomas
  const { pointBalance, setPointBalance } = usePassportStore()

  const [status, setStatus]             = useState<CheckinStatus>('idle')
  const [result, setResult]             = useState<CheckinResult | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [cameraPermission, setCameraPermission] = useState<CameraPermission>('unknown')

  const scannerRef  = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef<number>(0)
  const isProcessingRef = useRef<boolean>(false) // 🔒 EL CANDADO ANTIBALAS

  useEffect(() => { return () => { stopScanner() } }, [])

  // ── Scanner ───────────────────────────────────────────────────────────────
  async function startScanner() {
    setStatus('scanning')
    setError(null)
    isProcessingRef.current = false // Abrimos candado al iniciar
    try {
      const scanner = new Html5Qrcode(QR_READER_ID)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps:          10,
          qrbox:        { width: 260, height: 260 },
          aspectRatio:  1,
          disableFlip:  false,
        },
        onScanSuccess,
        undefined
      )
      setCameraPermission('granted')
    } catch (err: any) {
      setCameraPermission('denied')
      setStatus('error')
      setError(
        err?.message?.includes('Permission')
          ? t('checkin.permission_error', 'Necesitamos acceso a tu cámara para escanear el QR.')
          : t('checkin.camera_error', 'No se pudo iniciar la cámara. Intenta de nuevo.')
      )
    }
  }

  async function stopScanner() {
    if (
      scannerRef.current &&
      scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING
    ) {
      try { await scannerRef.current.stop(); scannerRef.current.clear() } catch (_) {}
    }
    scannerRef.current = null
  }

  async function onScanSuccess(decodedText: string) {
    // 🔒 REVISIÓN DE CANDADO DE ALTA VELOCIDAD
    if (isProcessingRef.current) return
    isProcessingRef.current = true // Cerramos inmediatamente

    const now = Date.now()
    if (now - lastScanRef.current < SCAN_COOLDOWN) {
      isProcessingRef.current = false // Falsa alarma, reabrimos
      return
    }
    lastScanRef.current = now

    await stopScanner()
    setStatus('processing')
    try {
      let token = decodedText
      try { const url = new URL(decodedText); token = url.searchParams.get('token') ?? decodedText } catch (_) {}

      const res = await api.post<CheckinResult>('/api/v1/checkins', { token })
      setResult(res.data)
      setPointBalance(res.data.point_balance)
      setStatus('success')
      // No reabrimos el candado aquí para evitar que escanee la pantalla de éxito
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('checkin.network_error', 'No pudimos registrar tu check-in. Intenta de nuevo.'))
      setStatus('error')
      isProcessingRef.current = false // Reabrimos si falló para que vuelva a intentar
    }
  }

  function resetScan() {
    setStatus('idle')
    setResult(null)
    setError(null)
    isProcessingRef.current = false // 🔒 Reseteamos el candado
  }

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col overflow-hidden">
      {/* ─── HEADER ─────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#110800]/95 backdrop-blur-md border-b border-[#2a1800]">
        <div className="h-1 w-full flex">
          <div className="flex-1 bg-[#006847]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#C1121F]" />
        </div>
        <div
          className="px-4 pb-3 flex items-center justify-between"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        >
          <button
            onClick={async () => { await stopScanner(); navigate(-1) }}
            className="p-2 -ml-2 text-[#FFF3DC]/40 active:scale-90 transition-all"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-sm font-black uppercase tracking-widest italic">{t('checkin.header', 'Validador de Visita')}</h1>
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <QrCode size={18} className="text-[#C1121F]" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <AnimatePresence mode="wait">

          {/* ── IDLE ─────────────────────────────────────────────────────────── */}
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center space-y-8"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[#C1121F]/20 blur-3xl rounded-full" />
                <div className="relative w-48 h-48 border-2 border-dashed border-[#C1121F]/30 rounded-[40px] flex items-center justify-center">
                  <QrCode size={80} strokeWidth={1} className="text-[#C1121F]/50" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black italic tracking-tighter">{t('checkin.greeting', '¡Hola, Garnachero!')}</h2>
                <p className="text-sm text-[#FFF3DC]/40 max-w-[240px] mx-auto leading-relaxed">
                  {t('checkin.instructions', 'Escanea el código del local para ganar estampas y puntos.')}
                </p>
              </div>
              <button
                onClick={startScanner}
                className="w-full py-4 bg-[#C1121F] text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <QrCode size={18} /> {t('checkin.btn_start', 'Comenzar Escaneo')}
              </button>
            </motion.div>
          )}

          {/* ── SCANNING ─────────────────────────────────────────────────────── */}
          {status === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="app-auth-panel flex flex-col items-center gap-8"
            >
              <div className="relative w-full aspect-square rounded-[40px] overflow-hidden border-2 border-white/10 shadow-2xl">
                <div id={QR_READER_ID} className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none border-[20px] border-[#110800]/60" />
                <div className="absolute inset-8 rounded-2xl" />
                {[
                  'top-8 left-8 border-t-2 border-l-2 rounded-tl-lg',
                  'top-8 right-8 border-t-2 border-r-2 rounded-tr-lg',
                  'bottom-8 left-8 border-b-2 border-l-2 rounded-bl-lg',
                  'bottom-8 right-8 border-b-2 border-r-2 rounded-br-lg',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-6 h-6 border-[#C1121F] ${cls}`} />
                ))}
                <div className="absolute inset-x-0 h-[2px] bg-[#C1121F] shadow-[0_0_15px_#C1121F] animate-scan-line" />
                <div className="absolute bottom-6 left-0 right-0 text-center">
                  <span className="text-[10px] font-black tracking-widest bg-black/60 px-3 py-1 rounded-full border border-white/10">
                    {t('checkin.scanning_hud', 'BUSCANDO CÓDIGO...')}
                  </span>
                </div>
              </div>
              <button
                onClick={async () => { await stopScanner(); resetScan() }}
                className="px-6 py-2 bg-white/5 rounded-full text-xs font-bold text-white/40 border border-white/5 uppercase tracking-widest"
              >
                {t('common.cancel', 'Cancelar')}
              </button>
            </motion.div>
          )}

          {/* ── PROCESSING ───────────────────────────────────────────────────── */}
          {status === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[#C1121F]/20 border-t-[#C1121F] rounded-full animate-spin" />
                <Zap size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#F4A300]" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-[#F4A300] animate-pulse">
                {t('checkin.syncing', 'Sincronizando con la red...')}
              </p>
            </motion.div>
          )}

          {/* ── SUCCESS ──────────────────────────────────────────────────────── */}
          {status === 'success' && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="app-auth-panel bg-gradient-to-b from-[#1a0d00] to-[#110800] border border-[#2a1800] rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-[#2D6A4F]/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#2D6A4F]/40">
                <CheckCircle size={40} className="text-[#2D6A4F]" />
              </div>

              <h2 className="text-2xl font-black italic tracking-tighter text-white mb-2">
                {result.already_checked_in ? t('checkin.welcome_back', '¡De vuelta en casa!') : t('checkin.golden_checkin', '¡Check-in Dorado!')}
              </h2>
              <p className="text-[#F4A300] font-bold text-sm uppercase tracking-widest mb-8">
                {result.business.name}
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#F4A300]/20 rounded-lg text-[#F4A300]">
                      <Zap size={20} fill="currentColor" />
                    </div>
                    <span className="text-sm font-bold text-white/80">{t('checkin.points_earned', 'Puntos ganados')}</span>
                  </div>
                  <span className="text-xl font-black text-[#F4A300]">+{result.points_earned}</span>
                </div>

                {result.stamp_earned && (
                  <div className="bg-[#C1121F]/5 border border-[#C1121F]/20 p-4 rounded-2xl flex items-center gap-4">
                    <div className="text-4xl drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] flex-shrink-0">
                      {result.stamp_earned.icon.startsWith('http') ? (
                        <img src={result.stamp_earned.icon} alt={result.stamp_earned.name} className="w-12 h-12 object-contain" />
                      ) : (
                        result.stamp_earned.icon
                      )}
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[10px] font-black text-[#C1121F] uppercase tracking-widest leading-none mb-1">
                        {t('checkin.new_stamp', 'Nueva Estampa')}
                      </p>
                      <p className="text-sm font-bold text-white">{result.stamp_earned.name}</p>
                      {result.stamp_earned.rarity && (
                        <span className="text-xs font-bold capitalize text-[#F4A300]">
                          {t(`rarity.${result.stamp_earned.rarity.toLowerCase()}`, result.stamp_earned.rarity)}
                        </span>
                      )}
                    </div>
                    <Sparkles size={16} className="text-[#F4A300] flex-shrink-0" />
                  </div>
                )}
              </div>

              <p className="text-xs text-[#FFF3DC]/30 mb-6">
                {t('checkin.total_balance', 'Total acumulado:')} <strong className="text-[#FFF3DC]/60">{pointBalance} pts</strong>
              </p>

              <div className="flex gap-3">
                <button
                  onClick={resetScan}
                  className="flex-1 py-4 bg-transparent text-white/40 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] border border-white/10 hover:text-white transition-all"
                >
                  {t('checkin.btn_another', 'Otro escaneo')}
                </button>
                <button
                  onClick={() => navigate(`/business/${result.business.id}`)}
                  className="flex-1 py-4 bg-white text-[#110800] rounded-2xl font-black uppercase text-xs tracking-[0.15em] active:scale-95 transition-all"
                >
                  {t('checkin.btn_view_business', 'Ver Local')}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ────────────────────────────────────────────────────────── */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center space-y-6 max-w-xs"
            >
              <div className="w-20 h-20 bg-[#C1121F]/10 rounded-full flex items-center justify-center mx-auto border border-[#C1121F]/30">
                <XCircle size={40} className="text-[#C1121F]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black italic uppercase">{t('checkin.error_title', 'Hubo un problema')}</h3>
                <p className="text-sm text-[#FFF3DC]/40 leading-relaxed">{error}</p>
              </div>
              <button
                onClick={async () => {
                  resetScan()
                  if (cameraPermission !== 'denied') await startScanner()
                }}
                className="flex items-center gap-2 mx-auto px-8 py-3 bg-[#C1121F] text-white rounded-xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
              >
                <RefreshCw size={16} />
                {cameraPermission === 'denied' ? t('common.go_home', 'Volver al inicio') : t('common.try_again', 'Intentar de nuevo')}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {status !== 'scanning' && (
        <div id={QR_READER_ID} className="hidden" aria-hidden />
      )}
    </div>
  )
}
