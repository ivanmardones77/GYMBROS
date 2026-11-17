import React from 'react';
import { Award, CheckCircle2, Flame, Trophy } from 'lucide-react';

export interface UnlockedAchievementSummary {
  id: string;
  title: string;
  rewardCoins: number;
  rewardXp: number;
}

export interface SummaryData {
  gameTitle: string;
  score: number;
  accuracyPct: number;
  maxCombo: number;
  caloriesBurned: number;
  muscleGain: number;
  fatLossPct: number;
  coinsEarned: number;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  duelWon?: boolean;
  rivalName?: string;
  hasNextRoutineStep?: boolean;
  routineCompletedBonus?: {
    title: string;
    coins: number;
    muscle: number;
  } | null;
  unlockedAchievements?: UnlockedAchievementSummary[];
}

interface RoundSummaryModalProps {
  summary: SummaryData;
  onContinue: () => void;
  onNextRoutineStep: () => void;
}

const CONFETTI_COLORS = [
  '#EA580C', // Vibrant gym orange
  '#FBBF24', // Gold
  '#10B981', // Emerald
  '#0284C7', // Sky blue
  '#F43F5E', // Coral rose
  '#A855F7', // Purple accent
];

const CONFETTI_PIECES = Array.from({ length: 48 }, (_, idx) => {
  const leftPct = ((idx * 19 + 7) % 96) + 2;
  const delaySec = ((idx % 12) * 0.09).toFixed(2);
  const durationSec = (2.3 + (idx % 7) * 0.28).toFixed(2);
  const driftPx = ((idx % 2 === 0 ? 1 : -1) * (18 + (idx % 5) * 16)).toFixed(0);
  const widthPx = idx % 3 === 0 ? 10 : idx % 3 === 1 ? 8 : 6;
  const heightPx = idx % 4 === 0 ? 10 : 14;
  const isCircle = idx % 6 === 0;
  return {
    id: idx,
    leftPct,
    delaySec,
    durationSec,
    driftPx,
    widthPx,
    heightPx,
    isCircle,
    color: CONFETTI_COLORS[idx % CONFETTI_COLORS.length],
  };
});

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
  summary,
  onContinue,
  onNextRoutineStep,
}) => {
  const unlockedList = summary.unlockedAchievements ?? [];
  const hasNewAchievement = unlockedList.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
      {hasNewAchievement && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
          {CONFETTI_PIECES.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={
                {
                  left: `${piece.leftPct}%`,
                  width: `${piece.widthPx}px`,
                  height: `${piece.heightPx}px`,
                  backgroundColor: piece.color,
                  borderRadius: piece.isCircle ? '9999px' : '2px',
                  animationDelay: `${piece.delaySec}s`,
                  animationDuration: `${piece.durationSec}s`,
                  '--drift': `${piece.driftPx}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div className="relative z-10 bg-[#141414] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 mb-3">
            <Trophy className="w-6 h-6" />
          </div>
          <p className="text-xs text-white/50">Sesión Completada</p>
          <h2 className="text-2xl font-bold text-white mt-0.5">{summary.gameTitle}</h2>
          <div className="text-6xl font-display italic font-black leading-none font-extrabold font-mono-tabular text-orange-500 mt-2">
            {summary.score.toLocaleString('es-ES')}<span className="text-2xl text-white/50 ml-1 not-italic">pts</span>
          </div>
        </div>

        {hasNewAchievement && (
          <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-400/40 rounded-xl text-xs text-amber-200">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              {unlockedList.length === 1
                ? '¡Nuevo Logro Desbloqueado!'
                : `¡${unlockedList.length} Nuevos Logros Desbloqueados!`}
            </div>
            <ul className="mt-1.5 space-y-1">
              {unlockedList.map((ach) => (
                <li key={ach.id} className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">{ach.title}</span>
                  <span className="font-mono-tabular font-bold text-amber-300 shrink-0">
                    +{ach.rewardCoins} mon · +{ach.rewardXp} XP
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.leveledUp && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs font-bold text-emerald-300">
            ¡Subiste al Nivel {summary.newLevel}! Se desbloquean rutinas y dificultades superiores.
          </div>
        )}

        {summary.rivalName && (
          <div
            className={`mt-4 p-3 rounded-xl border text-center text-xs font-bold ${
              summary.duelWon
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {summary.duelWon
              ? `¡Victoria en Duelo contra ${summary.rivalName}! (+350 pts liga y +120 monedas)`
              : `No superaste la marca de ${summary.rivalName}. ¡Inténtalo de nuevo!`}
          </div>
        )}

        {summary.routineCompletedBonus && (
          <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs text-orange-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
            <span>
              Rutina <strong>{summary.routineCompletedBonus.title}</strong> completada: +{summary.routineCompletedBonus.coins} monedas y +{summary.routineCompletedBonus.muscle.toFixed(2)} kg músculo.
            </span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-white/[0.03] border border-white/10 rounded-lg">
            <div className="text-xs text-white/50">Precisión · Combo</div>
            <div className="font-mono-tabular font-bold text-white mt-0.5">
              {summary.accuracyPct}% · x{summary.maxCombo}
            </div>
          </div>
          <div className="p-3 bg-white/[0.03] border border-white/10 rounded-lg">
            <div className="text-xs text-white/50 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-500" /> Calorías
            </div>
            <div className="font-mono-tabular font-bold text-white mt-0.5">
              {summary.caloriesBurned} kcal
            </div>
          </div>
          <div className="p-3 bg-white/[0.03] border border-white/10 rounded-lg">
            <div className="text-xs text-white/50">Transformación</div>
            <div className="font-mono-tabular font-bold text-emerald-400 mt-0.5">
              +{summary.muscleGain.toFixed(2)}kg · -{summary.fatLossPct.toFixed(2)}%
            </div>
          </div>
          <div className="p-3 bg-white/[0.03] border border-white/10 rounded-lg">
            <div className="text-xs text-white/50">Recompensas</div>
            <div className="font-mono-tabular font-bold text-amber-300 mt-0.5">
              +{summary.coinsEarned} mon · +{summary.xpEarned} XP
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {summary.hasNextRoutineStep ? (
            <button
              onClick={onNextRoutineStep}
              className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm rounded-xl cursor-pointer"
            >
              Siguiente Estación de Rutina
            </button>
          ) : (
            <button
              onClick={onContinue}
              className="flex-1 py-3.5 px-4 bg-white hover:bg-orange-500 hover:text-white text-black font-display italic uppercase font-black tracking-wider text-lg rounded-xl cursor-pointer transition-colors"
            >
              Volver al Gimnasio
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
