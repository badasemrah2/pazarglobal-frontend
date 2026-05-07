type ViewerIdentityInput = {
  userId?: string | null;
  customUserId?: string | null;
};

export function resolveViewerUserId(input: ViewerIdentityInput = {}): string {
  const direct = String(input.customUserId || input.userId || '').trim();
  if (direct) {
    return direct;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return String(window.localStorage.getItem('user_id') || '').trim();
  } catch {
    return '';
  }
}

export function isOwnedByViewer(viewerUserId?: string | null, ownerUserId?: string | null): boolean {
  const viewer = String(viewerUserId || '').trim();
  const owner = String(ownerUserId || '').trim();
  return Boolean(viewer) && viewer === owner;
}