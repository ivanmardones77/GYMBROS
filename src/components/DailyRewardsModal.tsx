import React from 'react';
import { DAILY_REWARDS } from '../data/gameData';
import { PlayerStats } from '../types/game';
import { Gift, Check, X, Sparkles } from 'lucide-react';

interface DailyRewardsModalProps {
  player: PlayerStats;
  onClaimDay: (day: number) => void;
  onClaimMission: (missionId: string, coins: number, xp: number) => void;
  onSimulateNextDay: () => void;
  onClose: () => void;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
  player,
  onClaimDay,
  onClaimMission,
  onSimulateNextDay,
  onClose,
}) => {
  const dailyMissions = [
    {
      id: 'm_workouts',
      title: 'Completa 2 entrenamientos hoy',
      current: player.workoutsToday,
      target: 2,
      coins: 120,
      xp: 80,
    },
    {
      id: 'm_meals',
      title: 'Prepara 2 comidas limpias',
      current: player.healthyMealsToday,
      target: 2,
      coins: 90,
      xp: 60,
    },
    {
      id: 'm_weekly',
      title: 'Acumula 1,000 pts en Liga Semanal',
      current: player.weeklyScore,
      target: 1000,
      coins: 160,
      xp: 120,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <p className="text-xs text-white/50">Racha actual: {player.streakDays} día(s)</p>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-orange-500" />
              Recompensas Diarias Desbloqueables
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar recompensas"
            className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7-Day Calendar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Calendario de 7 Días</h3>
            <button
              onClick={onSimulateNextDay}
              className="text-xs font-semibold text-orange-500 hover:underline cursor-pointer"
            >
              Avanzar al siguiente día (+1 Racha)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DAILY_REWARDS.map((step) => {
              const isClaimed = player.claimedDailyDays.includes(step.day);
              const isUnlocked = step.day <= player.streakDays;
              const canClaim = isUnlocked && !isClaimed;

              return (
                <div
                  key={step.day}
                  className={`border rounded-xl p-3.5 flex flex-col justify-between ${
                    step.day === 7 ? 'sm:col-span-2' : ''
                  } ${
                    isClaimed
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : canClaim
                      ? 'bg-orange-500/10 border-orange-500/40'
                      : 'bg-white/[0.03] border-white/10 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-white/75">{step.title}</span>
                      {isClaimed && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-xs font-bold text-white mt-1.5">{step.rewardText}</p>
                  </div>

                  <button
                    onClick={() => onClaimDay(step.day)}
                    disabled={!canClaim}
                    className={`mt-3 w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      isClaimed
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : canClaim
                        ? 'bg-orange-500 hover:bg-orange-400 text-white'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {isClaimed ? 'Reclamado' : canClaim ? 'Reclamar' : `Día ${step.day}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Missions */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-500" />
            Misiones Diarias
          </h3>
          <div className="space-y-2.5">
            {dailyMissions.map((m) => {
              const claimed = player.dailyMissionsClaimed.includes(m.id);
              const ready = m.current >= m.target && !claimed;

              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{m.title}</div>
                    <div className="text-xs text-white/50 font-mono-tabular">
                      Progreso: {Math.min(m.current, m.target)} / {m.target} · +{m.coins} monedas · +{m.xp} XP
                    </div>
                  </div>
                  <button
                    onClick={() => onClaimMission(m.id, m.coins, m.xp)}
                    disabled={!ready}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed ${
                      claimed
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : ready
                        ? 'bg-orange-500 hover:bg-orange-400 text-white'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {claimed ? 'Completada' : ready ? 'Reclamar' : 'En curso'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
