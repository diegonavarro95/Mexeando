/**
 * src/pages/owner/QRPage.tsx
 * D-5 — Mi código QR Personalizado
 *
 * 3 estilos de cartel:
 *  - La Ruta de la Garnacha (garnachin.png) — identidad de marca azul/dorado
 *  - FIFA World Cup 2026    (fifa_2026.png)  — fondo blanco para que el logo destaque
 *  - México 2026            (mexico_2026.png) — bandera tricolor
 *
 * Fixes v3:
 *  - CTA y texto SIEMPRE debajo del QR, nunca encima
 *  - QR siempre fondo blanco + color oscuro para máximo contraste
 *  - FIFA: panel blanco detrás del logo para que no se pierda
 *  - Texto CTA fijo "ESCANEA Y GANA 50 PTS" + subtexto personalizable pequeño
 *  - QR nunca tapado por texto
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Download, Palette, CheckCircle2,
  Share2, Info, Layout, Edit, UtensilsCrossed, Sparkles,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

import garnachinImg from '../../assets/garnachin.png';
import fifaImg      from '../../assets/fifa_2026.png';
import mexicoImg    from '../../assets/mexico_2026.png';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface QRTokenResponse {
  qr_token: string;
  qr_content: string;
  business_id: string;
  business_name: string;
}

type PosterStyle = 'garnacha' | 'fifa' | 'mexico';
type DotStyle    = 'square' | 'rounded';

interface QRConfig {
  posterStyle : PosterStyle;
  qrColor     : string;
  dotStyle    : DotStyle;
  subText     : string; // texto pequeño personalizable debajo del CTA fijo
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const POSTER_DEFS: { value: PosterStyle; label: string; emoji: string; desc: string; bg: string }[] = [
  { value: 'garnacha', label: 'La Ruta de la Garnacha', emoji: '🌮', desc: 'Identidad oficial de la app',      bg: '#1a0a02' },
  { value: 'fifa',     label: 'FIFA World Cup 2026',     emoji: '🏆', desc: 'Estética del Mundial MX·USA·CAN', bg: '#001440' },
  { value: 'mexico',   label: 'México 2026',             emoji: '🦅', desc: 'Bandera y selección mexicana',    bg: '#006847' },
];

const QR_COLORS: { value: string; label: string }[] = [
  { value: '#1a0a02', label: 'Café'   },
  { value: '#006847', label: 'Verde'  },
  { value: '#C1121F', label: 'Rojo'   },
  { value: '#1a1a1a', label: 'Negro'  },
  { value: '#8b6914', label: 'Dorado' },
  { value: '#001f5b', label: 'Azul'   },
];

const SUB_OPTIONS = [
  'Descarga La Ruta de la Garnacha',
  'Negocio oficial del Mundial 2026',
  'Visítanos durante el Mundial FIFA',
  'Encuentra más negocios en la app',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shortName(name: string, max = 20) {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

// ─── CARTEL 1: LA RUTA DE LA GARNACHA ────────────────────────────────────────
// Colores café oscuro de la marca, dorado, crema

async function renderGarnacha(qrCanvas: HTMLCanvasElement, name: string, cfg: QRConfig): Promise<HTMLCanvasElement> {
  const W = 600, H = 1060;  // más alto para que CTA + subtexto + footer quepan sin solaparse
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const logo = await loadImage(garnachinImg);

  // Fondo café oscuro de la marca
  ctx.fillStyle = '#1a0a02';
  ctx.fillRect(0, 0, W, H);

  // Textura de puntos cálidos
  ctx.fillStyle = 'rgba(255,200,100,0.025)';
  for (let x = 0; x < W; x += 28)
    for (let y = 0; y < H; y += 28) {
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    }

  // Borde dorado exterior
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 7;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  // Borde dorado interior fino
  ctx.strokeStyle = 'rgba(201,168,76,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, W - 52, H - 52);

  // Franja dorada top
  const goldH = ctx.createLinearGradient(0, 0, W, 0);
  goldH.addColorStop(0, 'transparent'); goldH.addColorStop(0.15, '#c9a84c');
  goldH.addColorStop(0.5, '#f0d080');   goldH.addColorStop(0.85, '#c9a84c');
  goldH.addColorStop(1, 'transparent');
  ctx.fillStyle = goldH;
  ctx.fillRect(0, 42, W, 3);

  // Logo Garnachin — grande, centrado
  const gS = 278;
  ctx.drawImage(logo, (W - gS) / 2, 48, gS, gS);

  // Badge
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 12px system-ui';
  ctx.fillText('★   LA RUTA DE LA GARNACHA   ★', W / 2, 346);

  // Nombre del negocio
  ctx.fillStyle = '#FFF3DC';
  ctx.font = 'italic bold 40px system-ui';
  ctx.fillText(shortName(name).toUpperCase(), W / 2, 392);

  // Separador dorado
  const sg = ctx.createLinearGradient(60, 0, W - 60, 0);
  sg.addColorStop(0, 'transparent'); sg.addColorStop(0.25, '#c9a84c');
  sg.addColorStop(0.75, '#c9a84c'); sg.addColorStop(1, 'transparent');
  ctx.fillStyle = sg;
  ctx.fillRect(60, 408, W - 120, 2);

  // Panel QR — fondo crema, borde dorado
  const qrPad = 28, qrPanelX = 70, qrPanelY = 422;
  const qrPanelW = W - 140;
  ctx.fillStyle = '#FFF3DC';
  rrect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelW, 24); ctx.fill();
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 3;
  rrect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelW, 24); ctx.stroke();

  const qrSize = qrPanelW - qrPad * 2;
  ctx.drawImage(qrCanvas, qrPanelX + qrPad, qrPanelY + qrPad, qrSize, qrSize);

  // CTA fijo — debajo del panel con espacio calculado
  const ctaY = qrPanelY + qrPanelW + 40;
  ctx.fillStyle = '#f0d080';
  ctx.font = 'bold 21px system-ui';
  ctx.fillText('⭐  ESCANEA Y GANA 50 PTS  ⭐', W / 2, ctaY);

  // Subtexto personalizable — bien visible y con espacio antes del footer
  ctx.fillStyle = 'rgba(255,243,220,0.70)';
  ctx.font = '15px system-ui';
  ctx.fillText(cfg.subText, W / 2, ctaY + 32);

  // Footer café dorado — bien separado del subtexto
  const footerY = H - 68;
  const fg = ctx.createLinearGradient(0, footerY, 0, H);
  fg.addColorStop(0, '#b8860b'); fg.addColorStop(1, '#7a5c0a');
  ctx.fillStyle = fg;
  ctx.fillRect(0, footerY, W, H - footerY);
  ctx.fillStyle = '#FFF3DC';
  ctx.font = 'bold 14px system-ui';
  ctx.fillText('NEGOCIO OFICIAL · MUNDIAL FIFA 2026  🏆', W / 2, footerY + 40);

  return c;
}

// ─── CARTEL 2: FIFA WORLD CUP 2026 ───────────────────────────────────────────
// Fix: panel blanco detrás del logo FIFA para que destaque sobre el fondo oscuro

async function renderFifa(qrCanvas: HTMLCanvasElement, name: string, cfg: QRConfig): Promise<HTMLCanvasElement> {
  const W = 600, H = 1060;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const logo = await loadImage(fifaImg);

  // Fondo navy degradado
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#001a4a'); bg.addColorStop(0.6, '#000d2e'); bg.addColorStop(1, '#000820');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Franja tricolor sedes TOP (MX verde · USA blanco · CAN rojo)
  ctx.fillStyle = '#006847'; ctx.fillRect(0, 0, W / 3, 12);
  ctx.fillStyle = '#EEEEEE';  ctx.fillRect(W / 3, 0, W / 3, 12);
  ctx.fillStyle = '#BF0A30';  ctx.fillRect((W / 3) * 2, 0, W / 3, 12);

  // Panel blanco redondeado para el logo — así no se pierde sobre el navy
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  rrect(ctx, 155, 18, 290, 290, 24); ctx.fill();

  // Logo FIFA dentro del panel blanco
  ctx.drawImage(logo, 165, 22, 270, 270);

  // MEXICO · USA · CANADA
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px system-ui';
  ctx.fillStyle = '#006847'; ctx.fillText('MEXICO', W / 2 - 98, 326);
  ctx.fillStyle = '#CCCCCC';  ctx.fillText('USA',    W / 2,      326);
  ctx.fillStyle = '#BF0A30';  ctx.fillText('CANADA', W / 2 + 92, 326);

  // Líneas tricolor separadoras
  ctx.fillStyle = '#006847'; ctx.fillRect(28,  336, 162, 3);
  ctx.fillStyle = '#EEEEEE';  ctx.fillRect(212, 336, 176, 3);
  ctx.fillStyle = '#BF0A30';  ctx.fillRect(402, 336, 170, 3);

  // Nombre negocio
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'italic bold 38px system-ui';
  ctx.fillText(shortName(name).toUpperCase(), W / 2, 384);

  // Badge "NEGOCIO OFICIAL"
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  rrect(ctx, 168, 396, 264, 28, 14); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = 'bold 10px system-ui';
  ctx.fillText('⚽  NEGOCIO OFICIAL DEL MUNDIAL', W / 2, 415);

  // Panel QR — fondo blanco puro, borde sutil
  const qrPad = 26, qrPanelX = 72, qrPanelY = 434;
  const qrPanelW = W - 144;
  ctx.fillStyle = '#FFFFFF';
  rrect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelW, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2;
  rrect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelW, 22); ctx.stroke();

  const qrSize = qrPanelW - qrPad * 2;
  ctx.drawImage(qrCanvas, qrPanelX + qrPad, qrPanelY + qrPad, qrSize, qrSize);

  // CTA FIJO — debajo del panel
  const ctaY = qrPanelY + qrPanelW + 40;
  ctx.fillStyle = '#F4A300';
  ctx.font = 'bold 21px system-ui';
  ctx.fillText('⭐  ESCANEA Y GANA 50 PTS  ⭐', W / 2, ctaY);

  // Subtexto — visible, bien separado del CTA y del footer
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = '15px system-ui';
  ctx.fillText(cfg.subText, W / 2, ctaY + 32);

  // Footer tricolor — H ampliado a 1060 para que no tape el subtexto
  const footerY = 1060 - 58;
  ctx.fillStyle = '#006847'; ctx.fillRect(0, footerY, W / 3, H - footerY);
  ctx.fillStyle = '#EEEEEE';  ctx.fillRect(W / 3, footerY, W / 3, H - footerY);
  ctx.fillStyle = '#BF0A30';  ctx.fillRect((W / 3) * 2, footerY, W / 3, H - footerY);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, footerY, W, H - footerY);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 13px system-ui';
  ctx.fillText('🌮  ESCANEA · VISITA · GANA PUNTOS  🏆', W / 2, footerY + 32);

  return c;
}

// ─── CARTEL 3: MÉXICO 2026 ────────────────────────────────────────────────────
// Fix: QR con colores contrastantes, CTA en zona clara debajo

async function renderMexico(qrCanvas: HTMLCanvasElement, name: string, cfg: QRConfig): Promise<HTMLCanvasElement> {
  const W = 600, H = 1060;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const logo = await loadImage(mexicoImg);

  // Bandera tricolor vertical — ahora cubre H actualizado
  ctx.fillStyle = '#006847'; ctx.fillRect(0, 0, W / 3, H);
  ctx.fillStyle = '#F5F5F5';  ctx.fillRect(W / 3, 0, W / 3, H);
  ctx.fillStyle = '#C1121F';  ctx.fillRect((W / 3) * 2, 0, W / 3, H);

  // Overlay oscuro
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(0, 0, W, H);

  // Logo México
  const lS = 260;
  ctx.drawImage(logo, (W - lS) / 2, 18, lS, lS);

  // Título
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold italic 50px system-ui';
  ctx.fillText('MÉXICO 2026', W / 2, 310);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 11px system-ui';
  ctx.fillText('FIFA WORLD CUP · LA RUTA DE LA GARNACHA', W / 2, 334);

  ctx.font = '22px system-ui';
  ctx.fillText('🇲🇽  ⚽  🏆  ⚽  🇲🇽', W / 2, 368);

  // Panel nombre
  ctx.fillStyle = 'rgba(0,80,50,0.75)';
  rrect(ctx, 40, 382, W - 80, 52, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
  rrect(ctx, 40, 382, W - 80, 52, 16); ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'italic bold 30px system-ui';
  ctx.fillText(shortName(name).toUpperCase(), W / 2, 418);

  // Marco QR triple borde tricolor
  ctx.fillStyle = '#006847';
  rrect(ctx, 64, 448, W - 128, W - 128, 30); ctx.fill();
  ctx.fillStyle = '#F5F5F5';
  rrect(ctx, 72, 456, W - 144, W - 144, 26); ctx.fill();
  ctx.fillStyle = '#C1121F';
  rrect(ctx, 80, 464, W - 160, W - 160, 22); ctx.fill();

  // Panel blanco QR
  const qrPad = 24;
  const qrPanelX = 88, qrPanelY = 472;
  const qrPanelW = W - 176;
  ctx.fillStyle = '#FFFFFF';
  rrect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelW, 18); ctx.fill();

  const qrSize = qrPanelW - qrPad * 2;
  ctx.drawImage(qrCanvas, qrPanelX + qrPad, qrPanelY + qrPad, qrSize, qrSize);

  // CTA FIJO — debajo del panel
  const ctaY = qrPanelY + qrPanelW + 40;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 21px system-ui';
  ctx.fillText('⭐  ESCANEA Y GANA 50 PTS  ⭐', W / 2, ctaY);

  // Subtexto — visible y bien separado del footer
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = '15px system-ui';
  ctx.fillText(cfg.subText, W / 2, ctaY + 32);

  // Footer tricolor
  const footerY = H - 62;
  ctx.fillStyle = '#006847'; ctx.fillRect(0, footerY, W / 3, H - footerY);
  ctx.fillStyle = '#F5F5F5';  ctx.fillRect(W / 3, footerY, W / 3, H - footerY);
  ctx.fillStyle = '#C1121F';  ctx.fillRect((W / 3) * 2, footerY, W / 3, H - footerY);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, footerY, W, H - footerY);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 14px system-ui';
  ctx.fillText('🇲🇽   ¡ARRIBA MÉXICO!  ·  FIFA 2026   🇲🇽', W / 2, footerY + 36);

  return c;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function QRPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data,        setData]        = useState<QRTokenResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [activeTab,   setActiveTab]   = useState<'estilo' | 'qr' | 'texto'>('estilo');

  const [cfg, setCfg] = useState<QRConfig>({
    posterStyle: 'garnacha',
    qrColor:     '#1a0a02',
    dotStyle:    'rounded',
    subText:     'Descarga La Ruta de la Garnacha',
  });

  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    loadQR();
  }, [accessToken]);

  async function loadQR() {
    setLoading(true); setError(null);
    try {
      const meRes    = await api.get<{ data: { id: string } }>('/api/v1/businesses/owner/mine');
      const tokenRes = await api.get<{ data: QRTokenResponse }>(
        `/api/v1/businesses/${meRes.data.data.id}/qr-token`
      );
      setData(tokenRes.data.data);
    } catch {
      setError('No se pudo cargar el código QR. Asegúrate de tener un negocio registrado.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!data?.qr_content || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, data.qr_content, {
      width: 260,
      margin: 1,
      color: { dark: cfg.qrColor, light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });
  }, [data, cfg.qrColor]);

  const handlePosterChange = (style: PosterStyle) => {
    const defaults: Record<PosterStyle, string> = {
      garnacha: '#1a0a02',
      fifa:     '#001f5b',
      mexico:   '#006847',
    };
    setCfg(p => ({ ...p, posterStyle: style, qrColor: defaults[style] }));
  };

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current || !data) return;
    setDownloading(true);
    try {
      let poster: HTMLCanvasElement;
      if      (cfg.posterStyle === 'garnacha') poster = await renderGarnacha(canvasRef.current, data.business_name, cfg);
      else if (cfg.posterStyle === 'fifa')     poster = await renderFifa(canvasRef.current, data.business_name, cfg);
      else                                     poster = await renderMexico(canvasRef.current, data.business_name, cfg);

      const label = POSTER_DEFS.find(p => p.value === cfg.posterStyle)?.label ?? cfg.posterStyle;
      const link  = document.createElement('a');
      link.download = `QR_${label.replace(/\s+/g, '-')}_${data.business_name.replace(/\s+/g, '-')}.png`;
      link.href = poster.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('[QR] error:', e);
      const link = document.createElement('a');
      link.download = `qr-${data.business_name}.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  }, [cfg, data]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-[#110800] flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-5xl">❌</div>
        <p className="text-[#ff6b6b] text-center text-sm leading-relaxed">{error}</p>
        <button onClick={() => navigate('/owner/onboarding')} className="bg-[#C1121F] text-white font-black uppercase text-xs tracking-[0.3em] px-8 py-4 rounded-2xl">
          Registrar mi negocio
        </button>
      </div>
    );
  }

  const activePoster = POSTER_DEFS.find(p => p.value === cfg.posterStyle)!;

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col pb-10">

      {/* Banderita */}
      <div className="h-[3px] w-full flex sticky top-0 z-[60]">
        <div className="flex-1 bg-[#006847]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#C1121F]" />
      </div>

      {/* Header */}
      <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 p-4 sticky top-[3px] z-50">
        <div className="app-shell-form flex items-center justify-between">
          <button onClick={() => navigate('/owner/dashboard')} className="p-2 -ml-2 text-white/20 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C1121F]">Marketing Kit</h1>
            <p className="text-sm font-black italic text-white uppercase tracking-tighter">Mi Identidad QR</p>
          </div>
          <button className="p-2 text-white/20 hover:text-white transition-colors"><Share2 size={20} /></button>
        </div>
      </header>

      <main className="app-shell-form w-full p-4 space-y-5 sm:p-5 lg:p-6">

        {/* Preview */}
        <section className="flex flex-col items-center">
          <div className="relative">
            <div className="absolute inset-0 blur-[60px] rounded-full opacity-40" style={{ background: cfg.qrColor }} />
            <motion.div
              layout
              className="relative p-5 rounded-[2.5rem] shadow-2xl shadow-black/70 border border-white/10 flex flex-col items-center"
              style={{ background: activePoster.bg }}
            >
              <canvas ref={canvasRef} className={cfg.dotStyle === 'rounded' ? 'rounded-2xl' : ''} />
              <div className="mt-3 text-center">
                <p className="font-black text-sm italic tracking-tighter text-white leading-none">{data?.business_name}</p>
                <p className="text-[8px] font-black uppercase tracking-widest mt-1 text-white/40">{activePoster.emoji} {activePoster.label}</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Panel personalización */}
        <section className="rounded-[2rem] border border-white/8 overflow-hidden" style={{ background: '#16080a' }}>
          <div className="flex border-b border-white/8">
            {[
              { key: 'estilo', label: 'Cartel',  icon: <Sparkles size={13} /> },
              { key: 'qr',     label: 'QR',       icon: <Layout size={13} /> },
              { key: 'texto',  label: 'Subtexto', icon: <Palette size={13} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 flex flex-col items-center py-3 gap-1 text-[9px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab.key ? 'text-[#C1121F]' : 'text-white/20'}`}
              >
                {tab.icon}{tab.label}
                {activeTab === tab.key && <motion.div layoutId="qrTabLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C1121F]" />}
              </button>
            ))}
          </div>

          <div className="p-5">
            <AnimatePresence mode="wait">

              {activeTab === 'estilo' && (
                <motion.div key="estilo" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
                  {POSTER_DEFS.map(ps => (
                    <button
                      key={ps.value}
                      onClick={() => handlePosterChange(ps.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${cfg.posterStyle === ps.value ? 'border-[#C1121F] bg-[#C1121F]/10' : 'border-white/8 hover:border-white/20'}`}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 border border-white/10" style={{ background: ps.bg }}>
                        {ps.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black ${cfg.posterStyle === ps.value ? 'text-white' : 'text-white/40'}`}>{ps.label}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{ps.desc}</p>
                      </div>
                      {cfg.posterStyle === ps.value && <CheckCircle2 size={18} className="text-[#C1121F] flex-shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              )}

              {activeTab === 'qr' && (
                <motion.div key="qr" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">Color del código QR</p>
                    <div className="flex flex-wrap gap-3">
                      {QR_COLORS.map(col => (
                        <button key={col.value} onClick={() => setCfg(p => ({ ...p, qrColor: col.value }))} className="flex flex-col items-center gap-1.5">
                          <div
                            className={`w-11 h-11 rounded-xl border-2 transition-all ${cfg.qrColor === col.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`}
                            style={{ backgroundColor: col.value }}
                          />
                          <span className="text-[8px] font-black uppercase text-white/25">{col.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-white/8 pt-5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">Forma de puntos</p>
                    <div className="flex gap-3">
                      {(['square', 'rounded'] as DotStyle[]).map(style => (
                        <button
                          key={style}
                          onClick={() => setCfg(p => ({ ...p, dotStyle: style }))}
                          className={`flex-1 py-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${cfg.dotStyle === style ? 'border-[#C1121F] text-[#C1121F] bg-[#C1121F]/10' : 'border-white/10 text-white/25'}`}
                        >
                          {style === 'square' ? <><Layout size={13} /> Cuadrado</> : <><CheckCircle2 size={13} /> Redondeado</>}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'texto' && (
                <motion.div key="texto" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
                  {/* CTA fijo — solo informativo */}
                  <div className="p-3 rounded-xl border border-[#F4A300]/30 bg-[#F4A300]/8">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#F4A300]/70 mb-1">CTA fijo en todos los carteles</p>
                    <p className="text-xs font-bold text-[#F4A300]">⭐ ESCANEA Y GANA 50 PTS ⭐</p>
                  </div>

                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-4 mb-1">Subtexto personalizable (línea pequeña)</p>
                  {SUB_OPTIONS.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setCfg(p => ({ ...p, subText: sub }))}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all text-xs font-medium leading-snug ${cfg.subText === sub ? 'border-[#C1121F] bg-[#C1121F]/10 text-white' : 'border-white/8 text-white/30 hover:border-white/20'}`}
                    >
                      {cfg.subText === sub && <span className="text-[#C1121F] mr-2 font-black">✓</span>}{sub}
                    </button>
                  ))}
                  <div className="pt-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-2">O escribe el tuyo:</p>
                    <input
                      type="text" maxLength={50} value={cfg.subText}
                      onChange={e => setCfg(p => ({ ...p, subText: e.target.value }))}
                      className="w-full bg-[#110800] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-white outline-none focus:border-[#C1121F]/50 placeholder:text-white/15"
                      placeholder="Texto pequeño del cartel..."
                    />
                    <p className="text-[8px] text-white/15 mt-1 text-right">{cfg.subText.length}/50</p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </section>

        {/* Info */}
        <section className="p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <Info size={14} className="text-[#52B788] mt-0.5 flex-shrink-0" />
            <p className="text-[10px] leading-relaxed text-white/40">
              Los turistas reciben <span className="text-[#52B788] font-bold">50 puntos</span> al escanear.
              Imprime en alta calidad para máxima legibilidad del QR.
            </p>
          </div>
        </section>

        {/* Botones */}
        <section className="space-y-3">
          <button
            onClick={handleDownload} disabled={downloading}
            className="w-full bg-[#C1121F] text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-[#C1121F]/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
          >
            {downloading
              ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              : <><Download size={18} /> Descargar — {activePoster.emoji} {activePoster.label}</>
            }
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/owner/edit')} className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-[#C1121F]/30 text-[#C1121F] text-xs font-black uppercase tracking-wider hover:bg-[#C1121F]/10 transition-all active:scale-95">
              <Edit size={14} /> Editar Perfil
            </button>
            <button onClick={() => navigate('/owner/edit?tab=menu')} className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-[#F4A300]/30 text-[#F4A300] text-xs font-black uppercase tracking-wider hover:bg-[#F4A300]/10 transition-all active:scale-95">
              <UtensilsCrossed size={14} /> Agregar Menú
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#110800] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-white/5 border-t-[#C1121F] rounded-full animate-spin" />
      <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">Generando Identidad Digital...</p>
    </div>
  );
}
