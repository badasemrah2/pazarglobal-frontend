/**
 * Listing expiry countdown + renewal control.
 *
 * Listings get 30 days and then stop being shown, so that finished items drop out on
 * their own - sellers almost never take them down by hand. That half was built (the
 * expires_at trigger) but the seller-facing half never was: nothing displayed the
 * remaining time and there was no way to renew, so the deadline was invisible until the
 * listing simply vanished.
 *
 * Renewal goes straight to the extend_listing RPC. Ownership is enforced inside the
 * function, not here.
 */
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export type ExpiryTone = 'expired' | 'urgent' | 'soon' | 'normal';

export interface ExpiryInfo {
  daysLeft: number;
  tone: ExpiryTone;
  label: string;
  /** Renewal is only offered when it is actually relevant, to keep the card uncluttered. */
  canRenew: boolean;
}

export function getExpiryInfo(expiresAt?: string | null, status?: string | null): ExpiryInfo | null {
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;

  const msLeft = expiry.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  if (msLeft <= 0 || status === 'expired') {
    return { daysLeft: 0, tone: 'expired', label: 'Süresi doldu', canRenew: true };
  }
  if (daysLeft <= 3) {
    return { daysLeft, tone: 'urgent', label: `${daysLeft} gün kaldı`, canRenew: true };
  }
  if (daysLeft <= 7) {
    return { daysLeft, tone: 'soon', label: `${daysLeft} gün kaldı`, canRenew: true };
  }
  return { daysLeft, tone: 'normal', label: `${daysLeft} gün kaldı`, canRenew: false };
}

const TONE_CLASSES: Record<ExpiryTone, string> = {
  expired: 'bg-red-50 text-red-700 border-red-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
  soon: 'bg-amber-50 text-amber-700 border-amber-200',
  normal: 'bg-gray-50 text-gray-600 border-gray-200',
};

const TONE_ICONS: Record<ExpiryTone, string> = {
  expired: 'ri-time-line',
  urgent: 'ri-alarm-warning-line',
  soon: 'ri-timer-line',
  normal: 'ri-time-line',
};

interface Props {
  listingId: string;
  userId: string;
  expiresAt?: string | null;
  status?: string | null;
  /** Called with the new expires_at so the parent can update its row without a refetch. */
  onExtended?: (expiresAt: string) => void;
  compact?: boolean;
}

export default function ListingExpiry({
  listingId,
  userId,
  expiresAt,
  status,
  onExtended,
  compact = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const info = getExpiryInfo(expiresAt, status);
  if (!info) return null;

  const handleExtend = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('extend_listing', {
        p_listing_id: listingId,
        p_user_id: userId,
        p_days: 30,
      });
      if (rpcError) throw rpcError;

      const result = data as { success?: boolean; expires_at?: string; error?: string; capped?: boolean } | null;
      if (!result?.success) {
        setError(
          result?.error === 'not_owner'
            ? 'Bu ilan size ait değil.'
            : 'Süre uzatılamadı, tekrar deneyin.',
        );
        return;
      }
      if (result.expires_at) onExtended?.(result.expires_at);
    } catch (err) {
      console.error('Süre uzatma hatası:', err);
      setError('Süre uzatılamadı, tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex items-center gap-2 flex-wrap'}>
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${TONE_CLASSES[info.tone]}`}
      >
        <i className={TONE_ICONS[info.tone]} />
        {info.label}
      </span>

      {info.canRenew && (
        <button
          type="button"
          onClick={handleExtend}
          disabled={busy}
          className="px-3 py-1 rounded-full border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 disabled:opacity-50 transition-all cursor-pointer"
        >
          {busy ? 'Uzatılıyor…' : info.tone === 'expired' ? 'Yeniden Yayınla' : '30 Gün Uzat'}
        </button>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
