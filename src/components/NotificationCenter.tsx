import React from 'react';
import { PlayerStats, PushNotificationItem } from '../types/game';
import { Bell, X, Send } from 'lucide-react';

interface NotificationCenterProps {
  player: PlayerStats;
  notifications: PushNotificationItem[];
  browserPermission: NotificationPermission | 'unsupported';
  onRequestBrowserPush: () => void;
  onTogglePush: () => void;
  onSendTestPush: () => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  player,
  notifications,
  browserPermission,
  onRequestBrowserPush,
  onTogglePush,
  onSendTestPush,
  onMarkAllRead,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
      <div className="bg-[#141414] border-l border-white/10 w-full max-w-md h-full flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Notificaciones Push
            </h2>
            <p className="text-xs text-white/50">Alertas motivacionales del coach y liga semanal</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar notificaciones"
            className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Bar */}
        <div className="p-4 bg-white/[0.03] border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Recordatorios motivacionales</div>
              <div className="text-[11px] text-white/50">
                Avisos periódicos de hidratación, racha y rivales
              </div>
            </div>
            <button
              onClick={onTogglePush}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                player.pushEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-white/75'
              }`}
            >
              {player.pushEnabled ? 'Activas' : 'Pausadas'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSendTestPush}
              className="flex-1 py-2 px-3 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Enviar Push Motivacional
            </button>
            {browserPermission !== 'unsupported' && browserPermission !== 'granted' && (
              <button
                onClick={onRequestBrowserPush}
                className="py-2 px-3 bg-white hover:bg-white/85 text-black text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                Permitir Push Sistema
              </button>
            )}
          </div>
          {browserPermission === 'granted' && (
            <p className="text-[11px] text-emerald-400 font-medium">
              Notificaciones del navegador habilitadas.
            </p>
          )}
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50 font-medium">Historial reciente</span>
            {notifications.some((n) => !n.read) && (
              <button
                onClick={onMarkAllRead}
                className="text-orange-500 font-semibold hover:underline cursor-pointer"
              >
                Marcar todo leído
              </button>
            )}
          </div>

          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3.5 rounded-xl border ${
                n.read ? 'bg-[#141414] border-white/10' : 'bg-orange-500/10 border-orange-500/30'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span className="font-semibold text-orange-400">{n.category}</span>
                <span>{n.timeLabel}</span>
              </div>
              <h4 className="font-display uppercase italic font-black text-xl leading-tight text-white mt-0.5">{n.title}</h4>
              <p className="text-xs text-white/60 mt-1">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
