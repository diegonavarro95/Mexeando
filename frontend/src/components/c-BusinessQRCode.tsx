/**
 * src/components/c-BusinessQRCode.tsx
 * Componente Atómico: Generador de Identidad QR para Check-in.
 * Merge: Diseño v1 (documento) + descarga cross-browser de v2 (inline)
 *
 * DISEÑO    → v1: img con dataURL, hover scale+grayscale, botón "Compartir con Staff",
 *                 estado de error con ShieldCheck, spinner con card completo,
 *                 nota técnica verde, título "Check-in Oficial"
 * FUNCIONES → v2: document.body.appendChild/removeChild en handleDownload (cross-browser)
 *                 — businessName y lógica de fetch ya eran superiores en v1
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import { Download, QrCode, ShieldCheck, Info, Share2 } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  businessId: string;
}

export const BusinessQRCode = ({ businessId }: Props) => {
  const [qrImageUrl,   setQrImageUrl]   = useState('');
  const [loading,      setLoading]      = useState(true);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    const fetchRealQR = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/v1/businesses/${businessId}/qr-token`);
        const { qr_content, business_name } = response.data.data;
        setBusinessName(business_name);

        // 800px para impresión de gran formato (Carteles / Lonas)
        const imageUrl = await QRCode.toDataURL(qr_content, {
          width: 800,
          margin: 2,
          color: {
            dark: '#C1121F',  // Rojo Institucional OLA MX
            light: '#FFF3DC', // Crema para máxima escaneabilidad
          },
          errorCorrectionLevel: 'H', // Nivel alto: resiste daños físicos en el local
        });

        setQrImageUrl(imageUrl);
      } catch (error) {
        console.error('Error crítico en generación de QR:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRealQR();
  }, [businessId]);

  // Descarga robusta cross-browser (appendChild/removeChild de v2)
  const handleDownload = () => {
    if (!qrImageUrl) return;
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `CheckIn_Oficial_${businessName || businessId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Estados ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="p-12 text-center flex flex-col items-center gap-4 bg-white/5 border border-white/10 rounded-[2.5rem] backdrop-blur-md">
      <div className="w-10 h-10 border-4 border-white/5 border-t-[#C1121F] rounded-full animate-spin" />
      <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">Cifrando Master QR...</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden flex w-full max-w-md flex-col items-center p-6 bg-white/5 border border-white/10 rounded-[3rem] shadow-2xl mx-auto backdrop-blur-xl sm:p-8"
    >
      {/* ── Banderita Institucional ── */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex">
        <div className="flex-1 bg-[#006847]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#C1121F]" />
      </div>

      {/* ── Título ── */}
      <div className="flex flex-col items-center gap-1 mb-8">
        <h2 className="text-white font-black italic text-xl uppercase tracking-tighter">
          Check-in <span className="text-[#C1121F]">Oficial</span>
        </h2>
        <div className="flex items-center gap-2 opacity-30">
          <QrCode size={12} className="text-[#F4A300]" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FFF3DC]">Identidad Digital</span>
        </div>
      </div>

      {qrImageUrl ? (
        <>
          {/* ── Marco del QR ── */}
          <div className="relative group mb-8">
            <div className="absolute inset-0 bg-[#C1121F]/15 blur-[50px] rounded-full group-hover:bg-[#C1121F]/25 transition-all duration-500" />
            <div className="relative bg-[#FFF3DC] p-6 rounded-[2.5rem] shadow-2xl border border-white/20 transform group-hover:scale-[1.02] transition-transform duration-300">
              <img
                src={qrImageUrl}
                alt="QR Check-in"
                className="w-56 h-56 rounded-2xl grayscale-[0.2] group-hover:grayscale-0 transition-all"
              />
              <div className="mt-4 text-center border-t border-[#110800]/10 pt-3">
                <p className="text-[#110800] font-black text-sm italic uppercase tracking-tighter truncate max-w-[190px] mx-auto">
                  {businessName || 'Sede Mundialista'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Acciones ── */}
          <div className="w-full space-y-3">
            <button
              onClick={handleDownload}
              className="w-full bg-[#C1121F] text-white font-black py-5 px-6 rounded-2xl transition-all shadow-lg shadow-[#C1121F]/20 active:scale-95 flex items-center justify-center gap-3 uppercase text-[11px] tracking-[0.2em]"
            >
              <Download size={18} />
              Descargar Kit PNG
            </button>

            <button className="w-full bg-white/5 text-white/40 font-black py-4 rounded-2xl flex items-center justify-center gap-3 uppercase text-[9px] tracking-[0.2em] border border-white/5 hover:text-white hover:bg-white/10 transition-all">
              <Share2 size={14} />
              Compartir con Staff
            </button>
          </div>

          {/* ── Nota Técnica ── */}
          <div className="mt-8 flex items-start gap-3 px-4 py-3 bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 rounded-2xl">
            <Info size={14} className="text-[#52B788] mt-0.5 shrink-0" />
            <p className="text-[9px] text-white/60 uppercase tracking-widest leading-relaxed">
              Archivo de{' '}
              <span className="text-[#52B788] font-bold text-[10px]">Alta Fidelidad</span>.
              Apto para impresión en vinil, lonas y acrílico.
            </p>
          </div>
        </>
      ) : (
        /* ── Estado de Error ── */
        <div className="py-12 flex flex-col items-center gap-3 text-[#C1121F]">
          <ShieldCheck size={40} className="opacity-10 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Error de Enlace</p>
        </div>
      )}
    </motion.div>
  );
};
