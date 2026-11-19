import {
  Achievement,
  ActiveHonorModifier,
  DifficultyLevel,
  Gender,
  HonorMedalDefinition,
  MealItem,
  MinigameId,
  MinigameResult,
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
  category: 'Fuerza' | 'Cardio' | 'Combate' | 'Agilidad' | 'Nutrición' | 'Picardía';
  shortDesc: string;
  controlsHint: string;
  muscleFocus: string;
  baseCalories: number;
  baseMuscleGain: number;
  baseFatLoss: number;
  energyCostMult?: number;
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
  {
    id: 'deadlift',
    title: 'Peso Muerto Titánico',
    category: 'Fuerza',
    shortDesc: 'Tira con potencia manteniendo la barra perfectamente equilibrada frente a las oscilaciones laterales.',
    controlsHint: 'Mantén Espacio para subir · A / D (o Izq / Der) para equilibrar',
    muscleFocus: '+Masa Muscular · +Fuerza Total',
    baseCalories: 175,
    baseMuscleGain: 0.52,
    baseFatLoss: 0.34,
  },
  {
    id: 'pullups',
    title: 'Dominadas & Muscle-Up',
    category: 'Fuerza',
    shortDesc: 'Impúlsate sobre la barra con explosividad y frena la bajada dentro de la zona de control.',
    controlsHint: 'Pulsa W / Espacio para subir · Mantén controlado en la bajada verde',
    muscleFocus: '+Espalda & Brazos · +Fuerza',
    baseCalories: 155,
    baseMuscleGain: 0.45,
    baseFatLoss: 0.28,
  },
  {
    id: 'tire_flip',
    title: 'Volteo de Neumático Gigante',
    category: 'Fuerza',
    shortDesc: 'Engancha el agarre bajo en el punto exacto y desata una ráfaga explosiva para volcar 220 kg.',
    controlsHint: 'Espacio en zona verde (agarre) + ráfaga A / D o toques rápidos',
    muscleFocus: '+Potencia Explosiva · -Grasa',
    baseCalories: 215,
    baseMuscleGain: 0.44,
    baseFatLoss: 0.46,
  },
  {
    id: 'agility_ladder',
    title: 'Escalera de Agilidad Pro',
    category: 'Agilidad',
    shortDesc: 'Pisa cada peldaño luminoso por su carril exacto antes de que cruce la línea de velocidad.',
    controlsHint: 'A / S / D (o Izq / Centro / Der) al ritmo de los peldaños',
    muscleFocus: '+Agilidad · +Coordinación',
    baseCalories: 190,
    baseMuscleGain: 0.18,
    baseFatLoss: 0.52,
  },
  {
    id: 'dodge_counter',
    title: 'Esquiva y Contraataque',
    category: 'Combate',
    shortDesc: 'Lee el ataque entrante, esquiva hacia el lado seguro y castiga al instante en la ventana de contra.',
    controlsHint: 'A / D / S para esquivar · Espacio al abrirse ¡CONTRAATAQUE!',
    muscleFocus: '+Agilidad · +Reflejos KO',
    baseCalories: 205,
    baseMuscleGain: 0.24,
    baseFatLoss: 0.50,
  },
  {
    id: 'wall_ball',
    title: 'Balón Medicinal a la Diana',
    category: 'Agilidad',
    shortDesc: 'Lanza el balón pesado a la diana iluminada tras cada sentadilla y atrápalo limpio al caer.',
    controlsHint: 'A / S / D para lanzar a la diana activa · Espacio para atrapar',
    muscleFocus: '+Potencia · +Agilidad',
    baseCalories: 200,
    baseMuscleGain: 0.34,
    baseFatLoss: 0.48,
  },
  {
    id: 'rowing',
    title: 'Remo Indoor Olímpico',
    category: 'Cardio',
    shortDesc: 'Domina el ritmo perfecto de palada: tirón potente en zona verde seguido de recuperación serena.',
    controlsHint: 'Mantén Espacio en la fase de tirón · Suelta para deslizar y recuperar',
    muscleFocus: '+Cardio · +Resistencia Dorsal',
    baseCalories: 240,
    baseMuscleGain: 0.26,
    baseFatLoss: 0.64,
  },
  {
    id: 'plank_core',
    title: 'Plancha Isométrica Extrema',
    category: 'Fuerza',
    shortDesc: 'Resiste los temblores musculares y mantén tu centro de gravedad dentro del anillo core.',
    controlsHint: 'WASD, Flechas o arrastra el pad para centrar tu estabilidad',
    muscleFocus: '+Core de Acero · +Resistencia',
    baseCalories: 140,
    baseMuscleGain: 0.36,
    baseFatLoss: 0.38,
  },
  {
    id: 'sled_push',
    title: 'Trineo de Empuje Prowler',
    category: 'Cardio',
    shortDesc: 'Impulsa el trineo lastrado alternando zancadas dentro de la cadencia turbo sin tropezar.',
    controlsHint: 'Alterna A y D (o Izq y Der) en la franja verde de cadencia',
    muscleFocus: '+Potencia Piernas · -Grasa',
    baseCalories: 250,
    baseMuscleGain: 0.32,
    baseFatLoss: 0.66,
  },
  {
    id: 'shake_mixer',
    title: 'Barra de Batidos Fit',
    category: 'Nutrición',
    shortDesc: 'Dosifica proteína, fruta y agua justo en la marca de cada pedido y agita la coctelera.',
    controlsHint: '1 / 2 / 3 (o botones) para parar cada dosificador · Espacio para agitar',
    muscleFocus: '+Proteína · +Hidratación · +Energía',
    baseCalories: 95,
    baseMuscleGain: 0.22,
    baseFatLoss: 0.24,
  },
  {
    id: 'mobility_flow',
    title: 'Estiramiento & Foam Roller',
    category: 'Nutrición',
    shortDesc: 'Sigue el flujo respiratorio con precisión suave para liberar tensión y recargar tu Energía.',
    controlsHint: 'Mueve el puntero / WASD dentro del halo respiratorio sin salirte',
    muscleFocus: '+Recuperación · +Energía · +Hidratación',
    baseCalories: 70,
    baseMuscleGain: 0.12,
    baseFatLoss: 0.20,
    energyCostMult: 0.25,
  },
  {
    id: 'tunnel_vision',
    title: 'Vista de Túnel (No Mires)',
    category: 'Picardía',
    shortDesc: 'Haz tu serie de bíceps sin desviar la mirada hacia las distracciones que cruzan por el gimnasio.',
    controlsHint: 'A / D (o arrastra el radar) para mirar al frente · Espacio para clavar curl',
    muscleFocus: '+Concentración Monje · +Bíceps',
    baseCalories: 135,
    baseMuscleGain: 0.34,
    baseFatLoss: 0.28,
  },
  {
    id: 'mirror_posing',
    title: 'Posing Pirata en el Espejo',
    category: 'Picardía',
    shortDesc: 'Saca doble bíceps frente al espejo cuando nadie mira y disimula estirando el cuello si se giran.',
    controlsHint: 'Mantén Espacio para posar · Suelta / pulsa S al instante en alerta roja',
    muscleFocus: '+Ego Pump · +Reflejos',
    baseCalories: 120,
    baseMuscleGain: 0.32,
    baseFatLoss: 0.25,
  },
  {
    id: 'dumbbell_heist',
    title: 'Asalto al Rack de Mancuernas',
    category: 'Picardía',
    shortDesc: 'Roba las últimas mancuernas de 20 kg mientras el Gym Bro alfa mira su móvil y vuelve sin hacer ruido.',
    controlsHint: 'Mantén W / Espacio en luz verde para avanzar · Frena en seco en luz roja',
    muscleFocus: '+Sigilo · +Agilidad',
    baseCalories: 160,
    baseMuscleGain: 0.26,
    baseFatLoss: 0.44,
  },
  {
    id: 'ego_lifting',
    title: 'Ego Lifting & Póker Face',
    category: 'Picardía',
    shortDesc: 'Has cargado 180 kg para el Reel: sube la barra manteniendo la cara impasible sin temblores ni muecas.',
    controlsHint: 'Mantén Espacio para subir · A / D para estabilizar tu Póker Face',
    muscleFocus: '+Fuerza Bruta · +Cara de Póker',
    baseCalories: 185,
    baseMuscleGain: 0.48,
    baseFatLoss: 0.32,
  },
  {
    id: 'pump_selfie',
    title: 'Cazador del Pump Perfecto',
    category: 'Picardía',
    shortDesc: 'Busca el foco cenital perfecto del gym, infla el pecho y dispara la foto antes de que se crucen por detrás.',
    controlsHint: 'A / D para colocarte bajo el foco · Espacio para disparar sin photobombers',
    muscleFocus: '+Estética · +Velocidad',
    baseCalories: 115,
    baseMuscleGain: 0.28,
    baseFatLoss: 0.26,
  },
  {
    id: 'dodge_chat',
    title: 'Escape del Pesado',
    category: 'Picardía',
    shortDesc: 'Esquiva al pesado de los suplementos entre máquinas y suelta excusas rápidas si te corta el paso.',
    controlsHint: 'A / S / D para esquivar carriles · 1 / 2 / 3 para soltar excusa si te atrapa',
    muscleFocus: '+Cardio Evasivo · +Agilidad',
    baseCalories: 210,
    baseMuscleGain: 0.18,
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
  {
    id: 'routine_strongman',
    title: 'Circuito Strongman 3D',
    subtitle: 'Peso muerto titánico, volteo de neumático y empuje de trineo.',
    levelRequired: 3,
    energyCost: 44,
    minigameOrder: ['deadlift', 'tire_flip', 'sled_push'],
    recommendedDifficulty: 2,
    bonusCoins: 290,
    bonusMuscle: 1.35,
    bonusFatLoss: 1.25,
  },
  {
    id: 'routine_reflex',
    title: 'Reflejos y Balón Pro',
    subtitle: 'Escalera de velocidad, esquiva de combate y dianas con balón medicinal.',
    levelRequired: 4,
    energyCost: 42,
    minigameOrder: ['agility_ladder', 'dodge_counter', 'wall_ball'],
    recommendedDifficulty: 3,
    bonusCoins: 310,
    bonusMuscle: 0.95,
    bonusFatLoss: 1.55,
  },
  {
    id: 'routine_zen_bar',
    title: 'Remo, Core & Recuperación',
    subtitle: 'Remo olímpico, plancha extrema, estiramiento regenerativo y batido proteico.',
    levelRequired: 2,
    energyCost: 34,
    minigameOrder: ['rowing', 'plank_core', 'mobility_flow', 'shake_mixer'],
    recommendedDifficulty: 2,
    bonusCoins: 250,
    bonusMuscle: 0.90,
    bonusFatLoss: 1.20,
  },
  {
    id: 'routine_picaresca',
    title: 'Operación Postuero & Sigilo',
    subtitle: 'Mirada recta, posing frente al espejo, robo de mancuernas y selfie bajo el foco.',
    levelRequired: 2,
    energyCost: 38,
    minigameOrder: ['tunnel_vision', 'mirror_posing', 'dumbbell_heist', 'pump_selfie'],
    recommendedDifficulty: 2,
    bonusCoins: 320,
    bonusMuscle: 1.15,
    bonusFatLoss: 1.30,
  },
  {
    id: 'routine_tunnel_master',
    title: 'Sobrevivir a la Hora Punta',
    subtitle: 'Ego lifting de 180 kg y huida épica del pesado de los suplementos.',
    levelRequired: 3,
    energyCost: 34,
    minigameOrder: ['ego_lifting', 'dodge_chat', 'mirror_posing'],
    recommendedDifficulty: 3,
    bonusCoins: 340,
    bonusMuscle: 1.20,
    bonusFatLoss: 1.45,
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

export const HONOR_MEDALS: HonorMedalDefinition[] = [
  {
    id: 'medal_titan_bench',
    title: 'Titán del Hierro',
    subtitle: 'Press de Banca Explosivo',
    tierLabel: 'Maestría Fuerza',
    challengeText: 'Nivel 4+ · Precisión ≥ 88% · Combo ≥ 8',
    modifierName: 'Sobrecompensación Anabólica',
    effectSummary: '+30% Músculo · +20% XP',
    durationMin: 20,
    applicableGames: ['bench'],
    minDifficulty: 4,
    minAccuracyPct: 88,
    minCombo: 8,
    muscleMult: 1.3,
    xpMult: 1.2,
  },
  {
    id: 'medal_mach_sprint',
    title: 'Relámpago HIIT',
    subtitle: 'Sprint HIIT en Cinta',
    tierLabel: 'Maestría Velocidad',
    challengeText: 'Nivel 3+ · 2,600+ pts · Combo ≥ 10',
    modifierName: 'Metabolismo Supersónico',
    effectSummary: '+35% Quema de Grasa · -20% Coste Energía',
    durationMin: 20,
    applicableGames: ['sprint'],
    minDifficulty: 3,
    minScore: 2600,
    minCombo: 10,
    fatBurnMult: 1.35,
    energyDiscountPct: 0.2,
  },
  {
    id: 'medal_ko_precision',
    title: 'Puño Quirúrgico',
    subtitle: 'Combo Saco de Boxeo',
    tierLabel: 'Maestría Combate',
    challengeText: 'Nivel 3+ · Precisión ≥ 92% · Combo ≥ 12',
    modifierName: 'Flujo de Campeón',
    effectSummary: '+25% Monedas · +25% Puntos Liga',
    durationMin: 20,
    applicableGames: ['boxing'],
    minDifficulty: 3,
    minAccuracyPct: 92,
    minCombo: 12,
    coinMult: 1.25,
    leagueMult: 1.25,
  },
  {
    id: 'medal_zero_junk',
    title: 'Pureza Metabólica',
    subtitle: 'Plato Fit Express',
    tierLabel: 'Maestría Nutrición',
    challengeText: 'Nivel 3+ · Precisión 100% · 1,400+ pts',
    modifierName: 'Asimilación Perfecta',
    effectSummary: '+25% Músculo · +25% Quema · +10 Energía al activar',
    durationMin: 25,
    applicableGames: ['macros'],
    minDifficulty: 3,
    minScore: 1400,
    minAccuracyPct: 100,
    instantEnergyBonus: 10,
    muscleMult: 1.25,
    fatBurnMult: 1.25,
  },
  {
    id: 'medal_iron_legs',
    title: 'Acero Implacable',
    subtitle: 'Sentadilla de Hierro',
    tierLabel: 'Maestría Potencia',
    challengeText: 'Nivel 4+ · Precisión ≥ 90% · 2,200+ pts',
    modifierName: 'Potencia de Élite',
    effectSummary: '+35% Músculo · +20% XP',
    durationMin: 20,
    applicableGames: ['squats'],
    minDifficulty: 4,
    minScore: 2200,
    minAccuracyPct: 90,
    muscleMult: 1.35,
    xpMult: 1.2,
  },
  {
    id: 'medal_cardio_storm',
    title: 'Tormenta Sin Aliento',
    subtitle: 'Cuerda Turbo o Battle Ropes',
    tierLabel: 'Maestría Resistencia',
    challengeText: 'Nivel 4+ · 2,800+ pts · Combo ≥ 14',
    modifierName: 'Aura Imparable',
    effectSummary: '+25% Monedas · +25% XP · +30% Liga',
    durationMin: 20,
    applicableGames: ['rope', 'battle_ropes'],
    minDifficulty: 4,
    minScore: 2800,
    minCombo: 14,
    coinMult: 1.25,
    xpMult: 1.25,
    leagueMult: 1.3,
  },
  {
    id: 'medal_deadlift_king',
    title: 'Coloso del Suelo',
    subtitle: 'Peso Muerto o Neumático',
    tierLabel: 'Maestría Strongman',
    challengeText: 'Nivel 3+ · Precisión ≥ 85% · 1,900+ pts',
    modifierName: 'Fuerza Sísmica',
    effectSummary: '+35% Músculo · +15% Monedas',
    durationMin: 20,
    applicableGames: ['deadlift', 'tire_flip'],
    minDifficulty: 3,
    minScore: 1900,
    minAccuracyPct: 85,
    muscleMult: 1.35,
    coinMult: 1.15,
  },
  {
    id: 'medal_bar_master',
    title: 'Señor de la Barra',
    subtitle: 'Dominadas o Balón Medicinal',
    tierLabel: 'Maestría Gimnástica',
    challengeText: 'Nivel 3+ · 1,800+ pts · Combo ≥ 8',
    modifierName: 'Vuelo Explosivo',
    effectSummary: '+25% Músculo · +25% XP · -15% Coste Energía',
    durationMin: 20,
    applicableGames: ['pullups', 'wall_ball'],
    minDifficulty: 3,
    minScore: 1800,
    minCombo: 8,
    muscleMult: 1.25,
    xpMult: 1.25,
    energyDiscountPct: 0.15,
  },
  {
    id: 'medal_phantom_reflex',
    title: 'Sombra Relámpago',
    subtitle: 'Escalera Agilidad o Esquiva KO',
    tierLabel: 'Maestría Reflejos',
    challengeText: 'Nivel 3+ · Precisión ≥ 88% · Combo ≥ 10',
    modifierName: 'Instinto Ultra',
    effectSummary: '+30% Puntos Liga · +25% Quema de Grasa',
    durationMin: 20,
    applicableGames: ['agility_ladder', 'dodge_counter'],
    minDifficulty: 3,
    minAccuracyPct: 88,
    minCombo: 10,
    leagueMult: 1.3,
    fatBurnMult: 1.25,
  },
  {
    id: 'medal_iron_engine',
    title: 'Motor Olímpico',
    subtitle: 'Remo Indoor o Trineo Prowler',
    tierLabel: 'Maestría Potencia Aeróbica',
    challengeText: 'Nivel 3+ · 2,100+ pts · Precisión ≥ 82%',
    modifierName: 'Turbina Metabólica',
    effectSummary: '+35% Quema de Grasa · +20% XP',
    durationMin: 22,
    applicableGames: ['rowing', 'sled_push'],
    minDifficulty: 3,
    minScore: 2100,
    minAccuracyPct: 82,
    fatBurnMult: 1.35,
    xpMult: 1.2,
  },
  {
    id: 'medal_core_statue',
    title: 'Núcleo de Granito',
    subtitle: 'Plancha Isométrica Extrema',
    tierLabel: 'Maestría Core',
    challengeText: 'Nivel 3+ · Precisión ≥ 90% · 1,700+ pts',
    modifierName: 'Centro Inquebrantable',
    effectSummary: '+25% Músculo · -20% Coste Energía',
    durationMin: 20,
    applicableGames: ['plank_core'],
    minDifficulty: 3,
    minScore: 1700,
    minAccuracyPct: 90,
    muscleMult: 1.25,
    energyDiscountPct: 0.2,
  },
  {
    id: 'medal_zen_alchemist',
    title: 'Alquimista Zen',
    subtitle: 'Barra de Batidos o Estiramiento Flow',
    tierLabel: 'Maestría Recuperación',
    challengeText: 'Nivel 2+ · Precisión ≥ 92% · 1,400+ pts',
    modifierName: 'Regeneración Celular',
    effectSummary: '+25% XP · +25% Monedas · +12 Energía al activar',
    durationMin: 25,
    applicableGames: ['shake_mixer', 'mobility_flow'],
    minDifficulty: 2,
    minScore: 1400,
    minAccuracyPct: 92,
    instantEnergyBonus: 12,
    xpMult: 1.25,
    coinMult: 1.25,
  },
  {
    id: 'medal_monk_focus',
    title: 'Monje del Hierro',
    subtitle: 'Vista de Túnel o Ego Lifting',
    tierLabel: 'Maestría Concentración',
    challengeText: 'Nivel 2+ · Precisión ≥ 85% · 1,600+ pts',
    modifierName: 'Templo Imperturbable',
    effectSummary: '+25% Músculo · +25% XP',
    durationMin: 20,
    applicableGames: ['tunnel_vision', 'ego_lifting'],
    minDifficulty: 2,
    minScore: 1600,
    minAccuracyPct: 85,
    muscleMult: 1.25,
    xpMult: 1.25,
  },
  {
    id: 'medal_mirror_stealth',
    title: 'Sombra del Espejo',
    subtitle: 'Posing Pirata o Cazador de Pump',
    tierLabel: 'Maestría Postuero',
    challengeText: 'Nivel 2+ · Precisión ≥ 88% · Combo ≥ 6',
    modifierName: 'Iluminación Cenital',
    effectSummary: '+30% Monedas · +20% Puntos Liga',
    durationMin: 20,
    applicableGames: ['mirror_posing', 'pump_selfie'],
    minDifficulty: 2,
    minAccuracyPct: 88,
    minCombo: 6,
    coinMult: 1.3,
    leagueMult: 1.2,
  },
  {
    id: 'medal_gym_hustler',
    title: 'Fantasma del Rack',
    subtitle: 'Asalto al Rack o Escape del Pesado',
    tierLabel: 'Maestría Picaresca',
    challengeText: 'Nivel 2+ · 1,700+ pts · Combo ≥ 8',
    modifierName: 'Paso Invisible',
    effectSummary: '+30% Quema Grasa · -20% Coste Energía',
    durationMin: 22,
    applicableGames: ['dumbbell_heist', 'dodge_chat'],
    minDifficulty: 2,
    minScore: 1700,
    minCombo: 8,
    fatBurnMult: 1.3,
    energyDiscountPct: 0.2,
  },
];

export function evaluateHonorMedals(
  result: MinigameResult,
  accuracyPct: number
): HonorMedalDefinition[] {
  return HONOR_MEDALS.filter((m) => {
    if (!m.applicableGames.includes(result.gameId)) return false;
    if (result.difficulty < m.minDifficulty) return false;
    if (m.minScore !== undefined && result.score < m.minScore) return false;
    if (m.minAccuracyPct !== undefined && accuracyPct < m.minAccuracyPct) return false;
    if (m.minCombo !== undefined && result.maxCombo < m.minCombo) return false;
    return true;
  });
}

export function getActiveHonorModifiers(
  modifiers?: ActiveHonorModifier[],
  now = Date.now()
): ActiveHonorModifier[] {
  if (!Array.isArray(modifiers) || modifiers.length === 0) return [];
  return modifiers.filter((m) => typeof m.expiresAt === 'number' && m.expiresAt > now);
}

export function aggregateHonorBonuses(modifiers: ActiveHonorModifier[]) {
  let muscleMult = 1;
  let fatBurnMult = 1;
  let xpMult = 1;
  let coinMult = 1;
  let leagueMult = 1;
  let energyDiscountPct = 0;

  for (const mod of modifiers) {
    if (mod.muscleMult) muscleMult += mod.muscleMult - 1;
    if (mod.fatBurnMult) fatBurnMult += mod.fatBurnMult - 1;
    if (mod.xpMult) xpMult += mod.xpMult - 1;
    if (mod.coinMult) coinMult += mod.coinMult - 1;
    if (mod.leagueMult) leagueMult += mod.leagueMult - 1;
    if (mod.energyDiscountPct) energyDiscountPct += mod.energyDiscountPct;
  }

  return {
    muscleMult: Number(muscleMult.toFixed(2)),
    fatBurnMult: Number(fatBurnMult.toFixed(2)),
    xpMult: Number(xpMult.toFixed(2)),
    coinMult: Number(coinMult.toFixed(2)),
    leagueMult: Number(leagueMult.toFixed(2)),
    energyDiscountPct: Math.min(0.45, Number(energyDiscountPct.toFixed(2))),
  };
}

export function formatRemainingTime(expiresAt: number, now = Date.now()): string {
  const totalSec = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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
    honorMedals: {},
    activeHonorModifiers: [],
    lastActiveDate: getLocalDateKey(),
    lastEnergyTickAt: Date.now(),
    currentWeekKey: getIsoWeekKey(),
  };
}
