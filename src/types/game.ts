export type Gender = 'male' | 'female';

export type GameScreen = 'TITLE_MENU' | 'PLAYING';

export type ActiveTab = 'gym' | 'minigames' | 'nutrition' | 'progress' | 'challenges';

export type MinigameId =
  | 'bench'
  | 'sprint'
  | 'boxing'
  | 'macros'
  | 'squats'
  | 'rope'
  | 'battle_ropes'
  | 'deadlift'
  | 'pullups'
  | 'tire_flip'
  | 'agility_ladder'
  | 'dodge_counter'
  | 'wall_ball'
  | 'rowing'
  | 'plank_core'
  | 'sled_push'
  | 'shake_mixer'
  | 'mobility_flow'
  | 'tunnel_vision'
  | 'mirror_posing'
  | 'dumbbell_heist'
  | 'ego_lifting'
  | 'pump_selfie'
  | 'dodge_chat';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export type PhysiqueStage =
  | 'Fuera de Forma'
  | 'Principiante Activo'
  | 'Tonificado'
  | 'Atlético'
  | 'Físico Élite';

export type OutfitId = 'basic' | 'runner' | 'pro' | 'titan';

export interface PersonalBestRecord {
  bestScore: number;
  bestAccuracy: number;
  bestCombo: number;
  bestDifficulty: DifficultyLevel;
  plays: number;
}

export type HonorMedalId =
  | 'medal_titan_bench'
  | 'medal_mach_sprint'
  | 'medal_ko_precision'
  | 'medal_zero_junk'
  | 'medal_iron_legs'
  | 'medal_cardio_storm'
  | 'medal_deadlift_king'
  | 'medal_bar_master'
  | 'medal_phantom_reflex'
  | 'medal_iron_engine'
  | 'medal_core_statue'
  | 'medal_zen_alchemist'
  | 'medal_monk_focus'
  | 'medal_mirror_stealth'
  | 'medal_gym_hustler';

export interface HonorMedalUnlockRecord {
  unlockedAt: string;
  timesEarned: number;
  bestScore: number;
}

export interface ActiveHonorModifier {
  medalId: HonorMedalId;
  medalTitle: string;
  modifierName: string;
  effectSummary: string;
  expiresAt: number;
  durationMin: number;
  muscleMult?: number;
  fatBurnMult?: number;
  xpMult?: number;
  coinMult?: number;
  leagueMult?: number;
  energyDiscountPct?: number;
}

export interface HonorMedalDefinition {
  id: HonorMedalId;
  title: string;
  subtitle: string;
  tierLabel: string;
  challengeText: string;
  modifierName: string;
  effectSummary: string;
  durationMin: number;
  applicableGames: MinigameId[];
  minDifficulty: DifficultyLevel;
  minScore?: number;
  minAccuracyPct?: number;
  minCombo?: number;
  instantEnergyBonus?: number;
  muscleMult?: number;
  fatBurnMult?: number;
  xpMult?: number;
  coinMult?: number;
  leagueMult?: number;
  energyDiscountPct?: number;
}

export interface PlayerStats {
  name: string;
  gender: Gender;
  skinTone: string;
  hairColor: string;
  weightKg: number;
  startWeightKg: number;
  bodyFatPct: number;
  startBodyFatPct: number;
  muscleKg: number;
  startMuscleKg: number;
  strength: number;
  cardio: number;
  agility: number;
  fitnessScore: number;
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  energy: number;
  maxEnergy: number;
  hydrationPct: number;
  proteinToday: number;
  carbsToday: number;
  fatToday: number;
  proteinGoal: number;
  activeBuff: {
    label: string;
    muscleMultiplier: number;
    fatBurnMultiplier: number;
    sessionsLeft: number;
  } | null;
  streakDays: number;
  claimedDailyDays: number[];
  unlockedOutfits: OutfitId[];
  activeOutfit: OutfitId;
  totalWorkouts: number;
  totalCaloriesBurned: number;
  perfectHitsTotal: number;
  weeklyScore: number;
  duelsWon: number;
  soundEnabled: boolean;
  pushEnabled: boolean;
  pushIntervalSec: number;
  completedRoutinesToday: string[];
  dailyMissionsClaimed: string[];
  workoutsToday: number;
  healthyMealsToday: number;
  personalBests?: Partial<Record<MinigameId, PersonalBestRecord>>;
  honorMedals?: Partial<Record<HonorMedalId, HonorMedalUnlockRecord>>;
  activeHonorModifiers?: ActiveHonorModifier[];
  lastActiveDate?: string;
  lastEnergyTickAt?: number;
  currentWeekKey?: string;
  weeklyPrizeClaimedWeek?: string;
}

export interface ProgressPoint {
  id: string;
  label: string;
  weightKg: number;
  bodyFatPct: number;
  muscleKg: number;
  fitnessScore: number;
  caloriesBurned: number;
}

export interface WorkoutHistoryEntry {
  id: string;
  gameId: MinigameId;
  gameTitle: string;
  difficulty: DifficultyLevel;
  score: number;
  accuracyPct: number;
  caloriesBurned: number;
  muscleGain: number;
  fatLossPct: number;
  coinsEarned: number;
  xpEarned: number;
  timestamp: string;
  rivalBeat?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'Fuerza' | 'Cardio' | 'Nutrición' | 'Competitivo';
  metricKey:
    | 'totalWorkouts'
    | 'fitnessScore'
    | 'muscleGainTotal'
    | 'fatLossTotal'
    | 'perfectHitsTotal'
    | 'healthyMealsToday'
    | 'weeklyScore'
    | 'duelsWon'
    | 'streakDays'
    | 'level';
  target: number;
  rewardCoins: number;
  rewardXp: number;
}

export interface MealItem {
  id: string;
  name: string;
  category: 'Equilibrada' | 'Proteína' | 'Hidratación' | 'Antojo';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  energyRestore: number;
  hydrationGain: number;
  fatImpactPct: number;
  buff?: {
    label: string;
    muscleMultiplier: number;
    fatBurnMultiplier: number;
    sessionsLeft: number;
  };
  costCoins: number;
  description: string;
}

export interface RoutineProgram {
  id: string;
  title: string;
  subtitle: string;
  levelRequired: number;
  energyCost: number;
  minigameOrder: MinigameId[];
  recommendedDifficulty: DifficultyLevel;
  bonusCoins: number;
  bonusMuscle: number;
  bonusFatLoss: number;
}

export interface MultiplayerRival {
  id: string;
  name: string;
  club: string;
  gender: Gender;
  weeklyScore: number;
  fitnessScore: number;
  streak: number;
  isPlayer?: boolean;
}

export interface PushNotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'Motivación' | 'Desafío' | 'Nutrición' | 'Recompensa';
  timeLabel: string;
  read: boolean;
}

export interface MinigameResult {
  gameId: MinigameId;
  difficulty: DifficultyLevel;
  score: number;
  maxCombo: number;
  perfectHits: number;
  totalActions: number;
  caloriesBurned: number;
  rivalTargetScore?: number;
  rivalName?: string;
}
