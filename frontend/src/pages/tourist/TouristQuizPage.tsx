import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, Sparkles } from 'lucide-react'
import {
  TOURIST_QUESTIONS,
  resolveTouristPersona,
  saveStoredTouristPersona,
  type TouristPersonaId,
} from '../../lib/touristPersona'

export default function TouristQuizPage() {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Record<string, TouristPersonaId>>({})
  const [error, setError] = useState('')

  const canContinue = TOURIST_QUESTIONS.every((question) => answers[question.id])

  const handleContinue = () => {
    if (!canContinue) {
      setError('Contesta las 3 preguntas para identificar tu perfil.')
      return
    }

    const personaId = resolveTouristPersona(answers)
    saveStoredTouristPersona(personaId)
    navigate('/explore', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#195f69_0%,#143e53_26%,#1a1128_62%,#110701_100%)] px-4 py-8 text-[#FFF3DC] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/10 bg-[rgba(17,8,0,0.86)] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C1121F]/16 text-[#ffccd0]">
              <Compass size={28} />
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.24em] text-[#f4c16c]">
              Quiz inicial del turista
            </p>
            <h1 className="mt-3 text-[clamp(2rem,6vw,3.4rem)] font-black tracking-[-0.06em] text-white">
              ¿Qué tipo de mexicano eres?
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#FFF3DC]/78">
              Este paso es solo para perfilar la experiencia del turista. Está hardcodeado y se guarda solo en este dispositivo.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-3xl gap-5">
            {TOURIST_QUESTIONS.map((question, index) => (
              <section
                key={question.id}
                className="rounded-[1.75rem] border border-white/8 bg-white/[0.04] p-4 sm:p-5"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f4c16c]">
                  Pregunta {index + 1}
                </p>
                <h2 className="mt-2 text-lg font-black text-white sm:text-xl">
                  {question.title}
                </h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option.persona

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setAnswers((current) => ({ ...current, [question.id]: option.persona }))
                          setError('')
                        }}
                        className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                          selected
                            ? 'border-[#C1121F]/50 bg-[#C1121F]/16 text-white shadow-[0_12px_24px_rgba(193,18,31,0.18)]'
                            : 'border-white/10 bg-[#140900] text-[#FFF3DC]/80 hover:border-[#f4c16c]/28 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="block text-sm font-black leading-6">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {error && (
            <div className="mx-auto mt-6 max-w-3xl rounded-[1.2rem] border border-[#C1121F]/28 bg-[#C1121F]/12 px-4 py-3 text-sm font-semibold text-[#ffd5d8]">
              {error}
            </div>
          )}

          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#FFF3DC]/58">
              <Sparkles size={14} className="text-[#f4c16c]" />
              Perfil local y editable más adelante
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex min-h-[3.4rem] items-center justify-center rounded-full bg-[linear-gradient(135deg,#C1121F,#8d0d15)] px-6 py-3 text-[13px] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_28px_rgba(193,18,31,0.28)] transition hover:brightness-110"
            >
              Continuar a la ruta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
