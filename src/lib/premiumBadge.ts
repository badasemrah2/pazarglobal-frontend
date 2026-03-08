export type PremiumBadgeId = 'gold' | 'platinum' | 'diamond';

type PremiumBadgeUI = {
  id: PremiumBadgeId | null;
  label: string;
  icon: string;
  className: string;
};

export function getPremiumBadgeUI(badge: string | null | undefined): PremiumBadgeUI {
  const id = String(badge || '').trim().toLowerCase();

  if (id === 'gold') {
    return {
      id: 'gold' as const,
      label: 'GOLD',
      icon: 'ri-arrow-up-line',
      className: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
    };
  }

  if (id === 'platinum') {
    return {
      id: 'platinum' as const,
      label: 'PLATINUM',
      icon: 'ri-vip-crown-line',
      className: 'bg-gradient-to-r from-slate-400 to-slate-500',
    };
  }

  if (id === 'diamond') {
    return {
      id: 'diamond' as const,
      label: 'DIAMOND',
      icon: 'ri-vip-diamond-fill',
      className: 'bg-gradient-to-r from-cyan-400 to-blue-500',
    };
  }

  return {
    id: null,
    label: 'PREMIUM',
    icon: 'ri-vip-crown-fill',
    className: 'bg-gradient-to-r from-amber-400 to-orange-500',
  };
}
