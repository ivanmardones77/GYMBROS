import React, { useState } from 'react';
import {
  Achievement,
  PlayerStats,
  ProgressPoint,
  WorkoutHistoryEntry,
} from '../types/game';
import { ACHIEVEMENTS, MINIGAMES, getPhysiqueStage } from '../data/gameData';
import { Athlete3DViewer } from './Athlete3DViewer';
import { Award, CheckCircle2, TrendingUp, Trophy } from 'lucide-react';

interface ProgressDashboardProps {
  player: PlayerStats;
  history: ProgressPoint[];
  workouts: WorkoutHistoryEntry[];
  unlockedAchievementIds: string[];
  aiAthlete?: boolean;
  onChangeAiAthlete?: (ai: boolean) => void;
}

type MetricKey = 'fitnessScore' | 'weightKg' | 'bodyFatPct' | 'muscleKg';

const METRIC_META: Record<
  MetricKey,
  { label: string; unit: string; color: string; goodDirection: 'up' | 'down' }
> = {
  fitnessScore: { label: 'Forma Física', unit: 'pts', color: '#EA580C', goodDirection: 'up' },
  weightKg: { label: 'Peso Corporal', unit: 'kg', color: '#0284C7', goodDirection: 'down' },
  bodyFatPct: { label: 'Grasa Corporal', unit: '%', color: '#E11D48', goodDirection: 'down' },
  muscleKg: { label: 'Masa Muscular', unit: 'kg', color: '#059669', goodDirection: 'up' },
};

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  player,
  history,
  workouts,
  unlockedAchievementIds,
  aiAthlete = true,
  onChangeAiAthlete,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('fitnessScore');
  const [achFilter, setAchFilter] = useState<'Todos' | Achievement['category']>('Todos');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [compareView, setCompareView] = useState<'now' | 'before'>('now');

  const meta = METRIC_META[selectedMetric];
  const points = history.length > 0 ? history : [];
  const values = points.map((p) => p[selectedMetric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const pad = Math.max(2, (maxVal - minVal) * 0.25);
  const yMin = Math.max(0, minVal - pad);
  const yMax = maxVal + pad;
  const span = Math.max(1, yMax - yMin);

  const svgW = 640;
  const svgH = 220;
  const padX = 36;
  const padY = 24;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;

  const coords = points.map((pt, idx) => {
    const x = points.length === 1 ? padX + plotW / 2 : padX + (idx / (points.length - 1)) * plotW;
    const norm = (pt[selectedMetric] - yMin) / span;
    const y = padY + plotH - norm * plotH;
    return { x, y, pt };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPoints =
    coords.length > 0
      ? `${coords[0].x},${padY + plotH} ${polylinePoints} ${coords[coords.length - 1].x},${padY + plotH}`
      : '';

  const getMetricValue = (key: Achievement['metricKey']): number => {
    switch (key) {
      case 'totalWorkouts':
        return player.totalWorkouts;
      case 'fitnessScore':
        return player.fitnessScore;
      case 'muscleGainTotal':
        return Math.max(0, Number((player.muscleKg - player.startMuscleKg).toFixed(1)));
      case 'fatLossTotal':
        return Math.max(0, Number((player.startBodyFatPct - player.bodyFatPct).toFixed(1)));
      case 'perfectHitsTotal':
        return player.perfectHitsTotal;
      case 'healthyMealsToday':
        return player.healthyMealsToday;
      case 'weeklyScore':
        return player.weeklyScore;
      case 'duelsWon':
        return player.duelsWon;
      case 'streakDays':
        return player.streakDays;
      case 'level':
        return player.level;
    }
  };

  const filteredAchievements =
    achFilter === 'Todos'
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter((a) => a.category === achFilter);

  const weightDelta = (player.weightKg - player.startWeightKg).toFixed(1);
  const fatDelta = (player.bodyFatPct - player.startBodyFatPct).toFixed(1);
  const muscleDelta = (player.muscleKg - player.startMuscleKg).toFixed(1);

  return (
    <div className="space-y-8">
      {/* Section 1: Visual Transformation Chart + Before/Now Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 fc-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  Tabla de Progreso Visual
                </h2>
                <p className="text-xs text-white/50">
                  Evolución biométrica por sesión · Toca un punto para ver el detalle
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-white/[0.06] rounded-lg overflow-x-auto">
                {(Object.keys(METRIC_META) as MetricKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedMetric(key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedMetric === key
                        ? 'bg-[#141414] text-white shadow-none'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {METRIC_META[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive SVG Chart */}
            <div className="mt-5 relative">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-56 overflow-visible">
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const y = padY + plotH - t * plotH;
                  const val = (yMin + t * span).toFixed(1);
                  return (
                    <g key={t}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={svgW - padX}
                        y2={y}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                      />
                      <text
                        x={padX - 8}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fill="#94A3B8"
                        className="font-mono-tabular"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Area fill */}
                {coords.length > 1 && (
                  <polygon points={areaPoints} fill={meta.color} fillOpacity="0.14" />
                )}

                {/* Line */}
                {coords.length > 1 && (
                  <polyline
                    fill="none"
                    stroke={meta.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylinePoints}
                  />
                )}

                {/* Points */}
                {coords.map((c, idx) => {
                  const showXLabel =
                    coords.length <= 6 ||
                    idx === 0 ||
                    idx === coords.length - 1 ||
                    idx % 2 === 0;
                  const shortLabel = c.pt.label.replace(/^Sesión\s+/i, 'S');
                  return (
                    <g
                      key={c.pt.id}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      onClick={() => setHoveredIdx(idx)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={hoveredIdx === idx ? 7 : 5}
                        fill="#FFFFFF"
                        stroke={meta.color}
                        strokeWidth="3"
                      />
                      {showXLabel && (
                        <text
                          x={c.x}
                          y={svgH - 4}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#94A3B8"
                        >
                          {shortLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Selected/Hovered point readout */}
              <div className="mt-2 h-8 flex items-center justify-between px-3 bg-white/[0.03] border border-white/10 rounded-lg text-xs">
                {hoveredIdx !== null && coords[hoveredIdx] ? (
                  <>
                    <span className="font-semibold text-white/75">
                      {coords[hoveredIdx].pt.label}
                    </span>
                    <span className="font-mono-tabular font-bold text-white">
                      {coords[hoveredIdx].pt[selectedMetric].toFixed(1)} {meta.unit} ·{' '}
                      {coords[hoveredIdx].pt.caloriesBurned} kcal quemadas
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-white/50">Último registro</span>
                    <span className="font-mono-tabular font-bold text-white">
                      {player[selectedMetric].toFixed(1)} {meta.unit}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Before vs. Current Physical Transformation */}
        <div className="lg:col-span-4 fc-card p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-white/50">Comparativa 3D</p>
              <h3 className="text-xl font-bold text-white mt-0.5">Antes vs. Ahora</h3>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-white/[0.06] rounded-lg">
              <button
                onClick={() => setCompareView('before')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                  compareView === 'before' ? 'bg-[#141414] text-white shadow-none' : 'text-white/60'
                }`}
              >
                Día 1
              </button>
              <button
                onClick={() => setCompareView('now')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                  compareView === 'now' ? 'bg-orange-500 text-white shadow-none' : 'text-white/60'
                }`}
              >
                Actual
              </button>
            </div>
          </div>

          <div className="my-4 relative">
            <Athlete3DViewer
              gender={player.gender}
              fitnessScore={compareView === 'before' ? 14 : player.fitnessScore}
              skinTone={player.skinTone}
              hairColor={player.hairColor}
              outfit={compareView === 'before' ? 'basic' : player.activeOutfit}
              hasBuff={compareView === 'now' && Boolean(player.activeBuff)}
              pose={compareView === 'before' ? 'tired' : player.fitnessScore >= 50 ? 'flex' : 'idle'}
              interactive={true}
              showPoseControls={compareView === 'now'}
              aiModel={aiAthlete}
              kineticMode={
                compareView === 'now' && player.completedRoutinesToday.length > 0
                  ? 'routine'
                  : 'none'
              }
              className="w-full h-56"
            />
            {onChangeAiAthlete && (
              <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 p-0.5 bg-black/80 rounded-lg border border-white/10">
                {[
                  { label: 'Clásico', v: false },
                  { label: 'Realista', v: true },
                ].map((b) => (
                  <button
                    key={b.label}
                    onClick={() => onChangeAiAthlete(b.v)}
                    className={`px-2 py-1 text-[10px] font-display uppercase font-bold tracking-wider rounded-md cursor-pointer ${
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
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={compareView === 'before' ? 'font-semibold text-white/60' : 'font-bold text-orange-500'}>
                {compareView === 'before' ? 'Inicio · Fuera de Forma' : getPhysiqueStage(player.fitnessScore)}
              </span>
              <span className="font-mono-tabular font-bold text-white">
                {(compareView === 'before' ? player.startWeightKg : player.weightKg).toFixed(1)} kg
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center border-t border-white/[0.06] pt-3">
            <div>
              <div className="text-[11px] text-white/50">Peso</div>
              <div className="text-sm font-bold font-mono-tabular text-white">
                {Number(weightDelta) > 0 ? `+${weightDelta}` : weightDelta} kg
              </div>
            </div>
            <div>
              <div className="text-[11px] text-white/50">Grasa</div>
              <div className="text-sm font-bold font-mono-tabular text-rose-400">
                {Number(fatDelta) > 0 ? `+${fatDelta}` : fatDelta}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-white/50">Músculo</div>
              <div className="text-sm font-bold font-mono-tabular text-emerald-400">
                +{muscleDelta} kg
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1.5: Personal Bests by Discipline */}
      <div className="fc-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Récords Personales por Disciplina
            </h3>
            <p className="text-xs text-white/50">
              Supera tu marca anterior en cualquier disciplina para ganar +25 monedas extra
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MINIGAMES.map((g) => {
            const pb = player.personalBests?.[g.id];
            return (
              <div
                key={g.id}
                className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-orange-400 font-semibold">
                    {g.category}
                  </span>
                  <span className="text-[11px] font-mono-tabular text-white/45">
                    {pb ? `${pb.plays} ses.` : 'Sin jugar'}
                  </span>
                </div>
                <div className="font-display uppercase italic font-black text-lg text-white mt-1 truncate">
                  {g.title}
                </div>
                {pb ? (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-[9px] uppercase text-white/40">Récord</div>
                      <div className="font-mono-tabular font-bold text-xs text-amber-400">
                        {pb.bestScore.toLocaleString('es-ES')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-white/40">Precisión</div>
                      <div className="font-mono-tabular font-bold text-xs text-emerald-400">
                        {pb.bestAccuracy}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-white/40">Combo</div>
                      <div className="font-mono-tabular font-bold text-xs text-white">
                        x{pb.bestCombo}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-[11px] text-white/40">
                    Completa una ronda para fijar tu marca
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Achievements System */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-500" />
              Sistema de Logros ({unlockedAchievementIds.length} / {ACHIEVEMENTS.length})
            </h3>
            <p className="text-xs text-white/50">
              Desbloquea medallas al mejorar tu físico, técnica y posición competitiva
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-white/10 rounded-lg overflow-x-auto">
            {(['Todos', 'Fuerza', 'Cardio', 'Nutrición', 'Competitivo'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setAchFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  achFilter === cat
                    ? 'bg-[#141414] text-white shadow-none'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map((ach) => {
            const unlocked = unlockedAchievementIds.includes(ach.id);
            const current = getMetricValue(ach.metricKey);
            const pct = Math.min(100, Math.round((current / ach.target) * 100));

            return (
              <div
                key={ach.id}
                className={`border rounded-xl p-5 flex flex-col justify-between transition-colors ${
                  unlocked
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-[#141414] border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">{ach.category}</span>
                    {unlocked ? (
                      <span className="flex items-center gap-1 font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Desbloqueado
                      </span>
                    ) : (
                      <span className="font-mono-tabular text-white/50">
                        {current} / {ach.target}
                      </span>
                    )}
                  </div>
                  <h4 className="font-display uppercase italic font-black text-xl leading-tight text-white mt-1">{ach.title}</h4>
                  <p className="text-xs text-white/60 mt-1">{ach.description}</p>
                </div>

                <div className="mt-4">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        unlocked ? 'bg-emerald-600' : 'bg-orange-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono-tabular text-white/50">
                    <span>Recompensa: +{ach.rewardCoins} monedas</span>
                    <span>+{ach.rewardXp} XP</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Recent Workout Sessions Table */}
      <div className="fc-card p-6">
        <h3 className="text-xl font-bold text-white mb-4">Registro de Sesiones Recientes</h3>
        {workouts.length === 0 ? (
          <p className="text-sm text-white/50 py-6 text-center">
            Aún no has completado entrenamientos. ¡Elige un minijuego en el Gimnasio para comenzar!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-white/50">
                  <th className="py-2.5 pr-4 font-semibold">Actividad</th>
                  <th className="py-2.5 px-4 font-semibold">Nivel</th>
                  <th className="py-2.5 px-4 font-semibold">Puntuación</th>
                  <th className="py-2.5 px-4 font-semibold">Precisión</th>
                  <th className="py-2.5 px-4 font-semibold">Calorías</th>
                  <th className="py-2.5 pl-4 font-semibold text-right">Impacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {workouts.slice(0, 8).map((w) => (
                  <tr key={w.id} className="hover:bg-white/[0.03]">
                    <td className="py-3 pr-4 font-medium text-white">
                      {w.gameTitle}
                      <span className="block text-xs text-white/50 font-normal">{w.timestamp}</span>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-white/60">Nv. {w.difficulty}</td>
                    <td className="py-3 px-4 font-mono-tabular font-semibold text-white">
                      {w.score.toLocaleString('es-ES')}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-white/60">{w.accuracyPct}%</td>
                    <td className="py-3 px-4 font-mono-tabular text-orange-400">{w.caloriesBurned} kcal</td>
                    <td className="py-3 pl-4 font-mono-tabular text-right text-emerald-400 font-medium">
                      +{w.muscleGain.toFixed(2)}kg músc · -{w.fatLossPct.toFixed(2)}% grasa
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
