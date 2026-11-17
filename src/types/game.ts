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
  | 'battle_ropes';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export type PhysiqueStage =
  | 'Fuera de Forma'
  | 'Principiante Activo'
  | 'Tonificado'
  | 'Atlético'
  | 'Físico Élite';

export type OutfitId = 'basic' | 'runner' | 'pro' | 'titan';

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
