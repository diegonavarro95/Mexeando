export type TouristPersonaId = 'garnachero' | 'explorador' | 'clasico' | 'festivo'

export interface TouristPersonaOption {
  id: string
  label: string
  persona: TouristPersonaId
}

export interface TouristPersonaQuestion {
  id: string
  title: string
  options: TouristPersonaOption[]
}

export interface TouristPersonaRecord {
  id: TouristPersonaId
  title: string
  description: string
  createdAt: string
}

const STORAGE_KEY = 'touristPersona'

export const TOURIST_QUESTIONS: TouristPersonaQuestion[] = [
  {
    id: 'antojito',
    title: '¿Qué se te antoja primero cuando llegas a una ruta nueva?',
    options: [
      { id: 'street', label: 'Algo callejero y con salsa', persona: 'garnachero' },
      { id: 'hidden', label: 'Un lugar secreto que nadie ubica', persona: 'explorador' },
      { id: 'classic', label: 'El clásico que nunca falla', persona: 'clasico' },
      { id: 'music', label: 'Donde haya ambiente y buena vibra', persona: 'festivo' },
    ],
  },
  {
    id: 'plan',
    title: '¿Cómo recorres una ciudad nueva?',
    options: [
      { id: 'walk', label: 'Caminando y oliendo todo', persona: 'garnachero' },
      { id: 'map', label: 'Buscando rincones fuera del mapa obvio', persona: 'explorador' },
      { id: 'list', label: 'Siguiendo una lista bien armada', persona: 'clasico' },
      { id: 'crew', label: 'Improvisando con la banda', persona: 'festivo' },
    ],
  },
  {
    id: 'souvenir',
    title: '¿Qué te llevas de recuerdo de un barrio?',
    options: [
      { id: 'flavor', label: 'El sabor que más me sorprendió', persona: 'garnachero' },
      { id: 'story', label: 'La historia escondida del lugar', persona: 'explorador' },
      { id: 'photo', label: 'La foto perfecta del sitio emblemático', persona: 'clasico' },
      { id: 'moment', label: 'La anécdota más divertida del día', persona: 'festivo' },
    ],
  },
]

const PERSONA_COPY: Record<TouristPersonaId, { title: string; description: string }> = {
  garnachero: {
    title: 'Garnachero de Barrio',
    description: 'Vas directo al sabor real, al puesto con humo y a la parada que se gana la fama en la banqueta.',
  },
  explorador: {
    title: 'Explorador de Rincones',
    description: 'Te mueve descubrir joyas escondidas, rutas poco obvias y lugares con historia local.',
  },
  clasico: {
    title: 'Clásico del Barrio',
    description: 'Prefieres lugares confiables, emblemáticos y con identidad que aguanta cualquier visita.',
  },
  festivo: {
    title: 'Festivo del Barrio',
    description: 'Persigues ambiente, energía y experiencias para compartir con todos.',
  },
}

const STAGE_COPY = [
  { minCheckIns: 0, minPoints: 0, label: 'Arranque de Ruta' },
  { minCheckIns: 3, minPoints: 200, label: 'Calle Conocida' },
  { minCheckIns: 7, minPoints: 500, label: 'Ruta Pesada' },
  { minCheckIns: 12, minPoints: 900, label: 'Leyenda del Barrio' },
]

export function getStoredTouristPersona(): TouristPersonaRecord | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as TouristPersonaRecord
  } catch {
    return null
  }
}

export function saveStoredTouristPersona(personaId: TouristPersonaId) {
  const payload: TouristPersonaRecord = {
    id: personaId,
    title: PERSONA_COPY[personaId].title,
    description: PERSONA_COPY[personaId].description,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  return payload
}

export function hasStoredTouristPersona() {
  return getStoredTouristPersona() !== null
}

export function clearStoredTouristPersona() {
  localStorage.removeItem(STORAGE_KEY)
}

export function resolveTouristPersona(answers: Record<string, TouristPersonaId>): TouristPersonaId {
  const scores: Record<TouristPersonaId, number> = {
    garnachero: 0,
    explorador: 0,
    clasico: 0,
    festivo: 0,
  }

  Object.values(answers).forEach((personaId) => {
    scores[personaId] += 1
  })

  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'garnachero') as TouristPersonaId
}

export function getTouristPersonaProgressLabel(pointBalance: number, checkIns: number) {
  const current = [...STAGE_COPY]
    .reverse()
    .find((stage) => checkIns >= stage.minCheckIns || pointBalance >= stage.minPoints)

  return current?.label ?? STAGE_COPY[0].label
}
