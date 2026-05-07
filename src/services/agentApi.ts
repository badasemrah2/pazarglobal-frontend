import { supabase } from '../lib/supabase';

const AGENT_API_BASE =
  (import.meta.env as any).VITE_AGENT_API_BASE?.trim() ||
  (import.meta.env as any).NEXT_PUBLIC_AGENT_API_BASE?.trim() ||
  '';

export const getAgentApiBase = (): string => {
  if (!AGENT_API_BASE) {
    throw new Error(
      "VITE_AGENT_API_BASE tanımlı değil. Agent API adresini .env dosyanıza ekleyin."
    );
  }
  return AGENT_API_BASE.replace(/\/$/, '');
};

const fetchWithPathFallback = async (
  candidatePaths: string[],
  init?: RequestInit,
): Promise<Response> => {
  const base = getAgentApiBase();
  let lastResponse: Response | null = null;

  for (const path of candidatePaths) {
    const endpoint = `${base}${path}`;
    const response = await fetch(endpoint, init);
    if (response.status !== 404) {
      return response;
    }
    lastResponse = response;
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error('API endpoint bulunamadı');
};

export type CategoryOption = { id: string; label: string };

export const fetchCategoryOptions = async (): Promise<CategoryOption[]> => {
  const base = getAgentApiBase();
  const endpoint = `${base}/webchat/categories`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Kategori listesi alınamadı: ${response.status}`);
  }
  const data = (await response.json()) as { options?: CategoryOption[] };
  return Array.isArray(data.options) ? data.options : [];
};

export const fetchSupportedCategories = async (): Promise<string[]> => {
  const options = await fetchCategoryOptions();
  return options.map((o) => o.id).filter(Boolean);
};

export type PublicContactLinkResponse = {
  success: boolean;
  data?: {
    listing_id: string;
    token: string;
    contact_path: string;
  };
};

export type ContactResolveResponse = {
  success: boolean;
  data?: {
    listing: {
      id: string;
      title: string;
      status: string;
      expires_at?: string | null;
      owner_user_id?: string;
      owner_name: string;
      owner_phone?: string;
      phone_visibility: 'public' | 'hidden';
      name_visibility: 'public' | 'hidden';
    };
  };
};

export const fetchPublicContactLink = async (listingId: string): Promise<PublicContactLinkResponse> => {
  const encodedId = encodeURIComponent(listingId);
  const candidatePaths = [
    `/api/v3/contact/public-link/${encodedId}`,
    `/contact/public-link/${encodedId}`,
  ];

  const response = await fetchWithPathFallback(candidatePaths);
  if (response.ok) {
    return (await response.json()) as PublicContactLinkResponse;
  }

  // Fallback: if agent API cannot resolve listing (404), try Supabase Edge Function
  // in the same project where the listing is stored.
  if (response.status === 404) {
    const { data, error } = await supabase.functions.invoke('contact-public-link', {
      body: { listing_id: listingId },
    });

    if (!error && data?.success && data?.data?.token) {
      return data as PublicContactLinkResponse;
    }
  }

  let detail = '';
  try {
    const payload = await response.clone().json() as { detail?: string; error?: string; message?: string };
    detail = payload?.detail || payload?.error || payload?.message || '';
  } catch {
    // ignore parse errors
  }
  const suffix = detail ? ` (${detail})` : '';
  throw new Error(`Contact link alınamadı: ${response.status}${suffix}`);
};

export const resolveContactToken = async (token: string): Promise<ContactResolveResponse> => {
  const encodedToken = encodeURIComponent(token);
  const response = await fetchWithPathFallback([
    `/api/v3/contact/resolve/${encodedToken}`,
    `/contact/resolve/${encodedToken}`,
  ]);
  if (!response.ok) {
    throw new Error(`Contact token çözülemedi: ${response.status}`);
  }
  return (await response.json()) as ContactResolveResponse;
};

export const sendMessageViaContactToken = async (payload: {
  token: string;
  message: string;
  sender_name?: string;
  sender_session_id?: string;
  sender_user_id?: string;
  channel?: string;
}): Promise<{ success: boolean; data?: { conversation_id: string; message_id: string; listing_id: string } }> => {
  const response = await fetchWithPathFallback([
    '/api/v3/contact/send',
    '/contact/send',
  ], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.clone().json() as { detail?: string; error?: string; message?: string };
      detail = body?.detail || body?.error || body?.message || '';
    } catch {
      detail = '';
    }

    const suffix = detail ? ` (${detail})` : '';
    throw new Error(`Mesaj gönderilemedi: ${response.status}${suffix}`);
  }
  return (await response.json()) as { success: boolean; data?: { conversation_id: string; message_id: string; listing_id: string } };
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;

  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token;
  }

  if (!token) {
    throw new Error('Giriş oturumu bulunamadı');
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const fetchWithAuthRetry = async (
  candidatePaths: string[],
  init?: RequestInit,
): Promise<Response> => {
  const authHeaders = await getAuthHeaders();
  let response = await fetchWithPathFallback(candidatePaths, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...authHeaders,
    },
  });

  if (response.status !== 401) {
    return response;
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  const refreshedToken = refreshed.session?.access_token;
  if (!refreshedToken) {
    return response;
  }

  response = await fetchWithPathFallback(candidatePaths, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${refreshedToken}`,
    },
  });
  return response;
};

export type OwnerInboxItem = {
  id: string;
  listing_id: string;
  sender_name?: string;
  source_channel?: string;
  last_message_preview?: string;
  last_message_at?: string;
  owner_unread_count?: number;
  created_at?: string;
};

export type OwnerMessage = {
  id: string;
  conversation_id: string;
  sender_role: 'buyer' | 'owner' | 'system';
  body: string;
  created_at: string;
  read_by_owner: boolean;
  read_by_buyer: boolean;
};

export const fetchOwnerInbox = async (limit = 50): Promise<OwnerInboxItem[]> => {
  const encodedLimit = encodeURIComponent(String(limit));
  const response = await fetchWithAuthRetry([
    `/api/v3/contact/inbox?limit=${encodedLimit}`,
    `/contact/inbox?limit=${encodedLimit}`,
  ]);
  if (!response.ok) {
    throw new Error(`Mesaj kutusu alınamadı: ${response.status}`);
  }
  const data = (await response.json()) as { success: boolean; data?: OwnerInboxItem[] };
  return Array.isArray(data.data) ? data.data : [];
};

export const fetchOwnerConversationMessages = async (
  conversationId: string,
  limit = 100,
): Promise<OwnerMessage[]> => {
  const encodedConversationId = encodeURIComponent(conversationId);
  const encodedLimit = encodeURIComponent(String(limit));
  const response = await fetchWithAuthRetry([
    `/api/v3/contact/inbox/${encodedConversationId}?limit=${encodedLimit}`,
    `/contact/inbox/${encodedConversationId}?limit=${encodedLimit}`,
  ]);
  if (!response.ok) {
    throw new Error(`Mesajlar alınamadı: ${response.status}`);
  }
  const data = (await response.json()) as { success: boolean; data?: OwnerMessage[] };
  return Array.isArray(data.data) ? data.data : [];
};

export const sendOwnerReply = async (payload: { conversation_id: string; message: string }) => {
  const response = await fetchWithAuthRetry([
    '/api/v3/contact/inbox/reply',
    '/contact/inbox/reply',
  ], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Yanıt gönderilemedi: ${response.status}`);
  }
  return (await response.json()) as { success: boolean; data?: { conversation_id: string; message_id: string } };
};
