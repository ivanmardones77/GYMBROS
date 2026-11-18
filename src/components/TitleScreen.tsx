import React, { useState } from 'react';
import { Gender } from '../types/game';
import { Athlete3DViewer } from './Athlete3DViewer';
import gymBackdrop from '../assets/images/gym_club_backdrop_1794945942801.jpg';

interface TitleScreenProps {
  onStart: (name: string, gender: Gender, skinTone: string, hairColor: string) => void;
  aiAthlete?: boolean;
  onChangeAiAthlete?: (ai: boolean) => void;
}

const SKIN_TONES = ['#F5D0B5', '#E8B896', '#C68B59', '#8D5524'];
const HAIR_COLORS = ['#1E293B', '#5C3A21', '#B45309', '#991B1B'];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  aiAthlete = true,
  onChangeAiAthlete,
}) => {
  const [gender, setGender] = useState<Gender>('male');
  const [name, setName] = useState('');
  const [skinTone, setSkinTone] = useState('#E8B896');
  const [hairColor, setHairColor] = useState('#1E293B');
  const [previewMode, setPreviewMode] = useState<'start' | 'elite'>('start');
  const [imgError, setImgError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(name, gender, skinTone, hairColor);
  };

  const seg = (on: boolean, accent = false) =>
    `py-2.5 font-display uppercase tracking-wider font-bold text-[0.95rem] rounded-lg transition-all cursor-pointer ${
      on ? (accent ? 'bg-orange-500 text-white' : 'bg-white text-black') : 'text-white/50 hover:text-white'
    }`;

  return (
    <div className="min-h-screen relative overflow-hidden flex items-stretch">
      {/* Backdrop */}
      {!imgError && (
        <img
          src={gymBackdrop}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale contrast-125 scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/80 to-[#0A0A0A]/95" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-[#0A0A0A]/60" />
      <div className="absolute -left-40 top-1/3 w-[620px] h-[620px] rounded-full bg-orange-500/[0.14] blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 py-8 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Left: Brand + live athlete */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center gap-2.5 fc-rise">
            <span className="w-4 h-1 -skew-x-12 bg-orange-500 inline-block" />
            <span className="fc-kicker">Simulador arcade de gimnasio</span>
          </div>
          <h1 className="mt-3 text-[4.2rem] sm:text-[6.2rem] leading-[0.82] text-white fc-rise" style={{ animationDelay: '60ms' }}>
            GYM
            <span className="text-transparent [-webkit-text-stroke:2px_#FF5A1F]">BROS</span>
          </h1>
          <p className="mt-5 text-[0.95rem] text-white/60 max-w-md leading-relaxed fc-rise" style={{ animationDelay: '120ms' }}>
            Empiezas desde cero. Fuerza, cardio, boxeo y dieta para esculpir un cuerpo de élite y ganar la liga semanal.
          </p>

          <div className="mt-6 relative rounded-[1.5rem] overflow-hidden fc-stage fc-rise" style={{ animationDelay: '180ms' }}>
            <Athlete3DViewer
              gender={gender}
              fitnessScore={previewMode === 'start' ? 14 : 94}
              skinTone={skinTone}
              hairColor={hairColor}
              outfit={previewMode === 'start' ? 'basic' : 'titan'}
              pose={previewMode === 'start' ? 'tired' : 'flex'}
              interactive={true}
              aiModel={aiAthlete}
              kineticMode={previewMode === 'elite' ? 'routine' : 'none'}
              kineticLabel="Meta élite · energía máxima"
              className="w-full h-[340px]"
            />
            <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-1 p-1 bg-black/80 rounded-xl border border-white/10">
                <button type="button" onClick={() => setPreviewMode('start')} className={`px-3 ${seg(previewMode === 'start')}`}>
                  Hoy · 14
                </button>
                <button type="button" onClick={() => setPreviewMode('elite')} className={`px-3 ${seg(previewMode === 'elite', true)}`}>
                  Meta · 94
                </button>
              </div>
              {onChangeAiAthlete && (
                <div className="pointer-events-auto flex items-center gap-1 p-1 bg-black/80 rounded-xl border border-white/10">
                  {[
                    { label: 'Clásico', v: false },
                    { label: 'Realista', v: true },
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => onChangeAiAthlete(b.v)}
                      className={`px-2.5 py-1.5 rounded-lg font-display uppercase tracking-wider font-bold text-xs cursor-pointer transition-colors ${
                        aiAthlete === b.v
                          ? b.v
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-black'
                          : 'text-white/55 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 max-w-lg">
            {[
              { k: '07', l: 'Disciplinas' },
              { k: '05', l: 'Niveles pro' },
              { k: 'LIVE', l: 'Liga semanal', accent: true },
            ].map((x) => (
              <div key={x.l} className="border-l-2 border-orange-500/70 pl-3">
                <div className={`font-display italic font-black text-3xl leading-none ${x.accent ? 'text-orange-500' : 'text-white'}`}>{x.k}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mt-1">{x.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Character creation */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 fc-card !bg-[#111]/85 backdrop-blur-xl p-7 sm:p-8 flex flex-col justify-between shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] fc-rise"
          style={{ animationDelay: '220ms' }}
        >
          <div>
            <p className="fc-kicker">Paso 1 de 1</p>
            <h2 className="text-[2.4rem] text-white mt-1">Crea tu atleta</h2>
            <p className="text-sm text-white/50 mt-2">
              Arrancas en baja forma (14/100). Tu cuerpo cambia con cada entrenamiento.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-1.5 p-1.5 bg-white/[0.05] border border-white/[0.06] rounded-xl">
              <button type="button" onClick={() => setGender('male')} className={seg(gender === 'male')}>
                Hombre
              </button>
              <button type="button" onClick={() => setGender('female')} className={seg(gender === 'female')}>
                Mujer
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] font-semibold text-white/50 mb-2">
                  Nombre del atleta
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={gender === 'male' ? 'Ej: Carlos' : 'Ej: Sofía'}
                  className="w-full px-4 py-3.5 font-display text-xl font-bold uppercase tracking-wide border border-white/10 rounded-xl focus:outline-none focus:border-orange-500 focus:bg-white/[0.07] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Tono de piel', list: SKIN_TONES, value: skinTone, set: setSkinTone, prefix: 'Tono' },
                  { label: 'Cabello', list: HAIR_COLORS, value: hairColor, set: setHairColor, prefix: 'Cabello' },
                ].map((g) => (
                  <div key={g.label}>
                    <span className="block text-[11px] uppercase tracking-[0.16em] font-semibold text-white/50 mb-2">{g.label}</span>
                    <div className="flex items-center gap-2">
                      {g.list.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => g.set(c)}
                          aria-label={`${g.prefix} ${c}`}
                          className={`w-8 h-8 rounded-full cursor-pointer transition-all ring-offset-2 ring-offset-[#111] ${
                            g.value === c ? 'ring-2 ring-orange-500 scale-110' : 'ring-1 ring-white/15 hover:ring-white/40'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="fc-btn-accent mt-8 w-full py-4 px-6 text-xl rounded-xl cursor-pointer"
          >
            Empezar transformación →
          </button>
        </form>
      </div>
    </div>
  );
};
