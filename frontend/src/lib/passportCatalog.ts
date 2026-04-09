// src/lib/passportCatalog.ts
import type { CollectionSlug, StampCollection } from '../store/passportStore'

// --- 1. ARTE POR DEFECTO PARA LAS COLECCIONES (FALLBACKS) ---
import saboresArt from '../assets/stamps/sabores.svg'
import artesaniasArt from '../assets/stamps/artesanias.svg'
import guiasArt from '../assets/stamps/guias.svg'
import iconosArt from '../assets/stamps/iconos.svg'

// --- 2. IMPORTACIÓN DE IMÁGENES INDIVIDUALES (DICCIONARIO FRONTAL) ---
// Guías
import guiasCalandria from '../stamps/EstampasMundial/GUIASCalandria Tapatía.jpeg'
import guiasVieneViene from '../stamps/EstampasMundial/GUIASElvieneviene.jpeg'
import guiasOrganillero from '../stamps/EstampasMundial/GUIASOrganillero.jpeg'
import guiasTaquero from '../stamps/EstampasMundial/GUIASTaqueroExperto.jpeg'
import guiasTeleferico from '../stamps/EstampasMundial/GUIASTeleférico Regio.jpeg'
import guiasAlgodon from '../stamps/EstampasMundial/GUIASVendedor de Algodón.jpeg'

// Íconos
import iconosAficionado from '../stamps/EstampasMundial/ICONOAficionadodePenacho.png'
import iconosBalon from '../stamps/EstampasMundial/ICONOBalón Clásico.png'
import iconosQuintoPartido from '../stamps/EstampasMundial/ICONOElQuintoPartido.png'
import iconosOla from '../stamps/EstampasMundial/ICONOLaOla.png'
import iconosMexicoOro from '../stamps/EstampasMundial/ICONOMéxico 2012 Oro Olímpico.png'
import iconosTarjeta from '../stamps/EstampasMundial/ICONOTarjeta Roja.png'
import iconosVar from '../stamps/EstampasMundial/ICONOVarPolemico.png'

// **NOTA: Agrega aquí las importaciones de "Sabores" y "Artesanías" cuando las tengas**


// --- 3. DICCIONARIO DE RELACIÓN (SLUG -> IMAGEN) ---
const STAMP_ASSETS: Record<string, string> = {
  // Guías
  'calandria-tapatia': guiasCalandria,
  'el-viene-viene': guiasVieneViene,
  'organillero': guiasOrganillero,
  'taquero-experto': guiasTaquero,
  'teleferico-regio': guiasTeleferico,
  'vendedor-de-algodon': guiasAlgodon,

  // Íconos
  'aficionado-de-penacho': iconosAficionado,
  'balon-clasico': iconosBalon,
  'el-quinto-partido': iconosQuintoPartido,
  'la-ola': iconosOla,
  'mexico-2012-oro-olimpico': iconosMexicoOro,
  'tarjeta-roja': iconosTarjeta,
  'var-polemico': iconosVar,

  // **NOTA: Agrega aquí las relaciones de "Sabores" y "Artesanías"**
}

type DisplayRarity = 'common' | 'rare' | 'epic' | 'legendary'

const COLLECTION_ALIASES: Record<string, CollectionSlug> = {
  sabores: 'sabores',
  'sabores-de-mexico': 'sabores',
  artesanias: 'artesanias',
  'artesanias-del-mundo': 'artesanias',
  guias: 'guias',
  'guias-del-barrio': 'guias',
  iconos: 'iconos',
  'iconos-del-mundial': 'iconos',
}

const COLLECTION_PRESENTATION: Record<CollectionSlug, { name: string; art: string }> = {
  sabores: { name: 'Sabores de México', art: saboresArt },
  artesanias: { name: 'Artesanías del Mundo', art: artesaniasArt },
  guias: { name: 'Guías del Barrio', art: guiasArt },
  iconos: { name: 'Íconos del Mundial', art: iconosArt },
}

const FALLBACK_STAMPS: Record<CollectionSlug, string[]> = {
  sabores: [
    'tacos-al-pastor',
    'torta-ahogada',
    'cabrito-asado',
    'tamal-oaxaqueno',
    'pozole-rojo',
    'tlayuda',
  ],
  artesanias: [
    'alebrije-magico',
    'jarrito-de-tlaquepaque',
    'sombrero-norteno',
    'talavera-poblana',
    'muneca-lele',
    'papel-picado',
  ],
  guias: [
    'trajinera-fiestera',
    'calandria-tapatia',
    'teleferico-regio',
    'organillero',
    'taquero-experto',
    'danzante-azteca',
  ],
  iconos: [
    'balon-clasico',
    'copa-del-campeon',
    'mexico-2012-oro-olimpico',
    'no-era-penal',
    'jorge-campos',
    'la-ola',
  ],
}

function normalizeCollectionSlug(rawSlug: string): CollectionSlug {
  const cleaned = rawSlug.trim().toLowerCase()
  return COLLECTION_ALIASES[cleaned] ?? 'sabores'
}

function formatStampName(rawSlug: string, fallbackId: number) {
  const normalized = rawSlug
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (!normalized) return `Estampa ${fallbackId}`

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolveDisplayRarity(rawRarity: string | null | undefined): DisplayRarity {
  if (rawRarity === 'exclusive') return 'legendary'
  if (rawRarity === 'rare') return 'rare'
  return 'common'
}

export function isStampImageSource(icon: string) {
  return /^(https?:|\/|data:image)/i.test(icon) || /\.(svg|png|jpe?g|webp|gif)$/i.test(icon)
}

export function buildPassportAlbum(rawAlbum: any[]): StampCollection[] {
  return (rawAlbum || []).map((collection) => {
    const collectionSlug = normalizeCollectionSlug(
      collection.slug || collection.collection_slug || ''
    )
    const presentation = COLLECTION_PRESENTATION[collectionSlug]

    return {
      collection_slug: collectionSlug,
      collection_name: presentation.name,
      total_stamps: Number(collection.total_stamps || 0),
      obtained_stamps: Number(collection.obtained_stamps || 0),
      completion_pct: Number(collection.completion_pct || 0),
      is_complete: Boolean(collection.is_complete),
      stamps: (collection.stamps || []).map((stamp: any) => {
        
        const stampSlug = stamp.slug || stamp.name || ''

        return {
          id: stamp.stamp_id || stamp.id,
          name: formatStampName(stampSlug, stamp.stamp_id || stamp.id || 0),
          
          // LA LÓGICA MAGICA: Busca en el diccionario, si no lo encuentra, usa el logo rojo
          icon: STAMP_ASSETS[stampSlug] || presentation.art,
          
          collection_slug: collectionSlug,
          description: stamp.description || '',
          rarity: resolveDisplayRarity(stamp.rarity),
          exclusive_city: stamp.exclusive_city || null,
          obtained: Boolean(stamp.obtained),
          obtained_at: stamp.obtained_at || undefined,
        }
      }),
    }
  })
}

export function buildFallbackPassportAlbum(): StampCollection[] {
  let nextId = 1

  return (Object.keys(COLLECTION_PRESENTATION) as CollectionSlug[]).map((collectionSlug) => {
    const presentation = COLLECTION_PRESENTATION[collectionSlug]
    const stamps = FALLBACK_STAMPS[collectionSlug].map((slug) => ({
      id: nextId++,
      name: formatStampName(slug, nextId),
      
      // Aquí también usamos el diccionario para que el modo "fallback" también muestre las fotos
      icon: STAMP_ASSETS[slug] || presentation.art,
      
      collection_slug: collectionSlug,
      description: '',
      rarity: 'common' as const,
      exclusive_city: null,
      obtained: false,
    }))

    return {
      collection_slug: collectionSlug,
      collection_name: presentation.name,
      total_stamps: stamps.length,
      obtained_stamps: 0,
      completion_pct: 0,
      is_complete: false,
      stamps,
    }
  })
}