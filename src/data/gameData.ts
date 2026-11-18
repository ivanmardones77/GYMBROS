import {
  Achievement,
  DifficultyLevel,
  Gender,
  MealItem,
  MinigameId,
  MultiplayerRival,
  OutfitId,
  PhysiqueStage,
  PlayerStats,
  RoutineProgram,
} from '../types/game';

export const DIFFICULTY_CONFIG: Record<
  DifficultyLevel,
  {
    label: string;
    unlockLevel: number;
    speedMult: number;
    windowMult: number;
    rewardMult: number;
    energyCost: number;
  }
> = {
  1: {
    label: 'Nivel 1 · Principiante',
    unlockLevel: 1,
    speedMult: 1.0,
    windowMult: 1.0,
    rewardMult: 1.0,
    energyCost: 15,
  },
  2: {
    label: 'Nivel 2 · Intermedio',
    unlockLevel: 2,
    speedMult: 1.25,
    windowMult: 0.86,
    rewardMult: 1.35,
    energyCost: 18,
  },
  3: {
    label: 'Nivel 3 · Avanzado',
    unlockLevel: 4,
    speedMult: 1.5,
    windowMult: 0.74,
    rewardMult: 1.75,
    energyCost: 22,
  },
  4: {
    label: 'Nivel 4 · Pro',
    unlockLevel: 6,
    speedMult: 1.78,
    windowMult: 0.62,
    rewardMult: 2.25,
    energyCost: 25,
  },
  5: {
    label: 'Nivel 5 · Leyenda',
    unlockLevel: 9,
    speedMult: 2.08,
    windowMult: 0.52,
    rewardMult: 3.0,
    energyCost: 28,
  },
};

export interface MinigameMeta {
  id: MinigameId;
  title: string;
  category: 'Fuerza' | 'Cardio' | 'Combate' | 'Nutrición';
  shortDesc: string;
  controlsHint: string;
  muscleFocus: string;
  baseCalories: number;
  baseMuscleGain: number;
  baseFatLoss: number;
}

export const MINIGAMES: MinigameMeta[] = [
  {
    id: 'bench',
    title: 'Press de Banca Explosivo',
    category: 'Fuerza',
    shortDesc: 'Detén la barra en la zona óptima para levantar discos más pesados y activar el Modo Bestia.',
    controlsHint: 'Pulsa Espacio o toca el botón en la zona verde',
    muscleFocus: '+Masa Muscular · +Fuerza',
    baseCalories: 145,
    baseMuscleGain: 0.42,
    baseFatLoss: 0.25,
  },
  {
    id: 'sprint',
    title: 'Sprint HIIT en Cinta',
    category: 'Cardio',
    shortDesc: 'Alterna zancadas a máxima velocidad y salta obstáculos para disparar la quema calórica.',
    controlsHint: 'A / D (o Izq / Der) para correr · Espacio / W para saltar',
    muscleFocus: '-Grasa Corporal · +Cardio',
    baseCalories: 230,
    baseMuscleGain: 0.16,
    baseFatLoss: 0.62,
  },
  {
    id: 'boxing',
    title: 'Combo Saco de Boxeo',
    category: 'Combate',
    shortDesc: 'Golpea los objetivos direccionales antes de que cierre el anillo para encadenar combos KO.',
    controlsHint: 'Toca los pads o usa Q, W, E, R al ritmo del anillo',
    muscleFocus: '+Agilidad · -Grasa Corporal',
    baseCalories: 195,
    baseMuscleGain: 0.26,
    baseFatLoss: 0.48,
  },
  {
    id: 'macros',
    title: 'Plato Fit Express',
    category: 'Nutrición',
    shortDesc: 'Atrapa ingredientes limpios y agua mientras esquivas comida chatarra a toda velocidad.',
    controlsHint: 'Flechas Izq/Der o toca los carriles para mover tu bowl',
    muscleFocus: '+Energía · +Proteína Gratis',
    baseCalories: 110,
    baseMuscleGain: 0.18,
    baseFatLoss: 0.35,
  },
  {
    id: 'squats',
    title: 'Sentadilla de Hierro',
    category: 'Fuerza',
    shortDesc: 'Mantén la bajada y suelta en la profundidad exacta para explotar con piernas de acero.',
    controlsHint: 'Mantén pulsado Espacio o la escena y suelta en la zona verde',
    muscleFocus: '+Masa Muscular · +Potencia',
    baseCalories: 165,
    baseMuscleGain: 0.48,
    baseFatLoss: 0.32,
  },
  {
    id: 'rope',
    title: 'Salto de Cuerda Turbo',
    category: 'Cardio',
    shortDesc: 'Sincroniza cada salto cuando el aro brille y encadena rachas en Modo Turbo.',
    controlsHint: 'Pulsa Espacio / W o toca el visor al pasar la cuerda',
    muscleFocus: '-Grasa Corporal · +Cardio',
    baseCalories: 245,
    baseMuscleGain: 0.19,
    baseFatLoss: 0.68,
  },
  {
    id: 'battle_ropes',
    title: 'Olas de Battle Ropes',
    category: 'Combate',
    shortDesc: 'Alterna azotes de alta frecuencia y lanza ondas dobles al llenar la barra de choque.',
    controlsHint: 'Alterna A / D (o Izq / Der) y pulsa Espacio para Doble Azote',
    muscleFocus: '+Agilidad · -Grasa Corporal',
    baseCalories: 225,
    baseMuscleGain: 0.30,
    baseFatLoss: 0.56,
  },
];

export const MEALS: MealItem[] = [
  {
    id: 'water_electrolytes',
    name: 'Agua con Electrolitos',
    category: 'Hidratación',
    calories: 10,
    protein: 0,
    carbs: 2,
    fat: 0,
    energyRestore: 18,
    hydrationGain: 35,
    fatImpactPct: -0.05,
    costCoins: 15,
    description: 'Hidrata tus fibras musculares y recupera energía ligera al instante.',
  },
  {
    id: 'whey_shake',
    name: 'Batido Proteico Doble',
    category: 'Proteína',
    calories: 210,
    protein: 36,
    carbs: 8,
    fat: 3,
    energyRestore: 32,
    hydrationGain: 15,
    fatImpactPct: -0.08,
    buff: {
      label: '+35% Ganancia Muscular',
      muscleMultiplier: 1.35,
      fatBurnMultiplier: 1.0,
      sessionsLeft: 2,
    },
    costCoins: 55,
    description: 'Síntesis proteica rápida. Aumenta un 35% la ganancia muscular en tus próximos 2 entrenamientos.',
  },
  {
    id: 'chicken_quinoa',
    name: 'Bowl de Pollo y Quinoa',
    category: 'Equilibrada',
    calories: 460,
    protein: 44,
    carbs: 48,
    fat: 10,
    energyRestore: 55,
    hydrationGain: 10,
    fatImpactPct: -0.12,
    buff: {
      label: '+25% Músculo y Quema',
      muscleMultiplier: 1.25,
      fatBurnMultiplier: 1.25,
      sessionsLeft: 2,
    },
    costCoins: 80,
    description: 'Comida completa de atleta. Recarga media barra de energía y optimiza tu metabolismo.',
  },
  {
    id: 'salmon_avocado',
    name: 'Salmón, Aguacate y Boniato',
    category: 'Equilibrada',
    calories: 520,
    protein: 40,
    carbs: 38,
    fat: 22,
    energyRestore: 75,
    hydrationGain: 12,
    fatImpactPct: -0.15,
    buff: {
      label: '+45% Potencia Metabólica',
      muscleMultiplier: 1.4,
      fatBurnMultiplier: 1.35,
      sessionsLeft: 3,
    },
    costCoins: 125,
    description: 'Omega-3 y proteína limpia para transformar tu físico en tiempo récord.',
  },
  {
    id: 'green_matcha_hiit',
    name: 'Té Verde + L-Carnitina',
    category: 'Hidratación',
    calories: 25,
    protein: 0,
    carbs: 4,
    fat: 0,
    energyRestore: 28,
    hydrationGain: 25,
    fatImpactPct: -0.18,
    buff: {
      label: '+50% Quema de Grasa',
      muscleMultiplier: 1.0,
      fatBurnMultiplier: 1.5,
      sessionsLeft: 2,
    },
    costCoins: 70,
    description: 'Pre-entreno termogénico diseñado para disparar la quema de grasa en Cardio y Boxeo.',
  },
  {
    id: 'cheat_donut',
    name: 'Dona Glaseada Triple',
    category: 'Antojo',
    calories: 490,
    protein: 4,
    carbs: 64,
    fat: 26,
    energyRestore: 45,
    hydrationGain: -10,
    fatImpactPct: 0.45,
    costCoins: 20,
    description: 'Energía rápida y barata, pero frena tu definición (+0.45% grasa corporal).',
  },
];

export const ROUTINES: RoutineProgram[] = [
  {
    id: 'routine_wake',
    title: 'Despertar Metabólico',
    subtitle: 'Cardio suave + Nutrición limpia para activar tu cuerpo.',
    levelRequired: 1,
    energyCost: 25,
    minigameOrder: ['sprint', 'macros'],
    recommendedDifficulty: 1,
    bonusCoins: 110,
    bonusMuscle: 0.4,
    bonusFatLoss: 0.8,
  },
  {
    id: 'routine_iron',
    title: 'Fuerza Base y Golpeo',
    subtitle: 'Combina empuje pesado con ráfagas explosivas al saco.',
    levelRequired: 2,
    energyCost: 34,
    minigameOrder: ['bench', 'boxing'],
    recommendedDifficulty: 2,
    bonusCoins: 185,
    bonusMuscle: 0.85,
    bonusFatLoss: 0.9,
  },
  {
    id: 'routine_shred',
    title: 'Circuito Quema-Grasa HIIT',
    subtitle: 'Tres estaciones seguidas para bajar de peso y marcar abdomen.',
    levelRequired: 4,
    energyCost: 48,
    minigameOrder: ['sprint', 'boxing', 'bench'],
    recommendedDifficulty: 3,
    bonusCoins: 320,
    bonusMuscle: 1.15,
    bonusFatLoss: 1.6,
  },
  {
    id: 'routine_athletic',
    title: 'Trilogía Funcional 3D',
    subtitle: 'Sentadillas explosivas, salto turbo y battle ropes sin descanso.',
    levelRequired: 3,
    energyCost: 42,
    minigameOrder: ['squats', 'rope', 'battle_ropes'],
    recommendedDifficulty: 2,
    bonusCoins: 265,
    bonusMuscle: 1.05,
    bonusFatLoss: 1.35,
  },
  {
    id: 'routine_titan',
    title: 'Protocolo Titán Élite',
    subtitle: 'Las disciplinas estrella al máximo nivel competitivo.',
    levelRequired: 7,
    energyCost: 60,
    minigameOrder: ['bench', 'squats', 'rope', 'battle_ropes'],
    recommendedDifficulty: 4,
    bonusCoins: 540,
    bonusMuscle: 1.85,
    bonusFatLoss: 2.3,
  },
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_first_sweat',
    title: 'Primera Gota de Sudor',
    description: 'Completa tu primer minijuego en el gimnasio.',
    category: 'Fuerza',
    metricKey: 'totalWorkouts',
    target: 1,
    rewardCoins: 75,
    rewardXp: 60,
  },
  {
    id: 'ach_habit_5',
    title: 'Constancia de Hierro',
    description: 'Completa 5 sesiones de entrenamiento.',
    category: 'Fuerza',
    metricKey: 'totalWorkouts',
    target: 5,
    rewardCoins: 150,
    rewardXp: 120,
  },
  {
    id: 'ach_machine_15',
    title: 'Máquina Imparable',
    description: 'Completa 15 sesiones de entrenamiento.',
    category: 'Cardio',
    metricKey: 'totalWorkouts',
    target: 15,
    rewardCoins: 350,
    rewardXp: 280,
  },
  {
    id: 'ach_fat_3',
    title: 'Adiós Sedentarismo',
    description: 'Reduce tu grasa corporal un 3% desde el inicio.',
    category: 'Cardio',
    metricKey: 'fatLossTotal',
    target: 3,
    rewardCoins: 180,
    rewardXp: 150,
  },
  {
    id: 'ach_fat_10',
    title: 'Definición Total',
    description: 'Reduce tu grasa corporal un 10% desde el inicio.',
    category: 'Cardio',
    metricKey: 'fatLossTotal',
    target: 10,
    rewardCoins: 450,
    rewardXp: 400,
  },
  {
    id: 'ach_muscle_3',
    title: 'Fibras de Acero',
    description: 'Gana 3 kg de masa muscular magra.',
    category: 'Fuerza',
    metricKey: 'muscleGainTotal',
    target: 3,
    rewardCoins: 200,
    rewardXp: 180,
  },
  {
    id: 'ach_muscle_8',
    title: 'Cuerpo Esculpido',
    description: 'Gana 8 kg de masa muscular magra.',
    category: 'Fuerza',
    metricKey: 'muscleGainTotal',
    target: 8,
    rewardCoins: 500,
    rewardXp: 450,
  },
  {
    id: 'ach_perfect_25',
    title: 'Técnica Quirúrgica',
    description: 'Consigue 25 impactos perfectos en minijuegos.',
    category: 'Fuerza',
    metricKey: 'perfectHitsTotal',
    target: 25,
    rewardCoins: 160,
    rewardXp: 140,
  },
  {
    id: 'ach_nutrition_3',
    title: 'Chef Fitness',
    description: 'Prepara 3 comidas saludables en el mismo día.',
    category: 'Nutrición',
    metricKey: 'healthyMealsToday',
    target: 3,
    rewardCoins: 120,
    rewardXp: 100,
  },
  {
    id: 'ach_score_50',
    title: 'Transformación Activa',
    description: 'Alcanza 50/100 en tu Puntuación de Forma Física.',
    category: 'Cardio',
    metricKey: 'fitnessScore',
    target: 50,
    rewardCoins: 280,
    rewardXp: 240,
  },
  {
    id: 'ach_weekly_2500',
    title: 'Aspirante al Podio',
    description: 'Acumula 2,500 pts en el Desafío Semanal Multijugador.',
    category: 'Competitivo',
    metricKey: 'weeklyScore',
    target: 2500,
    rewardCoins: 240,
    rewardXp: 200,
  },
  {
    id: 'ach_duel_1',
    title: 'Vencedor del Duelo',
    description: 'Supera a un rival en un Duelo Directo multijugador.',
    category: 'Competitivo',
    metricKey: 'duelsWon',
    target: 1,
    rewardCoins: 200,
    rewardXp: 180,
  },
];

export interface DailyRewardStep {
  day: number;
  title: string;
  rewardText: string;
  coins: number;
  energyBonus?: number;
  outfitUnlock?: OutfitId;
}

export const DAILY_REWARDS: DailyRewardStep[] = [
  { day: 1, title: 'Día 1', rewardText: '120 Monedas + Energía', coins: 120, energyBonus: 25 },
  { day: 2, title: 'Día 2', rewardText: '180 Monedas', coins: 180 },
  { day: 3, title: 'Día 3', rewardText: 'Equipación Runner Pro', coins: 100, outfitUnlock: 'runner' },
  { day: 4, title: 'Día 4', rewardText: '260 Monedas + Hidratación', coins: 260, energyBonus: 40 },
  { day: 5, title: 'Día 5', rewardText: 'Equipación Atleta Pro', coins: 150, outfitUnlock: 'pro' },
  { day: 6, title: 'Día 6', rewardText: '400 Monedas', coins: 400 },
  { day: 7, title: 'Día 7', rewardText: 'Conjunto Titan Oro + 650', coins: 650, outfitUnlock: 'titan', energyBonus: 100 },
];

export interface OutfitSpec {
  name: string;
  color: string;
  cost: number;
  perkLabel: string;
  energyBonus: number;
  muscleMult: number;
  fatMult: number;
  xpMult: number;
  coinMult: number;
}

export const OUTFITS: Record<OutfitId, OutfitSpec> = {
  basic: {
    name: 'Camiseta Básica',
    color: '#2B2B30',
    cost: 0,
    perkLabel: 'Estándar · Sin bonos',
    energyBonus: 0,
    muscleMult: 1.0,
    fatMult: 1.0,
    xpMult: 1.0,
    coinMult: 1.0,
  },
  runner: {
    name: 'Runner Azul',
    color: '#0284C7',
    cost: 220,
    perkLabel: '+10 Energía · +15% Quema · +5% XP',
    energyBonus: 10,
    muscleMult: 1.0,
    fatMult: 1.15,
    xpMult: 1.05,
    coinMult: 1.0,
  },
  pro: {
    name: 'Élite Esmeralda',
    color: '#059669',
    cost: 420,
    perkLabel: '+15 Energía · +15% Músculo · +10% XP',
    energyBonus: 15,
    muscleMult: 1.15,
    fatMult: 1.1,
    xpMult: 1.1,
    coinMult: 1.08,
  },
  titan: {
    name: 'Titan Dorado',
    color: '#FF5A1F',
    cost: 750,
    perkLabel: '+25 Energía · +25% Físico · +20% Premios',
    energyBonus: 25,
    muscleMult: 1.25,
    fatMult: 1.25,
    xpMult: 1.2,
    coinMult: 1.2,
  },
};

export const INITIAL_RIVALS: MultiplayerRival[] = [
  { id: 'r1', name: 'Lucía Vega', club: 'Madrid Iron', gender: 'female', weeklyScore: 4820, fitnessScore: 84, streak: 12 },
  { id: 'r2', name: 'Mateo Silva', club: 'Club Pacífico', gender: 'male', weeklyScore: 3950, fitnessScore: 76, streak: 9 },
  { id: 'r3', name: 'Valeria Cruz', club: 'Titanes Norte', gender: 'female', weeklyScore: 3120, fitnessScore: 68, streak: 7 },
  { id: 'r4', name: 'Diego Morales', club: 'Arena Sur', gender: 'male', weeklyScore: 2240, fitnessScore: 54, streak: 5 },
  { id: 'r5', name: 'Camila Rojas', club: 'CrossFit Sol', gender: 'female', weeklyScore: 1480, fitnessScore: 42, streak: 4 },
  { id: 'r6', name: 'Bruno Navarro', club: 'Gimnasio Central', gender: 'male', weeklyScore: 790, fitnessScore: 29, streak: 2 },
];

export const MOTIVATIONAL_PUSH_POOL = [
  {
    title: 'Coach GYMBROS',
    body: 'Tu mejor versión no se construye sola. ¡Haz una serie de Press de Banca de 30 segundos ahora!',
    category: 'Motivación' as const,
  },
  {
    title: 'Alerta de Hidratación',
    body: 'Bebe agua con electrolitos para evitar fatiga y acelerar la recuperación muscular.',
    category: 'Nutrición' as const,
  },
  {
    title: 'Desafío Semanal Activo',
    body: 'Bruno y Camila acaban de sumar puntos en la tabla. ¡Un Sprint HIIT te hará subir puestos!',
    category: 'Desafío' as const,
  },
  {
    title: 'Proteína Post-Entreno',
    body: 'Combina un Batido Proteico antes de entrenar para ganar +35% de masa muscular.',
    category: 'Nutrición' as const,
  },
  {
    title: 'Racha en Juego',
    body: 'Reclama tus Recompensas Diarias y desbloquea equipación exclusiva para tu atleta.',
    category: 'Recompensa' as const,
  },
];

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayDiff(fromDateKey: string, toDateKey: string): number {
  const a = new Date(`${fromDateKey}T00:00:00`).getTime();
  const b = new Date(`${toDateKey}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function getIsoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getTimeUntilSundayReset(now = new Date()): string {
  const day = now.getDay(); // 0 = Sun
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const reset = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysUntilSunday,
    23,
    59,
    59
  );
  const diffMs = Math.max(0, reset.getTime() - now.getTime());
  const totalHours = Math.floor(diffMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
}

export function computeRivalDuelTarget(
  rival: Pick<MultiplayerRival, 'fitnessScore' | 'weeklyScore'>,
  difficulty: DifficultyLevel
): number {
  const fitnessFactor = Math.round(rival.fitnessScore * 11);
  const diffFactor = Math.round(difficulty * 235);
  return Math.max(850, 620 + fitnessFactor + diffFactor);
}

export function applyXpAndLevelUp(
  xp: number,
  level: number,
  xpToNext: number,
  gainedXp: number
): { xp: number; level: number; xpToNext: number; leveledUp: boolean } {
  let nextXp = xp + gainedXp;
  let nextLevel = level;
  let nextXpToNext = xpToNext;
  let leveledUp = false;
  while (nextXp >= nextXpToNext) {
    nextXp -= nextXpToNext;
    nextLevel += 1;
    nextXpToNext = Math.round(nextXpToNext * 1.28);
    leveledUp = true;
  }
  return { xp: nextXp, level: nextLevel, xpToNext: nextXpToNext, leveledUp };
}

export function getPhysiqueStage(fitnessScore: number): PhysiqueStage {
  if (fitnessScore < 28) return 'Fuera de Forma';
  if (fitnessScore < 46) return 'Principiante Activo';
  if (fitnessScore < 66) return 'Tonificado';
  if (fitnessScore < 85) return 'Atlético';
  return 'Físico Élite';
}

export function createInitialPlayer(
  name: string,
  gender: Gender,
  skinTone = '#E8B896',
  hairColor = '#1E293B'
): PlayerStats {
  const isMale = gender === 'male';
  const startWeight = isMale ? 104.0 : 88.0;
  const startFat = isMale ? 33.5 : 35.5;
  const startMuscle = isMale ? 27.5 : 21.0;

  return {
    name: name.trim() || (isMale ? 'Carlos' : 'Sofía'),
    gender,
    skinTone,
    hairColor,
    weightKg: startWeight,
    startWeightKg: startWeight,
    bodyFatPct: startFat,
    startBodyFatPct: startFat,
    muscleKg: startMuscle,
    startMuscleKg: startMuscle,
    strength: 12,
    cardio: 10,
    agility: 11,
    fitnessScore: 14,
    level: 1,
    xp: 0,
    xpToNext: 120,
    coins: 150,
    energy: 100,
    maxEnergy: 100,
    hydrationPct: 68,
    proteinToday: 24,
    carbsToday: 90,
    fatToday: 38,
    proteinGoal: isMale ? 150 : 120,
    activeBuff: null,
    streakDays: 1,
    claimedDailyDays: [],
    unlockedOutfits: ['basic'],
    activeOutfit: 'basic',
    totalWorkouts: 0,
    totalCaloriesBurned: 0,
    perfectHitsTotal: 0,
    weeklyScore: 0,
    duelsWon: 0,
    soundEnabled: true,
    pushEnabled: true,
    pushIntervalSec: 75,
    completedRoutinesToday: [],
    dailyMissionsClaimed: [],
    workoutsToday: 0,
    healthyMealsToday: 0,
    personalBests: {},
    lastActiveDate: getLocalDateKey(),
    lastEnergyTickAt: Date.now(),
    currentWeekKey: getIsoWeekKey(),
  };
}
