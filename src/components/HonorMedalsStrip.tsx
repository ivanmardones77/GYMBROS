import React, { useState } from 'react';
import {
  HONOR_MEDALS,
  aggregateHonorBonuses,
  formatRemainingTime,
  getActiveHonorModifiers,
} from '../data/gameData';
import { HonorMedalId, PlayerStats } from '../types/game';
import { Clock, Shield, Sparkles } from 'lucide-react';

interface HonorMedalsShowcaseProps {
  player: PlayerStats;
  nowMs?: number;
  variant?: 'compact' | 'full';
  onInspectAll?: () => void;
}

const MEDAL_THEME: Record<
  HonorMedalId,
  { accent: string; ring: string; bg: string; glyph: 'anvil' | 'bolt' | 'fist' | 'leaf' | 'pillar' | 'storm' }
> = {
  medal_titan_bench: {
    accent: 'text-orange-400',
    ring: 'border-orange-500/45',
    bg: 'bg-orange-500/12',
    glyph: 'anvil',
  },
  medal_mach_sprint: {
    accent: 'text-sky-400',
    ring: 'border-sky-400/45',
    bg: 'bg-sky-500/12',
    glyph: 'bolt',
  },
  medal_ko_precision: {
    accent: 'text-rose-400',
    ring: 'border-rose-500/45',
    bg: 'bg-rose-500/12',
    glyph: 'fist',
  },
  medal_zero_junk: {
    accent: 'text-emerald-400',
    ring: 'border-emerald-500/45',
    bg: 'bg-emerald-500/12',
    glyph: 'leaf',
  },
  medal_iron_legs: {
    accent: 'text-amber-300',
    ring: 'border-amber-400/45',
    bg: 'bg-amber-500/12',
    glyph: 'pillar',
  },
  medal_cardio_storm: {
    accent: 'text-violet-300',
    ring: 'border-violet-400/45',
    bg: 'bg-violet-500/12',
    glyph: 'storm',
  },
};

export const HonorMedalCrest: React.FC<{
  medalId: HonorMedalId;
  unlocked: boolean;
  active?: boolean;
  size?: 'sm' | 'md';
}> = ({ medalId, unlocked, active = false, size = 'sm' }) => {
  const theme = MEDAL_THEME[medalId];
  const dim = size === 'md' ? 'w-11 h-11' : 'w-9 h-9';

  return (
    <svg
      viewBox="0 0 44 48"
      className={`${dim} shrink-0 transition-transform duration-200 ${
        unlocked ? 'drop-shadow-[0_4px_12px_rgba(255,90,31,0.28)]' : 'opacity-40'
      }`}
      aria-hidden="true"
    >
      {/* Ribbon top */}
      <path
        d="M12 2h7l3 7h-7L12 2zm13 0h7l-3 7h-7l3-7z"
        fill={unlocked ? (active ? '#10B981' : '#FF5A1F') : '#2A2A2E'}
      />
      {/* Shield crest */}
      <path
        d="M22 8l14 5.5V26c0 9.2-6.1 15.8-14 19-7.9-3.2-14-9.8-14-19V13.5L22 8z"
        fill={unlocked ? '#1B1B1F' : '#111114'}
        stroke={unlocked ? (active ? '#34D399' : '#FBBF24') : '#383840'}
        strokeWidth="2.2"
      />
      <path
        d="M22 12l10 4v9.5c0 6.8-4.3 11.9-10 14.4-5.7-2.5-10-7.6-10-14.4V16l10-4z"
        fill={unlocked ? 'rgba(255,255,255,0.04)' : 'none'}
        stroke={unlocked ? 'rgba(251,191,36,0.35)' : '#26262C'}
        strokeWidth="1"
      />

      {/* Inner Emblem Glyph */}
      {theme.glyph === 'anvil' && (
        <path
          d="M14 23h16v3h-16v-3zm2.5-3h2.5v9h-2.5v-9zm8.5 0h2.5v9H25v-9z"
          fill={unlocked ? '#FB923C' : '#52525B'}
        />
      )}
      {theme.glyph === 'bolt' && (
        <path
          d="M23.5 16L16.5 26h5l-1 7 7-10h-5l1-7z"
          fill={unlocked ? '#38BDF8' : '#52525B'}
        />
      )}
      {theme.glyph === 'fist' && (
        <path
          d="M17 20h10v8a3 3 0 01-3 3h-4a3 3 0 01-3-3v-8zm1-2h2v2h-2v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2z"
          fill={unlocked ? '#FB7185' : '#52525B'}
        />
      )}
      {theme.glyph === 'leaf' && (
        <path
          d="M28 17c-6.5.4-11 4.5-11 10.5 0 1.4.4 2.7 1.1 3.7l6.2-6.2 1.4 1.4-6.1 6.1c1.2.4 2.6.5 4 .2 4.6-.9 7.6-5.7 7.4-11.7L28 17z"
          fill={unlocked ? '#34D399' : '#52525B'}
        />
      )}
      {theme.glyph === 'pillar' && (
        <path
          d="M16 18h12v2.5H16V18zm2 3.5h2.5v8.5H18v-8.5zm5.5 0H26v8.5h-2.5v-8.5zM16 31h12v2H16v-2z"
          fill={unlocked ? '#FCD34D' : '#52525B'}
        />
      )}
      {theme.glyph === 'storm' && (
        <path
          d="M15 24c2.5-3.2 5.2-3.2 7.5 0s4.5 3.2 6.5 0v3.2c-2.2 2.8-4.8 2.8-7-.2-2-2.6-4.4-2.6-7 .2V24zm0-5c2.5-2.8 5.2-2.8 7.5 0s4.5 2.8 6.5 0v2.5c-2.2 2.4-4.8 2.4-7-.2-2-2.2-4.4-2.2-7 .2V19z"
          fill={unlocked ? '#C4B5FD' : '#52525B'}
        />
      )}
    </svg>
  );
};

export const HonorMedalsShowcase: React.FC<HonorMedalsShowcaseProps> = ({
  player,
  nowMs = Date.now(),
  variant = 'compact',
  onInspectAll,
}) => {
  const [selectedMedalId, setSelectedMedalId] = useState<HonorMedalId | null>(null);

  const unlockedMap = player.honorMedals ?? {};
  const activeModifiers = getActiveHonorModifiers(player.activeHonorModifiers, nowMs);
  const aggregated = aggregateHonorBonuses(activeModifiers);
  const unlockedCount = HONOR_MEDALS.filter((m) => Boolean(unlockedMap[m.id])).length;

  const selectedDef = selectedMedalId
    ? HONOR_MEDALS.find((m) => m.id === selectedMedalId) ?? null
    : null;
  const selectedUnlock = selectedMedalId ? unlockedMap[selectedMedalId] : undefined;
  const selectedActive = selectedMedalId
    ? activeModifiers.find((a) => a.medalId === selectedMedalId)
    : undefined;

  if (variant === 'compact') {
    return (
      <div className="mt-4 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-semibold text-white/60">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Medallas de Honor
            <span className="font-mono-tabular text-white/45 ml-1">
              {unlockedCount}/{HONOR_MEDALS.length}
            </span>
          </div>
          {onInspectAll && (
            <button
              type="button"
              onClick={onInspectAll}
              className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 cursor-pointer whitespace-nowrap"
            >
              Ver retos →
            </button>
          )}
        </div>

        {/* 6 Honor Medal Crests */}
        <div className="grid grid-cols-6 gap-1.5">
          {HONOR_MEDALS.map((medal) => {
            const record = unlockedMap[medal.id];
            const active = activeModifiers.some((a) => a.medalId === medal.id);
            const selected = selectedMedalId === medal.id;
            const theme = MEDAL_THEME[medal.id];

            return (
              <button
                key={medal.id}
                type="button"
                onClick={() =>
                  setSelectedMedalId((prev) => (prev === medal.id ? null : medal.id))
                }
                title={`${medal.title} · ${medal.challengeText}`}
                className={`relative rounded-xl p-1.5 border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  selected
                    ? 'bg-white/[0.1] border-amber-400/70'
                    : active
                    ? 'bg-emerald-500/[0.1] border-emerald-400/50 hover:border-emerald-300'
                    : record
                    ? `${theme.bg} ${theme.ring} hover:brightness-110`
                    : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20'
                }`}
              >
                <HonorMedalCrest
                  medalId={medal.id}
                  unlocked={Boolean(record)}
                  active={active}
                  size="sm"
                />
                {active && (
                  <span className="mt-0.5 text-[9px] font-mono-tabular font-bold text-emerald-300 leading-none">
                    ACT
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Medal Details */}
        {selectedDef && (
          <div className="mt-2.5 rounded-xl bg-white/[0.04] border border-white/[0.09] px-3 py-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display uppercase font-bold tracking-wide text-white">
                {selectedDef.title}
              </span>
              <span className="font-mono-tabular text-[11px] text-amber-300">
                {selectedUnlock
                  ? `Obtenida ×${selectedUnlock.timesEarned}`
                  : 'Bloqueada'}
              </span>
            </div>
            <div className="text-[11px] text-white/60 mt-1">
              Reto: <span className="text-white/85">{selectedDef.challengeText}</span> ({selectedDef.subtitle})
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
              Pasiva ({selectedDef.durationMin}m): {selectedDef.effectSummary}
              {selectedActive ? ` · Quedan ${formatRemainingTime(selectedActive.expiresAt, nowMs)}` : ''}
            </div>
          </div>
        )}

        {/* Active Timed Passive Modifiers */}
        {activeModifiers.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-emerald-300 font-semibold">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Modificadores de Honor Activos
              </span>
              {aggregated.energyDiscountPct > 0 && (
                <span className="font-mono-tabular text-sky-300">
                  -{Math.round(aggregated.energyDiscountPct * 100)}% EN
                </span>
              )}
            </div>
            {activeModifiers.map((mod) => (
              <div
                key={mod.medalId}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{mod.modifierName}</div>
                  <div className="text-emerald-300/90 truncate">{mod.effectSummary}</div>
                </div>
                <span className="font-mono-tabular font-bold text-white shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {formatRemainingTime(mod.expiresAt, nowMs)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full gallery variant (ProgressDashboard)
  return (
    <div className="fc-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Medallas de Honor ({unlockedCount} / {HONOR_MEDALS.length})
          </h3>
          <p className="text-xs text-white/55 mt-0.5">
            Supera retos extremos en minijuegos para grabar medallas en tu perfil y activar modificadores pasivos temporales. Repetir una hazaña reactiva su duración.
          </p>
        </div>

        {activeModifiers.length > 0 && (
          <div className="text-right text-xs">
            <div className="text-emerald-400 font-semibold">
              {activeModifiers.length}{' '}
              {activeModifiers.length === 1 ? 'modificador activo' : 'modificadores activos'}
            </div>
            <div className="font-mono-tabular text-white/70 mt-0.5">
              {aggregated.muscleMult > 1 && `+${Math.round((aggregated.muscleMult - 1) * 100)}% Músc · `}
              {aggregated.fatBurnMult > 1 && `+${Math.round((aggregated.fatBurnMult - 1) * 100)}% Grasa · `}
              {aggregated.coinMult > 1 && `+${Math.round((aggregated.coinMult - 1) * 100)}% Mon · `}
              {aggregated.xpMult > 1 && `+${Math.round((aggregated.xpMult - 1) * 100)}% XP · `}
              {aggregated.energyDiscountPct > 0 && `-${Math.round(aggregated.energyDiscountPct * 100)}% Energía`}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {HONOR_MEDALS.map((medal) => {
          const record = unlockedMap[medal.id];
          const activeMod = activeModifiers.find((m) => m.medalId === medal.id);
          const theme = MEDAL_THEME[medal.id];
          const remainingPct = activeMod
            ? Math.max(
                4,
                Math.min(
                  100,
                  Math.round(
                    ((activeMod.expiresAt - nowMs) / (activeMod.durationMin * 60000)) * 100
                  )
                )
              )
            : 0;

          return (
            <div
              key={medal.id}
              className={`border rounded-xl p-5 flex flex-col justify-between transition-colors ${
                activeMod
                  ? 'bg-emerald-500/10 border-emerald-400/45'
                  : record
                  ? `${theme.bg} ${theme.ring}`
                  : 'bg-[#141414] border-white/10'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <HonorMedalCrest
                      medalId={medal.id}
                      unlocked={Boolean(record)}
                      active={Boolean(activeMod)}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] text-white/55">
                        {medal.tierLabel} · {medal.subtitle}
                      </div>
                      <h4 className="font-display uppercase italic font-black text-xl leading-tight text-white truncate mt-0.5">
                        {medal.title}
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-white/75">
                  <span className="text-white/45">Reto extremo: </span>
                  <strong className="text-white font-semibold">{medal.challengeText}</strong>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.08]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold ${activeMod ? 'text-emerald-300' : theme.accent}`}>
                    {medal.modifierName}
                  </span>
                  <span className="font-mono-tabular text-[11px] text-white/55 shrink-0">
                    {activeMod
                      ? `${formatRemainingTime(activeMod.expiresAt, nowMs)}`
                      : `${medal.durationMin} min`}
                  </span>
                </div>
                <div className="text-[11px] text-white/65 mt-0.5">{medal.effectSummary}</div>

                {activeMod ? (
                  <div className="mt-2.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${remainingPct}%` }}
                    />
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono-tabular text-white/45">
                    <span>
                      {record
                        ? `Obtenida ×${record.timesEarned} · Marca ${record.bestScore.toLocaleString('es-ES')}`
                        : 'Sin desbloquear'}
                    </span>
                    <span>{record ? `Desde ${record.unlockedAt}` : 'Pendiente'}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
