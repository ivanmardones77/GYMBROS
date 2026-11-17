import React from 'react';
import { Gender, OutfitId } from '../types/game';
import { OUTFITS } from '../data/gameData';

interface CharacterAvatarProps {
  gender: Gender;
  fitnessScore: number; // 10 to 100
  skinTone?: string;
  hairColor?: string;
  outfit?: OutfitId;
  energy?: number;
  hasBuff?: boolean;
  className?: string;
  pose?: 'idle' | 'flex' | 'tired';
  animate?: boolean;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  gender,
  fitnessScore,
  skinTone = '#E8B896',
  hairColor = '#1E293B',
  outfit = 'basic',
  energy = 100,
  hasBuff = false,
  className = 'w-48 h-60',
  pose = 'idle',
  animate = true,
}) => {
  // Normalized progress from 0 (out of shape) to 1 (elite)
  const p = Math.max(0, Math.min(1, (fitnessScore - 12) / 88));
  const isMale = gender === 'male';

  // Interpolated body geometry
  const shoulderHalf = isMale ? 28 + p * 16 : 23 + p * 9;
  const waistHalf = isMale ? 34 - p * 14 : 31 - p * 13;
  const hipHalf = isMale ? 30 - p * 9 : 33 - p * 7;
  const armWidth = isMale ? 9 + p * 7 : 8 + p * 4.5;
  const legWidth = isMale ? 13 + p * 4 : 13 + p * 3.5;
  const bellyCurve = (1 - p) * 14; // Out-of-shape rounded belly

  const outfitColor = OUTFITS[outfit]?.color || '#64748B';
  const accentColor = outfit === 'titan' ? '#FBBF24' : outfit === 'pro' ? '#6EE7B7' : '#FFFFFF';
  const shortsColor = outfit === 'titan' ? '#0F172A' : '#1E293B';

  const isTired = pose === 'tired' || energy < 25;
  const isFlexing = pose === 'flex' || p > 0.72;
  const breatheClass = animate ? (isTired ? 'avatar-breathe-tired' : 'avatar-breathe-idle') : '';
  const headClass = animate ? 'avatar-head-bob' : '';
  const shadowClass = animate ? 'avatar-shadow-pulse' : '';

  return (
    <svg
      viewBox="0 0 200 260"
      className={className}
      role="img"
      aria-label={`Personaje ${isMale ? 'hombre' : 'mujer'} con nivel físico ${Math.round(fitnessScore)}`}
    >
      <defs>
        <radialGradient id="floorShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0F172A" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={outfitColor} />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.88" />
        </linearGradient>
      </defs>

      {/* Floor shadow */}
      <ellipse
        cx="100"
        cy="244"
        rx={40 + (1 - p) * 8}
        ry="8"
        fill="url(#floorShadow)"
        className={shadowClass}
      />

      {/* Subtle active nutrition buff aura */}
      {hasBuff && (
        <ellipse
          cx="100"
          cy="132"
          rx="66"
          ry="104"
          fill="none"
          stroke="#EA580C"
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity="0.45"
        />
      )}

      {/* Legs (Grounded) */}
      <g>
        {/* Left Leg */}
        <path
          d={`M ${100 - hipHalf + 4} 156 L ${100 - hipHalf + 2} 226 L ${100 - hipHalf + 2 + legWidth} 226 L ${100 - 4} 162 Z`}
          fill={skinTone}
        />
        {/* Right Leg */}
        <path
          d={`M ${100 + hipHalf - 4} 156 L ${100 + hipHalf - 2} 226 L ${100 + hipHalf - 2 - legWidth} 226 L ${100 + 4} 162 Z`}
          fill={skinTone}
        />

        {/* Quad muscle definition when fit */}
        {p > 0.4 && (
          <g stroke="#0F172A" strokeOpacity={0.14 * p} strokeWidth="1.5" fill="none">
            <path d={`M ${100 - hipHalf + 8} 174 Q ${100 - hipHalf + 11} 192 ${100 - hipHalf + 7} 206`} />
            <path d={`M ${100 + hipHalf - 8} 174 Q ${100 + hipHalf - 11} 192 ${100 + hipHalf - 7} 206`} />
          </g>
        )}

        {/* Sneakers */}
        <path
          d={`M ${100 - hipHalf} 224 L ${100 - hipHalf - 6} 236 L ${100 - hipHalf + legWidth + 4} 236 L ${100 - hipHalf + legWidth + 2} 224 Z`}
          fill="#0F172A"
        />
        <path
          d={`M ${100 - hipHalf - 6} 234 L ${100 - hipHalf + legWidth + 4} 234 L ${100 - hipHalf + legWidth + 4} 238 L ${100 - hipHalf - 6} 238 Z`}
          fill="#EA580C"
        />
        <path
          d={`M ${100 + hipHalf} 224 L ${100 + hipHalf + 6} 236 L ${100 + hipHalf - legWidth - 4} 236 L ${100 + hipHalf - legWidth - 2} 224 Z`}
          fill="#0F172A"
        />
        <path
          d={`M ${100 + hipHalf - legWidth - 4} 234 L ${100 + hipHalf + 6} 234 L ${100 + hipHalf + 6} 238 L ${100 + hipHalf - legWidth - 4} 238 Z`}
          fill="#EA580C"
        />
      </g>

      {/* Athletic Shorts */}
      <path
        d={`M ${100 - waistHalf} 134
            Q ${100 - hipHalf - 3} 148 ${100 - hipHalf - 2} 170
            L ${100 - 3} 170 L 100 154 L ${100 + 3} 170
            L ${100 + hipHalf + 2} 170
            Q ${100 + hipHalf + 3} 148 ${100 + waistHalf} 134 Z`}
        fill={shortsColor}
      />
      <rect x={100 - waistHalf} y="131" width={waistHalf * 2} height="5" rx="2" fill="#EA580C" />

      {/* Animated Upper Body (Breathing & subtle idle sway) */}
      <g className={breatheClass}>
        {/* Arms (Behind or beside torso depending on flex pose) */}
        {isFlexing ? (
          <g>
            {/* Left flexing arm */}
            <path
              d={`M ${100 - shoulderHalf + 2} 76 Q ${100 - shoulderHalf - 22} 84 ${100 - shoulderHalf - 16} 56`}
              fill="none"
              stroke={skinTone}
              strokeWidth={armWidth}
              strokeLinecap="round"
            />
            <circle cx={100 - shoulderHalf - 15} cy="52" r={armWidth * 0.56} fill={skinTone} />
            {/* Right flexing arm */}
            <path
              d={`M ${100 + shoulderHalf - 2} 76 Q ${100 + shoulderHalf + 22} 84 ${100 + shoulderHalf + 16} 56`}
              fill="none"
              stroke={skinTone}
              strokeWidth={armWidth}
              strokeLinecap="round"
            />
            <circle cx={100 + shoulderHalf + 15} cy="52" r={armWidth * 0.56} fill={skinTone} />
          </g>
        ) : (
          <g>
            {/* Left relaxed/athletic arm */}
            <path
              d={`M ${100 - shoulderHalf + 2} 76 Q ${100 - shoulderHalf - 10 - bellyCurve * 0.3} 106 ${100 - shoulderHalf - 6 - bellyCurve * 0.2} 136`}
              fill="none"
              stroke={skinTone}
              strokeWidth={armWidth}
              strokeLinecap="round"
            />
            <circle
              cx={100 - shoulderHalf - 6 - bellyCurve * 0.2}
              cy="138"
              r={armWidth * 0.54}
              fill={skinTone}
            />
            {/* Right relaxed/athletic arm */}
            <path
              d={`M ${100 + shoulderHalf - 2} 76 Q ${100 + shoulderHalf + 10 + bellyCurve * 0.3} 106 ${100 + shoulderHalf + 6 + bellyCurve * 0.2} 136`}
              fill="none"
              stroke={skinTone}
              strokeWidth={armWidth}
              strokeLinecap="round"
            />
            <circle
              cx={100 + shoulderHalf + 6 + bellyCurve * 0.2}
              cy="138"
              r={armWidth * 0.54}
              fill={skinTone}
            />
          </g>
        )}

        {/* Torso / Gym Shirt */}
        <path
          d={`M ${100 - shoulderHalf} 70
              Q 100 62 ${100 + shoulderHalf} 70
              C ${100 + shoulderHalf + 3} 94, ${100 + waistHalf + bellyCurve * 0.45} 112, ${100 + waistHalf} 134
              L ${100 - waistHalf} 134
              C ${100 - waistHalf - bellyCurve * 0.45} 112, ${100 - shoulderHalf - 3} 94, ${100 - shoulderHalf} 70 Z`}
          fill={outfitColor}
        />

        {/* Female waist shaping / crop-tank strap feel or athletic trim */}
        {!isMale && (
          <path
            d={`M ${100 - shoulderHalf + 6} 68 Q 100 78 ${100 + shoulderHalf - 6} 68 L ${100 + shoulderHalf - 12} 66 Q 100 73 ${100 - shoulderHalf + 12} 66 Z`}
            fill={skinTone}
            opacity="0.35"
          />
        )}

        {/* Outfit shoulder stripes */}
        <path
          d={`M ${100 - shoulderHalf + 2} 72 L ${100 - shoulderHalf + 10} 70 L ${100 - shoulderHalf + 7} 86 L ${100 - shoulderHalf} 86 Z`}
          fill={accentColor}
          opacity="0.85"
        />
        <path
          d={`M ${100 + shoulderHalf - 2} 72 L ${100 + shoulderHalf - 10} 70 L ${100 + shoulderHalf - 7} 86 L ${100 + shoulderHalf} 86 Z`}
          fill={accentColor}
          opacity="0.85"
        />

        {/* Out-of-shape belly crease vs Fit pec/abs contour */}
        {p < 0.35 ? (
          <path
            d={`M ${100 - waistHalf * 0.6} 114 Q 100 ${124 + bellyCurve * 0.5} ${100 + waistHalf * 0.6} 114`}
            fill="none"
            stroke="#0F172A"
            strokeOpacity="0.18"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <g stroke="#FFFFFF" strokeOpacity={0.25 * p} strokeWidth="1.6" fill="none" strokeLinecap="round">
            <path d={`M ${100 - shoulderHalf * 0.55} 88 Q 100 94 ${100 + shoulderHalf * 0.55} 88`} />
            {p > 0.62 && (
              <>
                <line x1="100" y1="93" x2="100" y2="122" />
                <line x1="92" y1="104" x2="108" y2="104" />
                <line x1="93" y1="114" x2="107" y2="114" />
              </>
            )}
          </g>
        )}

        {/* Neck */}
        <rect
          x={100 - (isMale ? 8 + p * 2 : 6.5 + p * 1)}
          y="53"
          width={(isMale ? 8 + p * 2 : 6.5 + p * 1) * 2}
          height="16"
          rx="5"
          fill={skinTone}
        />

        {/* Head */}
        <g className={headClass}>
          {/* Back hair for female */}
          {!isMale && (
            <path
              d={`M 77 32 Q 70 54 78 68 L 122 68 Q 130 54 123 32 Z`}
              fill={hairColor}
            />
          )}

          {/* Face shape */}
          <path
            d={`M ${81 - (1 - p) * 3} 34
                C ${81 - (1 - p) * 3} 15, ${119 + (1 - p) * 3} 15, ${119 + (1 - p) * 3} 34
                C ${119 + (1 - p) * 3} 52, ${111 + (1 - p) * 4} 60, 100 60
                C ${89 - (1 - p) * 4} 60, ${81 - (1 - p) * 3} 52, ${81 - (1 - p) * 3} 34 Z`}
            fill={skinTone}
          />

          {/* Hair front */}
          {isMale ? (
            <path
              d={`M 79 31 C 79 14, 121 14, 121 31 C 114 23, 86 23, 79 31 Z`}
              fill={hairColor}
            />
          ) : (
            <path
              d={`M 78 33 C 79 13, 121 13, 122 33 C 114 21, 96 22, 78 33 Z`}
              fill={hairColor}
            />
          )}

          {/* Headband unlocked at fit stages */}
          {p > 0.35 && (
            <rect x="80" y="23" width="40" height="4.5" rx="2" fill="#EA580C" />
          )}

          {/* Eyes */}
          <circle cx="91" cy="37" r="2.2" fill="#0F172A" />
          <circle cx="109" cy="37" r="2.2" fill="#0F172A" />

          {/* Eyebrows (tired slant vs determined) */}
          {isTired || p < 0.25 ? (
            <g stroke={hairColor} strokeWidth="1.8" strokeLinecap="round">
              <line x1="87" y1="32" x2="94" y2="30" />
              <line x1="106" y1="30" x2="113" y2="32" />
            </g>
          ) : (
            <g stroke={hairColor} strokeWidth="1.8" strokeLinecap="round">
              <line x1="87" y1="31" x2="95" y2="32" />
              <line x1="105" y1="32" x2="113" y2="31" />
            </g>
          )}

          {/* Mouth expression */}
          {isTired ? (
            <ellipse cx="100" cy="49" rx="4.5" ry="3" fill="#991B1B" />
          ) : p < 0.3 ? (
            <path d="M 94 49 Q 100 46 106 49" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M 93 47 Q 100 53 107 47" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
          )}

          {/* Sweat drop when low fitness or tired */}
          {(isTired || p < 0.3) && (
            <path
              d="M 124 30 Q 128 36 124 39 Q 120 36 124 30 Z"
              fill="#38BDF8"
            />
          )}
        </g>
      </g>
    </svg>
  );
};
