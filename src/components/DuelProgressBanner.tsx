import React from 'react';
import { Swords, Trophy } from 'lucide-react';

interface DuelProgressBannerProps {
  rivalName?: string;
  rivalTargetScore: number;
  score: number;
}

export const DuelProgressBanner: React.FC<DuelProgressBannerProps> = ({
  rivalName,
  rivalTargetScore,
  score,
}) => {
  const pct = Math.min(100, Math.round((score / Math.max(1, rivalTargetScore)) * 100));
  const winning = score >= rivalTargetScore;

  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-2.5 transition-colors ${
        winning
          ? 'bg-emerald-500/12 border-emerald-500/40 text-emerald-200'
          : 'bg-orange-500/10 border-orange-500/30 text-orange-200'
      }`}
    >
      <div className="flex items-center justify-between gap-3 text-xs font-medium">
        <span className="flex items-center gap-1.5 font-semibold">
          {winning ? (
            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Swords className="w-3.5 h-3.5 text-orange-400" />
          )}
          {winning
            ? `¡Superaste a ${rivalName || 'tu rival'}!`
            : `Duelo contra ${rivalName || 'Rival'}`}
        </span>
        <span className="font-mono-tabular font-bold">
          {score.toLocaleString('es-ES')} / {rivalTargetScore.toLocaleString('es-ES')} pts
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            winning ? 'bg-emerald-400' : 'bg-orange-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
