import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'Expired';
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface Props {
  daysRemaining: number;
  expiresAt?: string | null;
  licenseType: string;
  onDismiss?: () => void;
}

export const SubscriptionBanner: React.FC<Props> = ({ daysRemaining, expiresAt, licenseType, onDismiss }) => {
  if (licenseType === 'LIFETIME' || daysRemaining > 5) return null;

  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining <= 0;

  const [countdownLabel, setCountdownLabel] = useState<string>(() => {
    if (isExpired) return 'Expired';
    return expiresAt ? formatCountdown(new Date(expiresAt).getTime() - Date.now()) : `${daysRemaining}d`;
  });

  useEffect(() => {
    if (isExpired || !expiresAt) return;
    const tick = () => setCountdownLabel(formatCountdown(new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [expiresAt, isExpired]);

  const bgClass = isExpired
    ? 'bg-red-900/80 border-red-500/50'
    : isUrgent
    ? 'bg-orange-900/80 border-orange-500/50'
    : 'bg-yellow-900/60 border-yellow-500/40';

  const textClass = isExpired ? 'text-red-200' : isUrgent ? 'text-orange-200' : 'text-yellow-200';

  const message = isExpired
    ? 'Your subscription has expired. Renew now to continue.'
    : `Subscription expires in ${countdownLabel}. Please renew.`;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${bgClass}`}>
      <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${textClass}`} />
      <span className={`text-sm font-medium flex-1 font-mono ${textClass}`}>{message}</span>
      <button
        onClick={async () => {
          if ((window as any).electronAPI) {
            await (window as any).electronAPI.invoke('app:open-renewal-page');
          }
        }}
        className="text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition"
      >
        Renew Now
      </button>
      {onDismiss && !isExpired && (
        <button onClick={onDismiss} className="text-white/50 hover:text-white transition">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
