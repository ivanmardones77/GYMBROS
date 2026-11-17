import React, { useState } from 'react';
import { DifficultyLevel, MinigameId, MultiplayerRival, PlayerStats } from '../types/game';
import { MINIGAMES } from '../data/gameData';
import { Swords, Users, Copy, Check } from 'lucide-react';
import { Trophy3DWidget } from './Trophy3DWidget';

interface WeeklyMultiplayerPanelProps {
  player: PlayerStats;
  rivals: MultiplayerRival[];
  onStartDuel: (gameId: MinigameId, difficulty: DifficultyLevel, rival: MultiplayerRival) => void;
}

export const WeeklyMultiplayerPanel: React.FC<WeeklyMultiplayerPanelProps> = ({
  player,
  rivals,
  onStartDuel,
}) => {
  const [selectedGame, setSelectedGame] = useState<MinigameId>('boxing');
  const [copiedCode, setCopiedCode] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendFeedback, setFriendFeedback] = useState<string | null>(null);

  // Merge player into sorted leaderboard
  const leaderboard: MultiplayerRival[] = [
    ...rivals,
    {
      id: 'player',
      name: `${player.name} (Tú)`,
      club: 'GYMBROS Local',
      gender: player.gender,
      weeklyScore: player.weeklyScore,
      fitnessScore: player.fitnessScore,
      streak: player.streakDays,
      isPlayer: true,
    },
  ].sort((a, b) => b.weeklyScore - a.weeklyScore);

  const playerRank = leaderboard.findIndex((r) => r.isPlayer) + 1;
  const nextRivalAbove = playerRank > 1 ? leaderboard[playerRank - 2] : leaderboard[0];

  const myChallengeCode = `FIT-${player.name.slice(0, 4).toUpperCase()}-${player.weeklyScore + 350}`;

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(myChallengeCode).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleJoinFriendCode = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = friendCodeInput.trim().toUpperCase();
    if (!trimmed) return;
    const match = trimmed.match(/FIT-([A-Z0-9]+)-(\d+)/);
    const targetScore = match ? Math.max(800, Math.min(3500, parseInt(match[2], 10))) : 1450;
    const friendName = match ? `Amigo ${match[1]}` : `Rival ${trimmed.slice(0, 6)}`;

    setFriendFeedback(`Reto cargado: supera ${targetScore} pts contra ${friendName}.`);
    onStartDuel(selectedGame, Math.min(5, Math.max(1, Math.ceil(player.level / 2))) as DifficultyLevel, {
      id: 'friend-duel',
      name: friendName,
      club: 'Código Invitado',
      gender: 'male',
      weeklyScore: targetScore,
      fitnessScore: 60,
      streak: 5,
    });
  };

  return (
    <div className="space-y-8">
      {/* Event Hero Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-black text-white rounded-xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs text-orange-400 font-semibold">
              Liga Global Semanal · Reinicio en 3d 14h
            </p>
            <h2 className="text-3xl font-bold tracking-tight mt-1">
              Copa Titanes de Resistencia
            </h2>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              Suma puntos en cualquier minijuego y lanza Duelos Directos contra atletas reales de tu división. Los 3 primeros ganan el cofre dorado el domingo.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-white/40">Tu Posición</div>
              <div className="text-2xl font-bold font-mono-tabular text-white">
                #{playerRank} / {leaderboard.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40">Puntos Semanales</div>
              <div className="text-2xl font-bold font-mono-tabular text-orange-400">
                {player.weeklyScore.toLocaleString('es-ES')}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40">Duelos Ganados</div>
              <div className="text-2xl font-bold font-mono-tabular text-emerald-400">
                {player.duelsWon}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 fc-card p-5 flex items-center gap-4">
          <Trophy3DWidget className="w-28 h-28 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/50">Premio Top 3</div>
            <h3 className="text-lg font-bold text-white">Trofeo Dorado + 800 Monedas</h3>
            <p className="text-xs text-white/60 mt-1">
              Elige disciplina y supera al rival encima de ti para escalar puestos.
            </p>
          </div>
        </div>
      </div>

      {/* Duel Launcher + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leaderboard Table */}
        <div className="lg:col-span-8 fc-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Clasificación Multijugador
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/50">Disciplina de duelo:</span>
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value as MinigameId)}
                className="bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/90"
              >
                {MINIGAMES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {leaderboard.map((row, idx) => {
              const rank = idx + 1;
              const diff = Math.min(5, Math.max(1, Math.ceil(player.level / 2))) as DifficultyLevel;
              const isPromotionZone = rank <= 3;

              return (
                <div
                  key={row.id}
                  className={`py-3.5 px-3 rounded-lg flex items-center justify-between gap-4 ${
                    row.isPlayer ? 'bg-orange-500/10 border border-orange-500/30 my-1' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`w-7 text-center font-mono-tabular font-bold text-sm ${
                        rank === 1
                          ? 'text-amber-400'
                          : isPromotionZone
                          ? 'text-emerald-400'
                          : 'text-white/50'
                      }`}
                    >
                      #{rank}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white truncate">
                        {row.name}
                      </div>
                      <div className="text-xs text-white/50">
                        {row.club} · Forma {row.fitnessScore}/100 · Racha {row.streak}d
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-mono-tabular font-bold text-sm text-white">
                        {row.weeklyScore.toLocaleString('es-ES')}
                      </div>
                      <div className="text-[11px] text-white/50">pts</div>
                    </div>

                    {!row.isPlayer && (
                      <button
                        onClick={() => onStartDuel(selectedGame, diff, row)}
                        className="px-3 py-1.5 bg-white hover:bg-orange-500 hover:text-white text-black text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                      >
                        <Swords className="w-3.5 h-3.5" /> Retar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Friend Challenge & Quick Rival Match */}
        <div className="lg:col-span-4 space-y-6">
          <div className="fc-card p-5">
            <h3 className="text-lg font-bold text-white">Duelo Rápido de Ascenso</h3>
            <p className="text-xs text-white/60 mt-1">
              {playerRank === 1
                ? '¡Eres #1 de la liga! Defiende tu corona con un nuevo récord.'
                : `Supera la marca de ${nextRivalAbove.name} para ganar +350 pts extra y +120 monedas.`}
            </p>
            <button
              onClick={() =>
                onStartDuel(
                  selectedGame,
                  Math.min(5, Math.max(1, Math.ceil(player.level / 2))) as DifficultyLevel,
                  nextRivalAbove
                )
              }
              className="mt-4 w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
            >
              Desafiar a {nextRivalAbove.name.split(' ')[0]} ahora
            </button>
          </div>

          <div className="fc-card p-5">
            <h3 className="text-lg font-bold text-white">Reto Privado con Amigos</h3>
            <p className="text-xs text-white/60 mt-1">
              Comparte tu código de desafío semanal o introduce el de un amigo para competir por su puntuación.
            </p>

            <div className="mt-3 p-3 bg-white/[0.03] border border-white/10 rounded-lg flex items-center justify-between gap-2">
              <code className="text-xs font-mono-tabular font-bold text-white/90">
                {myChallengeCode}
              </code>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 text-xs font-semibold text-white/75 bg-[#141414] border border-white/10 rounded-md hover:bg-white/10 flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <form onSubmit={handleJoinFriendCode} className="mt-4 space-y-2">
              <input
                type="text"
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                placeholder="Ej: FIT-SOFI-1850"
                className="w-full px-3 py-2 text-xs border border-white/10 rounded-lg focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="w-full py-2 px-3 bg-white hover:bg-white/85 text-black text-xs font-semibold rounded-lg cursor-pointer"
              >
                Aceptar Código de Amigo
              </button>
            </form>
            {friendFeedback && (
              <p className="mt-2 text-xs text-emerald-400 font-medium">{friendFeedback}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
