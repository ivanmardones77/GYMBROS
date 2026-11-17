import React, { useState } from 'react';
import { MEALS } from '../data/gameData';
import { MealItem, PlayerStats } from '../types/game';
import { Utensils, Droplets, Flame, Zap } from 'lucide-react';
import mealPrep from '../assets/images/healthy_meal_prep_1794945942868.jpg';

interface NutritionPanelProps {
  player: PlayerStats;
  onEatMeal: (meal: MealItem) => void;
  onStartMacroGame: () => void;
}

export const NutritionPanel: React.FC<NutritionPanelProps> = ({
  player,
  onEatMeal,
  onStartMacroGame,
}) => {
  const [filter, setFilter] = useState<'Todas' | 'Equilibrada' | 'Proteína' | 'Hidratación' | 'Antojo'>('Todas');
  const [imgError, setImgError] = useState(false);

  const filteredMeals = filter === 'Todas' ? MEALS : MEALS.filter((m) => m.category === filter);
  const proteinPct = Math.min(100, Math.round((player.proteinToday / player.proteinGoal) * 100));

  return (
    <div className="space-y-8">
      {/* Top Split: Meal Prep Photo + Daily Macro Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 fc-card overflow-hidden flex flex-col">
          <div className="relative h-52 bg-white/[0.06]">
            {!imgError ? (
              <img
                src={mealPrep}
                alt="Preparación de comidas saludables para atletas"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-white/[0.04] flex flex-col items-center justify-center p-6 text-center">
                <Utensils className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="text-sm font-semibold text-white/75">Cocina GYMBROS</span>
              </div>
            )}
          </div>
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <p className="text-xs text-white/50">Nutrición Estratégica · Rendimiento</p>
              <h2 className="text-2xl font-bold text-white mt-1">
                Combustible para tu Transformación
              </h2>
              <p className="text-sm text-white/60 mt-2">
                Cada comida limpia recarga tu energía, protege tu masa muscular y potencia tus resultados en los minijuegos.
              </p>
            </div>
            <button
              onClick={onStartMacroGame}
              className="mt-4 w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Jugar Plato Fit Express (+Monedas y Proteína)
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 fc-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-xl font-bold text-white">Balance Nutricional de Hoy</h3>
                <p className="text-xs text-white/50">
                  Comidas saludables hoy: <span className="font-mono-tabular font-semibold text-white/90">{player.healthyMealsToday}</span>
                </p>
              </div>
              {player.activeBuff && (
                <div className="text-xs font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-3 py-1.5 rounded-lg">
                  Buff activo: {player.activeBuff.label} ({player.activeBuff.sessionsLeft} ses.)
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Energy Meter */}
              <div className="p-4 bg-white/[0.03] rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Zap className="w-4 h-4 text-orange-500" /> Energía Disponible
                  </span>
                  <span className="font-mono-tabular font-bold text-white">
                    {player.energy} / {player.maxEnergy}
                  </span>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (player.energy / player.maxEnergy) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Hydration Meter */}
              <div className="p-4 bg-white/[0.03] rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Droplets className="w-4 h-4 text-sky-400" /> Hidratación Celular
                  </span>
                  <span className="font-mono-tabular font-bold text-white">
                    {player.hydrationPct}%
                  </span>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, player.hydrationPct)}%` }}
                  />
                </div>
              </div>

              {/* Protein Goal */}
              <div className="p-4 bg-white/[0.03] rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                  <span className="font-medium">Proteína Diaria</span>
                  <span className="font-mono-tabular font-bold text-white">
                    {player.proteinToday}g / {player.proteinGoal}g
                  </span>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${proteinPct}%` }}
                  />
                </div>
              </div>

              {/* Macros summary */}
              <div className="p-4 bg-white/[0.03] rounded-lg border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/50">Carbohidratos</div>
                  <div className="text-lg font-bold font-mono-tabular text-white">{player.carbsToday}g</div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-xs text-white/50">Grasas</div>
                  <div className="text-lg font-bold font-mono-tabular text-white">{player.fatToday}g</div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-xs text-white/50">Monedas</div>
                  <div className="text-lg font-bold font-mono-tabular text-amber-400">{player.coins}</div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-white/50 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            Consejo del Coach: evita los antojos azucarados si quieres reducir tu porcentaje de grasa más rápido.
          </p>
        </div>
      </div>

      {/* Meal Catalog */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-2xl font-bold text-white">Carta de Comidas y Suplementos</h3>

          <div className="flex items-center gap-1 p-1 bg-white/10 rounded-lg overflow-x-auto">
            {(['Todas', 'Equilibrada', 'Proteína', 'Hidratación', 'Antojo'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === cat
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
          {filteredMeals.map((meal) => {
            const canAfford = player.coins >= meal.costCoins;
            const isCheat = meal.category === 'Antojo';

            return (
              <div
                key={meal.id}
                className="fc-card p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs text-white/50">
                    {meal.category} · {meal.calories} kcal · {meal.protein}g proteína
                  </div>
                  <h4 className="font-display uppercase italic font-black text-xl leading-tight text-white mt-1">{meal.name}</h4>
                  <p className="text-sm text-white/60 mt-1.5">{meal.description}</p>

                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono-tabular">
                    <span className="text-emerald-400 font-semibold">+{meal.energyRestore} Energía</span>
                    {meal.hydrationGain !== 0 && (
                      <span className={meal.hydrationGain > 0 ? 'text-sky-400' : 'text-rose-400'}>
                        {meal.hydrationGain > 0 ? `+${meal.hydrationGain}%` : `${meal.hydrationGain}%`} Agua
                      </span>
                    )}
                    <span className={isCheat ? 'text-rose-400 font-semibold' : 'text-white/60'}>
                      {meal.fatImpactPct > 0 ? `+${meal.fatImpactPct}%` : `${meal.fatImpactPct}%`} Grasa
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onEatMeal(meal)}
                  disabled={!canAfford}
                  className={`mt-4 w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    isCheat
                      ? 'bg-white/[0.06] hover:bg-white/15 text-white/90'
                      : 'bg-white hover:bg-white/85 text-black'
                  }`}
                >
                  Preparar · {meal.costCoins} Monedas
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
