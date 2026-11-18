import React from 'react';
import { Activity, Apple, ArrowDownUp, Dumbbell, Footprints, Target, Waves, Zap } from 'lucide-react';
import { MinigameId } from '../types/game';

export const GAME_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  bench: Dumbbell,
  sprint: Footprints,
  boxing: Target,
  macros: Apple,
  squats: ArrowDownUp,
  rope: Activity,
  battle_ropes: Waves,
};

export const CATEGORY_TINT: Record<string, string> = {
  Fuerza: 'from-orange-500/25',
  Cardio: 'from-sky-400/20',
  Combate: 'from-rose-500/25',
  Nutrición: 'from-emerald-400/20',
};

interface GameCardProps {
  index: number;
  game: {
    id: MinigameId;
    title: string;
    category: string;
    muscleFocus: string;
    shortDesc: string;
    controlsHint?: string;
  };
  meta: string;
  energyCost: number;
  kcal?: number;
  bestScore?: number;
  variant?: 'compact' | 'full';
  onPlay: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  index,
  game,
  meta,
  energyCost,
  kcal,
  bestScore,
  variant = 'compact',
  onPlay,
}) => {
  const Icon = GAME_ICONS[game.id] ?? Dumbbell;
  const tint = CATEGORY_TINT[game.category] ?? 'from-orange-500/25';
  const full = variant === 'full';

  return (
    <div className="group relative fc-card overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_24px_60px_-24px_rgba(255,90,31,0.45)]">
      {/* Visual header */}
      <div className={`relative ${full ? 'h-40' : 'h-32'} bg-gradient-to-br ${tint} via-transparent to-transparent fc-stripes overflow-hidden`}>
        <Icon
          className={`absolute -right-4 -bottom-6 ${full ? 'w-40 h-40' : 'w-32 h-32'} text-white/[0.07] group-hover:text-white/[0.12] group-hover:scale-105 transition-all duration-500`}
          strokeWidth={1.4}
        />
        <div className="absolute left-5 top-3 font-display italic font-black text-[2.6rem] leading-none text-white/15 group-hover:text-orange-500/80 transition-colors">
          {String(index + 1).padStart(2, '0')}
        </div>
        <div className="absolute right-4 top-4 flex items-center gap-1.5">
          {bestScore !== undefined && bestScore > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-mono-tabular font-bold text-amber-300 backdrop-blur">
              PB {bestScore.toLocaleString('es-ES')}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-black/50 border border-white/10 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur">
            {game.category}
          </span>
        </div>
        <div className="absolute left-5 bottom-3 w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center -skew-x-6 shadow-lg">
          <Icon className="w-5.5 h-5.5 skew-x-6" strokeWidth={2.4} />
        </div>
      </div>

      <div className={`${full ? 'p-6' : 'p-5'} pt-4 flex-1 flex flex-col justify-between`}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{game.muscleFocus}</div>
          <h3 className={`${full ? 'text-[1.9rem]' : 'text-[1.45rem]'} !font-black italic text-white mt-1 leading-[0.95]`}>
            {game.title}
          </h3>
          <p className={`${full ? 'text-sm' : 'text-xs'} text-white/55 mt-2 leading-relaxed`}>{game.shortDesc}</p>
          {full && game.controlsHint && (
            <div className="mt-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-white/65">
              <span className="font-display uppercase tracking-wider font-bold text-white/85 mr-1">Controles</span>
              {game.controlsHint}
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] text-white/45 mb-2.5 font-semibold uppercase tracking-wider">
            <span>{meta}</span>
            <span className="flex items-center gap-2">
              {kcal !== undefined && <span className="text-white/60">~{kcal} kcal</span>}
              <span className="text-orange-500 flex items-center gap-0.5">
                <Zap className="w-3 h-3" />
                {energyCost}
              </span>
            </span>
          </div>
          <button
            onClick={onPlay}
            className="w-full py-3 rounded-xl bg-white text-black font-display italic font-black uppercase tracking-[0.06em] text-base transition-all cursor-pointer group-hover:bg-orange-500 group-hover:text-white active:scale-[0.98]"
          >
            Jugar ahora
          </button>
        </div>
      </div>
    </div>
  );
};
