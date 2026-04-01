export const EXAMPLE_LISTING_OWNER_ID = '3ec55e9d-93e8-40c5-8e0e-7dc933da997f';

type ExampleListingBadgeUI = {
  label: string;
  icon: string;
  solidClassName: string;
  softClassName: string;
  note: string;
};

const EXAMPLE_LISTING_BADGE_UI: ExampleListingBadgeUI = {
  label: 'Örnek İlan',
  icon: 'ri-information-line',
  solidClassName: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
  softClassName: 'border border-amber-200 bg-amber-50 text-amber-800',
  note: 'Bu ilan, platform tanıtımı için yayınlanmış örnek ilandır.',
};

export function isExampleListingOwner(userId?: string | null): boolean {
  return String(userId || '').trim() === EXAMPLE_LISTING_OWNER_ID;
}

export function getExampleListingBadgeUI(): ExampleListingBadgeUI {
  return EXAMPLE_LISTING_BADGE_UI;
}