import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActiveTab,
  DifficultyLevel,
  GameScreen,
  Gender,
  MealItem,
  MinigameId,
  MinigameResult,
  MultiplayerRival,
  OutfitId,
  PlayerStats,
  ProgressPoint,
  PushNotificationItem,
  RoutineProgram,
  WorkoutHistoryEntry,
} from './types/game';
import {
  ACHIEVEMENTS,
  DAILY_REWARDS,
  DIFFICULTY_CONFIG,
  INITIAL_RIVALS,
  MINIGAMES,
  MOTIVATIONAL_PUSH_POOL,
  OUTFITS,
  ROUTINES,
  createInitialPlayer,
  getPhysiqueStage,
} from './data/gameData';
import { sound } from './utils/sound';
import { TitleScreen } from './components/TitleScreen';
import { Athlete3DViewer, KineticMode } from './components/Athlete3DViewer';
import { BenchPressGame } from './components/minigames/BenchPressGame';
import { TreadmillSprintGame } from './components/minigames/TreadmillSprintGame';
import { BoxingBagGame } from './components/minigames/BoxingBagGame';
import { MacroCatcherGame } from './components/minigames/MacroCatcherGame';
import { SquatPowerGame } from './components/minigames/SquatPowerGame';
import { JumpRopeGame } from './components/minigames/JumpRopeGame';
import { BattleRopesGame } from './components/minigames/BattleRopesGame';
import { NutritionPanel } from './components/NutritionPanel';
import { ProgressDashboard } from './components/ProgressDashboard';
import { WeeklyMultiplayerPanel } from './components/WeeklyMultiplayerPanel';
import { DailyRewardsModal } from './components/DailyRewardsModal';
import { NotificationCenter } from './components/NotificationCenter';
import { GameCard } from './components/GameCard';
import {
  RoundSummaryModal,
  SummaryData,
  UnlockedAchievementSummary,
} from './components/RoundSummaryModal';
import gymBackdrop from './assets/images/gym_club_backdrop_1794945942801.jpg';
import {
  Bell,
  Dumbbell,
  Flame,
  Gift,
  Lock,
  Play,
  RotateCcw,
  Shirt,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

const STORAGE_KEY = 'fitclub_arena_save_v2';
const LEGACY_STORAGE_KEY = 'fitclub_arena_save_v1';

interface ActiveMinigameSession {
  gameId: MinigameId;
  difficulty: DifficultyLevel;
  rivalTargetScore?: number;
  rivalName?: string;
  routineId?: string;
  routineStepIdx?: number;
}

interface SavedState {
  player: PlayerStats;
  history: ProgressPoint[];
  workouts: WorkoutHistoryEntry[];
  unlockedAchievements: string[];
  rivals: MultiplayerRival[];
  notifications: PushNotificationItem[];
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [activeTab, setActiveTab] = useState<ActiveTab>('gym');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(1);

  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [history, setHistory] = useState<ProgressPoint[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [rivals, setRivals] = useState<MultiplayerRival[]>(INITIAL_RIVALS);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);

  const [activeSession, setActiveSession] = useState<ActiveMinigameSession | null>(null);
  const [roundSummary, setRoundSummary] = useState<SummaryData | null>(null);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toastPush, setToastPush] = useState<PushNotificationItem | null>(null);
  const [gymImgError, setGymImgError] = useState(false);
  const [aiAthlete, setAiAthlete] = useState(true);
  const [kineticMode, setKineticMode] = useState<KineticMode>('none');
  const [kineticBurstKey, setKineticBurstKey] = useState(0);
  const [kineticLabel, setKineticLabel] = useState<string>('');

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const toastTimerRef = useRef<number | null>(null);
  const kineticTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (kineticTimerRef.current) window.clearTimeout(kineticTimerRef.current);
    };
  }, []);

  const triggerKineticEnergy = useCallback(
    (mode: Exclude<KineticMode, 'none'>, label: string, hasRoutineDoneToday: boolean) => {
      setKineticMode(mode);
      setKineticLabel(label);
      setKineticBurstKey((k) => k + 1);
      if (kineticTimerRef.current) window.clearTimeout(kineticTimerRef.current);
      kineticTimerRef.current = window.setTimeout(() => {
        if (hasRoutineDoneToday) {
          setKineticMode('routine');
          setKineticLabel('Energía Cinética · Rutina Completada');
        } else {
          setKineticMode('none');
          setKineticLabel('');
        }
      }, 50000);
    },
    []
  );

  // Load saved game on mount (clearing previous save version to start fresh)
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: SavedState = JSON.parse(raw);
        if (parsed && parsed.player) {
          setPlayer(parsed.player);
          setHistory(parsed.history || []);
          setWorkouts(parsed.workouts || []);
          setUnlockedAchievements(parsed.unlockedAchievements || []);
          setRivals(parsed.rivals || INITIAL_RIVALS);
          setNotifications(parsed.notifications || []);
          sound.setEnabled(parsed.player.soundEnabled);
          if ((parsed.player.completedRoutinesToday?.length || 0) > 0) {
            setKineticMode('routine');
            setKineticLabel('Energía Cinética · Rutina Completada');
          }
          setScreen('PLAYING');
        }
      }
    } catch {
      // Ignore corrupt save
    }
  }, []);

  // Persist changes
  useEffect(() => {
    if (!player) return;
    const data: SavedState = {
      player,
      history,
      workouts,
      unlockedAchievements,
      rivals,
      notifications,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage quota fallback
    }
  }, [player, history, workouts, unlockedAchievements, rivals, notifications]);

  const triggerPushNotification = useCallback(
    (
      title: string,
      body: string,
      category: PushNotificationItem['category'] = 'Motivación',
      playSound = true
    ) => {
      const nowStr = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const item: PushNotificationItem = {
        id: `push_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        body,
        category,
        timeLabel: nowStr,
        read: false,
      };

      setNotifications((prev) => [item, ...prev].slice(0, 20));
      setToastPush(item);
      if (playSound) sound.playPushChime();

      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setToastPush(null);
      }, 5200);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(title, { body });
        } catch {
          // Ignore iframe restriction
        }
      }
    },
    []
  );

  // Periodic motivational push notifications & subtle rival activity
  useEffect(() => {
    if (screen !== 'PLAYING' || !player || !player.pushEnabled) return;

    const timer = window.setInterval(() => {
      if (activeSession) return; // Don't distract mid-minigame
      const template =
        MOTIVATIONAL_PUSH_POOL[Math.floor(Math.random() * MOTIVATIONAL_PUSH_POOL.length)];
      triggerPushNotification(template.title, template.body, template.category, true);

      // Gentle rival progression to keep multiplayer weekly challenge alive
      setRivals((prev) =>
        prev.map((r) =>
          Math.random() > 0.65
            ? { ...r, weeklyScore: r.weeklyScore + Math.floor(20 + Math.random() * 55) }
            : r
        )
      );
    }, (player.pushIntervalSec || 75) * 1000);

    return () => window.clearInterval(timer);
  }, [screen, player?.pushEnabled, player?.pushIntervalSec, activeSession, triggerPushNotification]);

  const handleStartNewGame = (
    name: string,
    gender: Gender,
    skinTone: string,
    hairColor: string
  ) => {
    const initial = createInitialPlayer(name, gender, skinTone, hairColor);
    const startPoint: ProgressPoint = {
      id: 'pt_0',
      label: 'Inicio',
      weightKg: initial.weightKg,
      bodyFatPct: initial.bodyFatPct,
      muscleKg: initial.muscleKg,
      fitnessScore: initial.fitnessScore,
      caloriesBurned: 0,
    };

    setPlayer(initial);
    setHistory([startPoint]);
    setWorkouts([]);
    setUnlockedAchievements([]);
    setRivals(INITIAL_RIVALS);
    setNotifications([
      {
        id: 'welcome_1',
        title: 'Bienvenido a GYMBROS',
        body: 'Tu transformación comienza hoy. Elige un minijuego y reclama tu Día 1 en Recompensas.',
        category: 'Motivación',
        timeLabel: 'Ahora',
        read: false,
      },
    ]);
    sound.setEnabled(true);
    sound.playLevelUp();
    if (kineticTimerRef.current) window.clearTimeout(kineticTimerRef.current);
    setKineticMode('none');
    setKineticLabel('');
    setScreen('PLAYING');
    setActiveTab('gym');
  };

  const evaluateAchievements = useCallback(
    (nextPlayer: PlayerStats, currentUnlocked: string[]) => {
      const newlyUnlocked: string[] = [];
      const unlockedItems: UnlockedAchievementSummary[] = [];
      let bonusCoins = 0;
      let bonusXp = 0;

      for (const ach of ACHIEVEMENTS) {
        if (currentUnlocked.includes(ach.id)) continue;
        let val = 0;
        switch (ach.metricKey) {
          case 'totalWorkouts':
            val = nextPlayer.totalWorkouts;
            break;
          case 'fitnessScore':
            val = nextPlayer.fitnessScore;
            break;
          case 'muscleGainTotal':
            val = nextPlayer.muscleKg - nextPlayer.startMuscleKg;
            break;
          case 'fatLossTotal':
            val = nextPlayer.startBodyFatPct - nextPlayer.bodyFatPct;
            break;
          case 'perfectHitsTotal':
            val = nextPlayer.perfectHitsTotal;
            break;
          case 'healthyMealsToday':
            val = nextPlayer.healthyMealsToday;
            break;
          case 'weeklyScore':
            val = nextPlayer.weeklyScore;
            break;
          case 'duelsWon':
            val = nextPlayer.duelsWon;
            break;
          case 'streakDays':
            val = nextPlayer.streakDays;
            break;
          case 'level':
            val = nextPlayer.level;
            break;
        }
        if (val >= ach.target) {
          newlyUnlocked.push(ach.id);
          unlockedItems.push({
            id: ach.id,
            title: ach.title,
            rewardCoins: ach.rewardCoins,
            rewardXp: ach.rewardXp,
          });
          bonusCoins += ach.rewardCoins;
          bonusXp += ach.rewardXp;
        }
      }

      if (newlyUnlocked.length > 0) {
        setUnlockedAchievements((prev) => [...prev, ...newlyUnlocked]);
        const first = ACHIEVEMENTS.find((a) => a.id === newlyUnlocked[0]);
        if (first) {
          triggerPushNotification(
            '¡Logro Desbloqueado!',
            `${first.title} (+${bonusCoins} monedas, +${bonusXp} XP)`,
            'Recompensa',
            true
          );
        }
      }

      return { bonusCoins, bonusXp, unlockedItems };
    },
    [triggerPushNotification]
  );

  const launchMinigame = (
    gameId: MinigameId,
    difficulty: DifficultyLevel,
    opts?: {
      rivalTargetScore?: number;
      rivalName?: string;
      routineId?: string;
      routineStepIdx?: number;
      skipEnergyCheck?: boolean;
    }
  ) => {
    if (!player) return;
    const cfg = DIFFICULTY_CONFIG[difficulty];
    if (player.level < cfg.unlockLevel) {
      triggerPushNotification(
        'Nivel Bloqueado',
        `Alcanza el Nivel ${cfg.unlockLevel} para desbloquear ${cfg.label}.`,
        'Motivación'
      );
      return;
    }

    if (!opts?.skipEnergyCheck && player.energy < cfg.energyCost) {
      triggerPushNotification(
        'Energía Baja',
        `Necesitas ${cfg.energyCost} de energía. Prepara una comida en Nutrición o reclama Recompensas.`,
        'Nutrición'
      );
      setActiveTab('nutrition');
      return;
    }

    if (!opts?.skipEnergyCheck) {
      setPlayer((prev) =>
        prev ? { ...prev, energy: Math.max(0, prev.energy - cfg.energyCost) } : prev
      );
    }

    sound.playTap();
    setActiveSession({
      gameId,
      difficulty,
      rivalTargetScore: opts?.rivalTargetScore,
      rivalName: opts?.rivalName,
      routineId: opts?.routineId,
      routineStepIdx: opts?.routineStepIdx,
    });
  };

  const launchRoutine = (routine: RoutineProgram) => {
    if (!player) return;
    if (player.level < routine.levelRequired) {
      triggerPushNotification(
        'Rutina Bloqueada',
        `Necesitas Nivel ${routine.levelRequired} para iniciar ${routine.title}.`,
        'Motivación'
      );
      return;
    }
    if (player.energy < routine.energyCost) {
      triggerPushNotification(
        'Energía Insuficiente',
        `Esta rutina requiere ${routine.energyCost} de energía. Recarga en Nutrición.`,
        'Nutrición'
      );
      setActiveTab('nutrition');
      return;
    }

    setPlayer((prev) =>
      prev ? { ...prev, energy: Math.max(0, prev.energy - routine.energyCost) } : prev
    );

    launchMinigame(routine.minigameOrder[0], routine.recommendedDifficulty, {
      routineId: routine.id,
      routineStepIdx: 0,
      skipEnergyCheck: true,
    });
  };

  const handleMinigameComplete = (result: MinigameResult) => {
    if (!player) return;
    const meta = MINIGAMES.find((g) => g.id === result.gameId)!;
    const cfg = DIFFICULTY_CONFIG[result.difficulty];

    const accuracyPct = Math.min(
      100,
      Math.round((result.perfectHits / Math.max(1, result.totalActions)) * 100)
    );
    const performanceFactor = Math.max(0.55, Math.min(2.1, result.score / (950 * cfg.rewardMult)));

    const buffMuscle = player.activeBuff ? player.activeBuff.muscleMultiplier : 1;
    const buffFat = player.activeBuff ? player.activeBuff.fatBurnMultiplier : 1;

    const muscleGain = Number(
      (meta.baseMuscleGain * cfg.rewardMult * performanceFactor * buffMuscle * 0.55).toFixed(2)
    );
    const fatLossPct = Number(
      (meta.baseFatLoss * cfg.rewardMult * performanceFactor * buffFat * 0.65).toFixed(2)
    );

    const duelWon =
      result.rivalTargetScore !== undefined && result.score >= result.rivalTargetScore;

    let coinsEarned = Math.round((45 + result.score * 0.045) * cfg.rewardMult);
    let xpEarned = Math.round((35 + result.score * 0.035) * cfg.rewardMult);
    let weeklyAdd = Math.round(result.score * 0.45);

    if (duelWon) {
      coinsEarned += 120;
      xpEarned += 75;
      weeklyAdd += 350;
    }

    // Check Routine completion bonus
    let routineCompletedBonus: SummaryData['routineCompletedBonus'] = null;
    let hasNextRoutineStep = false;
    const activeRoutine = activeSession?.routineId
      ? ROUTINES.find((r) => r.id === activeSession.routineId)
      : undefined;

    if (activeRoutine && activeSession?.routineStepIdx !== undefined) {
      if (activeSession.routineStepIdx + 1 < activeRoutine.minigameOrder.length) {
        hasNextRoutineStep = true;
      } else {
        coinsEarned += activeRoutine.bonusCoins;
        routineCompletedBonus = {
          title: activeRoutine.title,
          coins: activeRoutine.bonusCoins,
          muscle: activeRoutine.bonusMuscle,
        };
      }
    }

    // Update biometrics
    const nextMuscle = Math.min(
      player.gender === 'male' ? 56 : 42,
      Number((player.muscleKg + muscleGain + (routineCompletedBonus ? routineCompletedBonus.muscle : 0)).toFixed(2))
    );
    const nextFat = Math.max(
      player.gender === 'male' ? 8.0 : 13.5,
      Number((player.bodyFatPct - fatLossPct - (activeRoutine && !hasNextRoutineStep ? activeRoutine.bonusFatLoss : 0)).toFixed(2))
    );

    // Weight shifts realistically: fat drops faster than muscle rises initially
    const fatKgLost = (player.bodyFatPct - nextFat) * 0.58;
    const muscleKgAdded = nextMuscle - player.muscleKg;
    const nextWeight = Math.max(
      player.gender === 'male' ? 66 : 52,
      Number((player.weightKg - fatKgLost + muscleKgAdded * 0.8).toFixed(2))
    );

    // Compute Fitness Score 0..100
    const fatProgress =
      (player.startBodyFatPct - nextFat) /
      Math.max(1, player.startBodyFatPct - (player.gender === 'male' ? 11 : 16));
    const muscleProgress =
      (nextMuscle - player.startMuscleKg) / (player.gender === 'male' ? 14 : 10);
    const nextFitnessScore = Math.min(
      100,
      Math.max(14, Math.round(14 + fatProgress * 46 + muscleProgress * 40))
    );

    // XP & Leveling
    let nextXp = player.xp + xpEarned;
    let nextLevel = player.level;
    let nextXpToNext = player.xpToNext;
    let leveledUp = false;
    while (nextXp >= nextXpToNext) {
      nextXp -= nextXpToNext;
      nextLevel += 1;
      nextXpToNext = Math.round(nextXpToNext * 1.28);
      leveledUp = true;
    }

    const nextBuff = player.activeBuff
      ? player.activeBuff.sessionsLeft > 1
        ? { ...player.activeBuff, sessionsLeft: player.activeBuff.sessionsLeft - 1 }
        : null
      : null;

    // Free protein boost when playing Macro Catcher
    const bonusProtein = result.gameId === 'macros' ? 18 : 0;
    const bonusEnergy = result.gameId === 'macros' ? 15 : 0;

    let updatedPlayer: PlayerStats = {
      ...player,
      weightKg: nextWeight,
      bodyFatPct: nextFat,
      muscleKg: nextMuscle,
      strength:
        player.strength + (result.gameId === 'bench' || result.gameId === 'squats' ? 2 : 1),
      cardio:
        player.cardio + (result.gameId === 'sprint' || result.gameId === 'rope' ? 2 : 1),
      agility:
        player.agility + (result.gameId === 'boxing' || result.gameId === 'battle_ropes' ? 2 : 1),
      fitnessScore: nextFitnessScore,
      level: nextLevel,
      xp: nextXp,
      xpToNext: nextXpToNext,
      coins: player.coins + coinsEarned,
      energy: Math.min(player.maxEnergy, player.energy + bonusEnergy),
      hydrationPct: Math.max(15, player.hydrationPct - 9),
      proteinToday: player.proteinToday + bonusProtein,
      activeBuff: nextBuff,
      totalWorkouts: player.totalWorkouts + 1,
      workoutsToday: player.workoutsToday + 1,
      totalCaloriesBurned: player.totalCaloriesBurned + result.caloriesBurned,
      perfectHitsTotal: player.perfectHitsTotal + result.perfectHits,
      weeklyScore: player.weeklyScore + weeklyAdd,
      duelsWon: player.duelsWon + (duelWon ? 1 : 0),
      completedRoutinesToday:
        routineCompletedBonus && activeRoutine
          ? Array.from(new Set([...player.completedRoutinesToday, activeRoutine.id]))
          : player.completedRoutinesToday,
    };

    const achBonuses = evaluateAchievements(updatedPlayer, unlockedAchievements);
    if (achBonuses.bonusCoins > 0 || achBonuses.bonusXp > 0) {
      updatedPlayer = {
        ...updatedPlayer,
        coins: updatedPlayer.coins + achBonuses.bonusCoins,
        xp: updatedPlayer.xp + achBonuses.bonusXp,
      };
    }

    setPlayer(updatedPlayer);

    const newPoint: ProgressPoint = {
      id: `pt_${Date.now()}`,
      label: `Sesión ${updatedPlayer.totalWorkouts}`,
      weightKg: updatedPlayer.weightKg,
      bodyFatPct: updatedPlayer.bodyFatPct,
      muscleKg: updatedPlayer.muscleKg,
      fitnessScore: updatedPlayer.fitnessScore,
      caloriesBurned: result.caloriesBurned,
    };
    setHistory((prev) => [...prev.slice(-11), newPoint]);

    const newEntry: WorkoutHistoryEntry = {
      id: `w_${Date.now()}`,
      gameId: result.gameId,
      gameTitle: meta.title,
      difficulty: result.difficulty,
      score: result.score,
      accuracyPct,
      caloriesBurned: result.caloriesBurned,
      muscleGain,
      fatLossPct,
      coinsEarned,
      xpEarned,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      rivalBeat: duelWon ? result.rivalName : undefined,
    };
    setWorkouts((prev) => [newEntry, ...prev].slice(0, 20));

    if (leveledUp) {
      sound.playLevelUp();
      triggerPushNotification(
        `¡Nivel ${nextLevel} Alcanzado!`,
        'Tu capacidad atlética crece. Revisa los nuevos niveles de dificultad desbloqueados.',
        'Motivación',
        false
      );
    } else {
      sound.playCoin();
    }

    const hasRoutineDoneToday = updatedPlayer.completedRoutinesToday.length > 0;
    if (routineCompletedBonus) {
      triggerKineticEnergy(
        'routine',
        `Energía Cinética · ${routineCompletedBonus.title}`,
        true
      );
    } else if (result.maxCombo >= 5) {
      triggerKineticEnergy(
        'combo',
        `Energía Cinética · Combo Máximo x${result.maxCombo}`,
        hasRoutineDoneToday
      );
    }

    setRoundSummary({
      gameTitle: meta.title,
      score: result.score,
      accuracyPct,
      maxCombo: result.maxCombo,
      caloriesBurned: result.caloriesBurned,
      muscleGain,
      fatLossPct,
      coinsEarned,
      xpEarned,
      leveledUp,
      newLevel: nextLevel,
      duelWon,
      rivalName: result.rivalName,
      hasNextRoutineStep,
      routineCompletedBonus,
      unlockedAchievements: achBonuses.unlockedItems,
    });
  };

  const handleNextRoutineStep = () => {
    if (!activeSession?.routineId || activeSession.routineStepIdx === undefined) {
      setRoundSummary(null);
      setActiveSession(null);
      return;
    }
    const routine = ROUTINES.find((r) => r.id === activeSession.routineId);
    const nextIdx = activeSession.routineStepIdx + 1;
    setRoundSummary(null);
    if (routine && nextIdx < routine.minigameOrder.length) {
      launchMinigame(routine.minigameOrder[nextIdx], routine.recommendedDifficulty, {
        routineId: routine.id,
        routineStepIdx: nextIdx,
        skipEnergyCheck: true,
      });
    } else {
      setActiveSession(null);
    }
  };

  const handleEatMeal = (meal: MealItem) => {
    if (!player || player.coins < meal.costCoins) return;
    sound.playCoin();

    const nextFat = Math.max(8, Number((player.bodyFatPct + meal.fatImpactPct).toFixed(2)));
    const nextHydration = Math.max(10, Math.min(100, player.hydrationPct + meal.hydrationGain));
    const isHealthy = meal.category !== 'Antojo';

    const nextPlayer: PlayerStats = {
      ...player,
      coins: player.coins - meal.costCoins,
      energy: Math.min(player.maxEnergy, player.energy + meal.energyRestore),
      hydrationPct: nextHydration,
      bodyFatPct: nextFat,
      proteinToday: player.proteinToday + meal.protein,
      carbsToday: player.carbsToday + meal.carbs,
      fatToday: player.fatToday + meal.fat,
      healthyMealsToday: player.healthyMealsToday + (isHealthy ? 1 : 0),
      activeBuff: meal.buff ? meal.buff : player.activeBuff,
    };

    const bonuses = evaluateAchievements(nextPlayer, unlockedAchievements);
    setPlayer({
      ...nextPlayer,
      coins: nextPlayer.coins + bonuses.bonusCoins,
      xp: nextPlayer.xp + bonuses.bonusXp,
    });

    triggerPushNotification(
      isHealthy ? 'Nutrición Óptima' : 'Antojo Registrado',
      isHealthy
        ? `${meal.name} aplicado. Energía: ${nextPlayer.energy}/${nextPlayer.maxEnergy}.`
        : `${meal.name} te dio energía, pero subió tu grasa corporal +${meal.fatImpactPct}%.`,
      'Nutrición',
      false
    );
  };

  const handleClaimDailyDay = (day: number) => {
    if (!player || player.claimedDailyDays.includes(day) || day > player.streakDays) return;
    const step = DAILY_REWARDS.find((d) => d.day === day);
    if (!step) return;
    sound.playLevelUp();

    const nextOutfits =
      step.outfitUnlock && !player.unlockedOutfits.includes(step.outfitUnlock)
        ? [...player.unlockedOutfits, step.outfitUnlock]
        : player.unlockedOutfits;

    setPlayer({
      ...player,
      coins: player.coins + step.coins,
      energy: Math.min(player.maxEnergy, player.energy + (step.energyBonus || 0)),
      claimedDailyDays: [...player.claimedDailyDays, day],
      unlockedOutfits: nextOutfits,
      activeOutfit: step.outfitUnlock || player.activeOutfit,
    });

    triggerPushNotification(
      `Recompensa Día ${day} Reclamada`,
      `Recibiste ${step.rewardText}. ¡Sigue manteniendo tu racha!`,
      'Recompensa',
      false
    );
  };

  const handleClaimDailyMission = (missionId: string, coins: number, xp: number) => {
    if (!player || player.dailyMissionsClaimed.includes(missionId)) return;
    sound.playCoin();
    setPlayer({
      ...player,
      coins: player.coins + coins,
      xp: player.xp + xp,
      dailyMissionsClaimed: [...player.dailyMissionsClaimed, missionId],
    });
  };

  const handleSimulateNextDay = () => {
    if (!player) return;
    sound.playTap();
    setPlayer({
      ...player,
      streakDays: Math.min(7, player.streakDays + 1),
      energy: player.maxEnergy,
      hydrationPct: 75,
      workoutsToday: 0,
      healthyMealsToday: 0,
      proteinToday: 20,
      dailyMissionsClaimed: [],
      completedRoutinesToday: [],
    });
    if (kineticTimerRef.current) window.clearTimeout(kineticTimerRef.current);
    setKineticMode('none');
    setKineticLabel('');
    triggerPushNotification(
      '¡Nuevo Día en GYMBROS!',
      'Energía al 100% y nueva recompensa diaria desbloqueada.',
      'Recompensa'
    );
  };

  const handleSelectOrBuyOutfit = (outfitId: OutfitId) => {
    if (!player) return;
    if (player.unlockedOutfits.includes(outfitId)) {
      sound.playTap();
      setPlayer({ ...player, activeOutfit: outfitId });
      return;
    }
    const cost = OUTFITS[outfitId].cost;
    if (player.coins < cost) {
      triggerPushNotification(
        'Monedas Insuficientes',
        `Necesitas ${cost} monedas para desbloquear ${OUTFITS[outfitId].name}.`,
        'Recompensa'
      );
      return;
    }
    sound.playCoin();
    setPlayer({
      ...player,
      coins: player.coins - cost,
      unlockedOutfits: [...player.unlockedOutfits, outfitId],
      activeOutfit: outfitId,
    });
  };

  const handleRequestBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        triggerPushNotification(
          'Push del Navegador Activo',
          'Ahora recibirás recordatorios motivacionales de GYMBROS.',
          'Motivación'
        );
      }
    } catch {
      // Blocked in sandbox iframe
    }
  };

  const handleResetProfile = () => {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    if (kineticTimerRef.current) window.clearTimeout(kineticTimerRef.current);
    setKineticMode('none');
    setKineticLabel('');
    setPlayer(null);
    setHistory([]);
    setWorkouts([]);
    setUnlockedAchievements([]);
    setRivals(INITIAL_RIVALS);
    setNotifications([]);
    setActiveSession(null);
    setRoundSummary(null);
    setShowDailyRewards(false);
    setShowNotifications(false);
    setToastPush(null);
    setSelectedDifficulty(1);
    setActiveTab('gym');
    setScreen('TITLE_MENU');
  };

  if (screen === 'TITLE_MENU' || !player) {
    return <TitleScreen onStart={handleStartNewGame} />;
  }

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const claimableDailyCount = DAILY_REWARDS.filter(
    (d) => d.day <= player.streakDays && !player.claimedDailyDays.includes(d.day)
  ).length;

  const physiqueStage = getPhysiqueStage(player.fitnessScore);
  const xpPct = Math.min(100, Math.round((player.xp / player.xpToNext) * 100));

  return (
    <div className="min-h-screen text-white flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#0A0A0A]/85 backdrop-blur-xl border-b border-white/[0.07] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            onClick={() => {
              setActiveSession(null);
              setActiveTab('gym');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center -skew-x-12 shadow-[0_6px_20px_-6px_rgba(255,90,31,0.9)]">
              <Dumbbell className="w-4.5 h-4.5 text-white skew-x-12" strokeWidth={2.6} />
            </span>
            <span className="font-display italic text-[1.6rem] font-black uppercase tracking-tight leading-none text-white">
              GYM<span className="text-orange-500">BROS</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1 h-full">
            {(
              [
                { id: 'gym', label: 'Gimnasio' },
                { id: 'minigames', label: 'Minijuegos' },
                { id: 'nutrition', label: 'Nutrición' },
                { id: 'progress', label: 'Progreso' },
                { id: 'challenges', label: 'Desafíos' },
              ] as { id: ActiveTab; label: string }[]
            ).map((tab) => {
              const on = activeTab === tab.id && !activeSession;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveSession(null);
                    setActiveTab(tab.id);
                  }}
                  className={`relative h-full px-4 font-display text-[1.05rem] font-bold uppercase tracking-[0.06em] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    on ? 'text-white' : 'text-white/45 hover:text-white'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`absolute left-3 right-3 bottom-0 h-[3px] rounded-t bg-orange-500 transition-transform origin-center ${
                      on ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              onClick={() => setShowDailyRewards(true)}
              className="fc-btn-accent relative px-4 py-2 text-sm rounded-lg whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              <Gift className="w-4 h-4" />
              Recompensas
              {claimableDailyCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-white text-black text-[11px] not-italic font-black flex items-center justify-center">
                  {claimableDailyCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="md:hidden border-t border-white/[0.06] px-3 py-2 flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'gym', label: 'Gimnasio' },
              { id: 'minigames', label: 'Minijuegos' },
              { id: 'nutrition', label: 'Nutrición' },
              { id: 'progress', label: 'Progreso' },
              { id: 'challenges', label: 'Desafíos' },
            ] as { id: ActiveTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSession(null);
                setActiveTab(tab.id);
              }}
              className={`px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider rounded-md whitespace-nowrap shrink-0 ${
                activeTab === tab.id && !activeSession ? 'bg-white text-black' : 'text-white/55'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Player HUD */}
      <div className="border-b border-white/[0.07] bg-gradient-to-r from-[#111] via-[#0d0d0d] to-[#111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-display italic font-black text-lg">
                {player.level}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded bg-orange-500 text-[8px] leading-3 not-italic font-bold text-white tracking-widest">NV</span>
              </div>
              <div className="min-w-[140px]">
                <div className="font-display text-lg font-bold uppercase leading-none tracking-wide">{player.name}</div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full fc-progress rounded-full transition-all" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            </div>
            {[
              { icon: <Zap className="w-4 h-4" />, label: 'Energía', value: `${player.energy}/${player.maxEnergy}`, color: 'text-orange-500', pct: (player.energy / player.maxEnergy) * 100 },
              { icon: <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 inline-block" />, label: 'Monedas', value: player.coins, color: 'text-amber-400' },
              { icon: <Flame className="w-4 h-4" />, label: 'Racha', value: `${player.streakDays} días`, color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center ${s.color}`}>{s.icon}</span>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold leading-none">{s.label}</div>
                  <div className="font-display text-xl font-bold leading-none mt-1 tabular-nums">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !player.soundEnabled;
                sound.setEnabled(next);
                setPlayer({ ...player, soundEnabled: next });
              }}
              aria-label={player.soundEnabled ? 'Silenciar' : 'Activar sonido'}
              className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06] text-white/80 flex items-center justify-center cursor-pointer"
            >
              {player.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              aria-label="Alertas"
              className="relative w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06] text-white/80 flex items-center justify-center cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifs}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 fc-rise" key={activeSession ? 'session' : activeTab}>
        {activeSession ? (
          <div>
            {activeSession.gameId === 'bench' && (
              <BenchPressGame
                difficulty={activeSession.difficulty}
                athlete={{
                  gender: player.gender,
                  fitnessScore: player.fitnessScore,
                  skinTone: player.skinTone,
                  hairColor: player.hairColor,
                  outfit: player.activeOutfit,
                }}
                rivalTargetScore={activeSession.rivalTargetScore}
                rivalName={activeSession.rivalName}
                onComplete={handleMinigameComplete}
                onCancel={() => setActiveSession(null)}
              />
            )}
            {activeSession.gameId === 'sprint' && (
              <TreadmillSprintGame
                difficulty={activeSession.difficulty}
                athlete={{
                  gender: player.gender,
                  fitnessScore: player.fitnessScore,
                  skinTone: player.skinTone,
                  hairColor: player.hairColor,
                  outfit: player.activeOutfit,
                }}
                rivalTargetScore={activeSession.rivalTargetScore}
                rivalName={activeSession.rivalName}
                onComplete={handleMinigameComplete}
                onCancel={() => setActiveSession(null)}
              />
            )}
            {activeSession.gameId === 'boxing' && (
              <BoxingBagGame
                difficulty={activeSession.difficulty}
                rivalTargetScore={activeSession.rivalTargetScore}
                rivalName={activeSession.rivalName}
                onComplete={handleMinigameComplete}
                onCancel={() => setActiveSession(null)}
              />
            )}
            {activeSession.gameId === 'macros' && (
              <MacroCatcherGame
                difficulty={activeSession.difficulty}
                rivalTargetScore={activeSession.rivalTargetScore}
                rivalName={activeSession.rivalName}
                onComplete={handleMinigameComplete}
                onCancel={() => setActiveSession(null)}
              />
            )}
            {activeSession.gameId === 'squats' && (
              <SquatPowerGame
                difficulty={activeSession.difficulty}
                athlete={{
                  gender: player.gender,
                  fitnessScore: player.fitnessScore,
                  skinTone: player.skinTone,
                  hairColor: player.hairColor,
                  outfit: player.activeOutfit,
                }}
                rivalTargetScore={activeSession.rivalTargetScore}
                rivalName={activeSession.rivalName}
                onComplete={handleMinigameComplete}
                onCancel={() => setActiveSession(null)}
              />
            )}
            {activeSession.gameId === 'rope' && (
              <JumpRopeGame
                difficulty={activeSession.difficulty}
                athlete={{
                  gender: player.gender,
                  fitnessScore: player.fitnessScore,
                  skinTone: player.skinTone,
                  hairColor: player.hairColor,
                  outfit: player.activeOutfit,
                }}
                rivalTargetScore={activeSession.rivalTargetScore}
                rivalName={activeSession.rivalName}
                onComplete={handleMinigameComplete}
                onCancel={() => setActiveSession(null)}
              />
            )}
            {activeSession.gameId === 'battle_ropes' && (
              <BattleRopesGame
                difficulty={activeSession.difficulty}
                athlete={{
                  gender: player.gender,
                  fitnessScore: player.fitnessScore,
                  skinTone: player.skinTone,
                  hairColor: player.hairColor,
                  outfit: player.activeOutfit,
                }}
                rivalTargetScore={activeSession.rivalTargetScore}
                rivalName={activeSession.rivalName}
                onComplete={handleMinigameComplete}
                onCancel={() => setActiveSession(null)}
              />
            )}
          </div>
        ) : (
          <>
            {/* TAB 1: GYM HUB */}
            {activeTab === 'gym' && (
              <div className="space-y-8">
                {/* Split Hero: Character Physique Studio + Gym Arena Backdrop */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left: Transforming Athlete Card */}
                  <div className="lg:col-span-5 fc-card p-6 flex flex-col gap-5 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
                    <div className="relative flex items-start justify-between gap-2">
                      <div>
                        <p className="fc-kicker">
                          Estado físico · {player.gender === 'male' ? 'Hombre' : 'Mujer'}
                        </p>
                        <h1 className="text-[2.6rem] text-white mt-1">
                          {physiqueStage}
                        </h1>
                      </div>
                      <button
                        onClick={handleResetProfile}
                        title="Reiniciar datos del juego"
                        className="px-2.5 py-1.5 text-xs font-medium text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reiniciar
                      </button>
                    </div>

                    <div className="relative flex-1 flex flex-col min-h-[440px]">
                      <Athlete3DViewer
                        gender={player.gender}
                        fitnessScore={player.fitnessScore}
                        skinTone={player.skinTone}
                        hairColor={player.hairColor}
                        outfit={player.activeOutfit}
                        energy={player.energy}
                        hasBuff={Boolean(player.activeBuff)}
                        interactive={true}
                        kineticMode={kineticMode}
                        kineticBurstKey={kineticBurstKey}
                        kineticLabel={kineticLabel}
                        aiModel={aiAthlete}
                        className="w-full flex-1 min-h-[380px] fc-stage !rounded-2xl"
                      />
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 p-1 bg-black/60 backdrop-blur rounded-xl border border-white/10">
                        {[
                          { on: !aiAthlete, label: 'Clásico', v: false },
                          { on: aiAthlete, label: 'Realista', v: true },
                        ].map((b) => (
                          <button
                            key={b.label}
                            onClick={() => setAiAthlete(b.v)}
                            className={`px-3 py-1.5 rounded-lg font-display uppercase tracking-wider font-bold text-sm cursor-pointer transition-colors ${
                              b.on ? (b.v ? 'bg-orange-500 text-white' : 'bg-white text-black') : 'text-white/55 hover:text-white'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>

                      <div className="w-full mt-4">
                        <div className="flex items-end justify-between mb-2">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-white/45 font-semibold">Forma física</span>
                          <span className="font-display italic font-black text-3xl leading-none text-white">
                            {player.fitnessScore}<span className="text-white/30 text-lg not-italic font-bold">/100</span>
                          </span>
                        </div>
                        <div className="h-2.5 bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className="h-full fc-progress rounded-full transition-all duration-500"
                            style={{ width: `${player.fitnessScore}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Biometrics */}
                    <div className="relative grid grid-cols-3 gap-2">
                      {[
                        { l: 'Peso', v: player.weightKg.toFixed(1), u: 'kg', c: 'text-white' },
                        { l: 'Grasa', v: player.bodyFatPct.toFixed(1), u: '%', c: 'text-rose-400' },
                        { l: 'Músculo', v: player.muscleKg.toFixed(1), u: 'kg', c: 'text-emerald-400' },
                      ].map((m) => (
                        <div key={m.l} className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold">{m.l}</div>
                          <div className={`font-display font-bold text-2xl leading-none mt-1 tabular-nums ${m.c}`}>
                            {m.v}<span className="text-sm text-white/40 ml-0.5">{m.u}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Wardrobe / Outfits */}
                    <div className="mt-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/50 mb-2 flex items-center gap-1.5">
                        <Shirt className="w-3.5 h-3.5 text-orange-500" /> Equipación
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(OUTFITS) as OutfitId[]).map((oid) => {
                          const o = OUTFITS[oid];
                          const unlocked = player.unlockedOutfits.includes(oid);
                          const active = player.activeOutfit === oid;
                          return (
                            <button
                              key={oid}
                              onClick={() => handleSelectOrBuyOutfit(oid)}
                              className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                active
                                  ? 'bg-white text-black border-white'
                                  : 'bg-white/[0.03] text-white/80 border-white/[0.08] hover:border-white/25'
                              }`}
                            >
                              <div className="truncate font-display uppercase font-bold text-sm tracking-wide">{o.name}</div>
                              <div className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-orange-600' : unlocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {active ? 'Equipada' : unlocked ? 'Disponible' : `${o.cost} monedas`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: Gym Studio Banner + Progressive Routines */}
                  <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="relative rounded-[1.25rem] overflow-hidden bg-black text-white min-h-[260px] flex flex-col justify-end p-7 fc-stage">
                      {!gymImgError && (
                        <img
                          src={gymBackdrop}
                          alt="Zona de entrenamiento GYMBROS"
                          referrerPolicy="no-referrer"
                          onError={() => setGymImgError(true)}
                          className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale contrast-125"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
                      <div className="absolute top-6 right-6 text-right">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-semibold">Kcal quemadas</div>
                        <div className="font-display italic font-black text-4xl leading-none text-orange-500 tabular-nums">
                          {player.totalCaloriesBurned.toLocaleString('es-ES')}
                        </div>
                      </div>
                      <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
                        <div className="max-w-md">
                          <p className="fc-kicker">Club principal</p>
                          <h2 className="text-[3rem] mt-2 text-balance">
                            Entrena duro.<br /><span className="text-orange-500">Cambia tu cuerpo.</span>
                          </h2>
                        </div>
                        <button
                          onClick={() => launchMinigame('bench', selectedDifficulty)}
                          className="fc-btn-accent px-6 py-3.5 text-lg rounded-xl whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
                        >
                          <Play className="w-5 h-5 fill-current" /> Entreno rápido
                        </button>
                      </div>
                    </div>

                    {/* Structured Routines */}
                    <div className="fc-card p-6 flex-1">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <p className="fc-kicker">Circuitos</p>
                          <h2 className="text-3xl text-white mt-1">Rutinas desafiantes</h2>
                          <p className="text-xs text-white/45 mt-1.5">
                            Circuitos multi-estación con bonificación extra de músculo y definición
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {ROUTINES.map((r) => {
                          const locked = player.level < r.levelRequired;
                          const doneToday = player.completedRoutinesToday.includes(r.id);

                          return (
                            <div
                              key={r.id}
                              className={`relative p-4 rounded-xl border flex flex-col justify-between overflow-hidden transition-all ${
                                locked
                                  ? 'bg-white/[0.02] border-white/[0.06] opacity-55'
                                  : doneToday
                                  ? 'bg-emerald-500/[0.06] border-emerald-500/30'
                                  : 'bg-white/[0.04] border-white/[0.08] hover:border-orange-500/50'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] font-semibold text-white/45">
                                  <span>
                                    {r.minigameOrder.length} estaciones · Nv. {r.levelRequired}+
                                  </span>
                                  <span className="font-mono-tabular font-semibold text-orange-500">
                                    -{r.energyCost} Energía
                                  </span>
                                </div>
                                <h4 className="font-display uppercase italic font-black text-xl leading-tight text-white mt-1.5">{r.title}</h4>
                                <p className="text-xs text-white/60 mt-1">{r.subtitle}</p>
                              </div>

                              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                                <span className="text-[11px] font-mono-tabular text-emerald-400 font-semibold">
                                  +{r.bonusCoins} mon · +{r.bonusMuscle}kg
                                </span>
                                <button
                                  onClick={() => launchRoutine(r)}
                                  disabled={locked}
                                  className={`px-3.5 py-1.5 rounded-lg font-display uppercase font-bold tracking-wider text-sm whitespace-nowrap cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 transition-colors ${
                                    locked
                                      ? 'bg-white/10 text-white/50'
                                      : doneToday
                                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                                      : 'bg-white hover:bg-orange-500 hover:text-white text-black'
                                  }`}
                                >
                                  {locked ? (
                                    <>
                                      <Lock className="w-3 h-3" /> Nv. {r.levelRequired}
                                    </>
                                  ) : doneToday ? (
                                    'Repetir'
                                  ) : (
                                    'Iniciar Rutina'
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Minigames Row */}
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                    <div>
                      <p className="fc-kicker">7 disciplinas</p>
                      <h2 className="text-[2.6rem] text-white mt-1">Minijuegos del gimnasio</h2>
                    </div>
                    <button
                      onClick={() => setActiveTab('minigames')}
                      className="font-display uppercase tracking-wider font-bold text-sm text-white/60 hover:text-orange-500 cursor-pointer"
                    >
                      Elegir dificultad →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {MINIGAMES.map((game, i) => {
                      const cfg = DIFFICULTY_CONFIG[selectedDifficulty];
                      return (
                        <GameCard
                          key={game.id}
                          index={i}
                          game={game}
                          meta={cfg.label}
                          energyCost={cfg.energyCost}
                          onPlay={() => launchMinigame(game.id, selectedDifficulty)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MINIGAMES HUB WITH PROGRESSIVE DIFFICULTY TIERS */}
            {activeTab === 'minigames' && (
              <div className="space-y-6">
                <div className="fc-card p-6 sm:p-7 relative overflow-hidden">
                  <div className="absolute inset-0 fc-stripes opacity-60 pointer-events-none" />
                  <div className="relative">
                    <p className="fc-kicker">Dificultad progresiva</p>
                    <h1 className="text-[2.8rem] text-white mt-1">Elige tu nivel</h1>
                    <p className="text-sm text-white/50 mt-2 max-w-xl">
                      Más velocidad y precisión exigida, hasta x3.0 en recompensas.
                    </p>
                  </div>

                  <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {([1, 2, 3, 4, 5] as DifficultyLevel[]).map((lvl) => {
                      const c = DIFFICULTY_CONFIG[lvl];
                      const unlocked = player.level >= c.unlockLevel;
                      const active = selectedDifficulty === lvl;

                      return (
                        <button
                          key={lvl}
                          onClick={() => unlocked && setSelectedDifficulty(lvl)}
                          disabled={!unlocked}
                          className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer disabled:cursor-not-allowed overflow-hidden ${
                            active
                              ? 'bg-orange-500 text-white border-orange-400 shadow-[0_14px_40px_-14px_rgba(255,90,31,0.9)]'
                              : unlocked
                              ? 'bg-white/[0.04] text-white border-white/[0.08] hover:border-white/30'
                              : 'bg-white/[0.02] text-white/35 border-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={`h-1.5 w-4 rounded-full -skew-x-12 ${n <= lvl ? (active ? 'bg-white' : 'bg-orange-500') : active ? 'bg-white/30' : 'bg-white/10'}`} />
                            ))}
                          </div>
                          <div className="font-display uppercase italic font-black text-xl leading-none">{c.label}</div>
                          <div className="text-[11px] font-semibold mt-1.5 opacity-80 flex items-center gap-1">
                            {unlocked ? (
                              `x${c.rewardMult.toFixed(2)} premios · ${c.energyCost} EN`
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> Nivel {c.unlockLevel}
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {MINIGAMES.map((game, i) => {
                    const cfg = DIFFICULTY_CONFIG[selectedDifficulty];
                    return (
                      <GameCard
                        key={game.id}
                        index={i}
                        variant="full"
                        game={game}
                        meta={cfg.label}
                        energyCost={cfg.energyCost}
                        kcal={Math.round(game.baseCalories * cfg.rewardMult)}
                        onPlay={() => launchMinigame(game.id, selectedDifficulty)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: NUTRITION */}
            {activeTab === 'nutrition' && (
              <NutritionPanel
                player={player}
                onEatMeal={handleEatMeal}
                onStartMacroGame={() => launchMinigame('macros', selectedDifficulty)}
              />
            )}

            {/* TAB 4: PROGRESS & ACHIEVEMENTS */}
            {activeTab === 'progress' && (
              <ProgressDashboard
                player={player}
                history={history}
                workouts={workouts}
                unlockedAchievementIds={unlockedAchievements}
              />
            )}

            {/* TAB 5: WEEKLY MULTIPLAYER CHALLENGES */}
            {activeTab === 'challenges' && (
              <WeeklyMultiplayerPanel
                player={player}
                rivals={rivals}
                onStartDuel={(gameId, difficulty, rival) =>
                  launchMinigame(gameId, difficulty, {
                    rivalTargetScore: Math.round(900 + difficulty * 320),
                    rivalName: rival.name,
                  })
                }
              />
            )}
          </>
        )}
      </main>

      {/* Motivational Push Notification Floating Toast */}
      {toastPush && (
        <div
          role="status"
          className="fixed top-20 right-4 z-40 max-w-sm w-full bg-black text-white border border-white/10 rounded-xl p-4 shadow-lg flex items-start gap-3"
        >
          <div className="p-2 bg-orange-500 rounded-lg shrink-0">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] text-orange-400 font-semibold">
              <span>{toastPush.category}</span>
              <span>{toastPush.timeLabel}</span>
            </div>
            <div className="text-sm font-bold text-white mt-0.5">{toastPush.title}</div>
            <p className="text-xs text-white/60 mt-1">{toastPush.body}</p>
          </div>
          <button
            onClick={() => setToastPush(null)}
            className="text-xs text-white/40 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Round Summary Modal */}
      {roundSummary && (
        <RoundSummaryModal
          summary={roundSummary}
          onContinue={() => {
            const shouldBurst =
              Boolean(roundSummary.routineCompletedBonus) || roundSummary.maxCombo >= 5;
            setRoundSummary(null);
            setActiveSession(null);
            if (shouldBurst) {
              setKineticBurstKey((k) => k + 1);
            }
          }}
          onNextRoutineStep={handleNextRoutineStep}
        />
      )}

      {/* Daily Rewards Modal */}
      {showDailyRewards && (
        <DailyRewardsModal
          player={player}
          onClaimDay={handleClaimDailyDay}
          onClaimMission={handleClaimDailyMission}
          onSimulateNextDay={handleSimulateNextDay}
          onClose={() => setShowDailyRewards(false)}
        />
      )}

      {/* Notification Center Drawer */}
      {showNotifications && (
        <NotificationCenter
          player={player}
          notifications={notifications}
          browserPermission={browserPermission}
          onRequestBrowserPush={handleRequestBrowserPush}
          onTogglePush={() => setPlayer({ ...player, pushEnabled: !player.pushEnabled })}
          onSendTestPush={() => {
            const template =
              MOTIVATIONAL_PUSH_POOL[Math.floor(Math.random() * MOTIVATIONAL_PUSH_POOL.length)];
            triggerPushNotification(template.title, template.body, template.category, true);
          }}
          onMarkAllRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
}
