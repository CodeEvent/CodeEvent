export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type Plan = {
  tier: string;
  self_serve: boolean;
  contact_email: string | null;
  max_sites: number;
  history_days: number;
  webhooks: boolean;
  taxii_feed: boolean;
  custom_mapping_rules: boolean;
  attack_domains: string[];
  pentapi_integration: string;
  sso: boolean;
};

export type PricingResponse = {
  trial_days: number;
  plans: Plan[];
};

export async function fetchPricing(): Promise<PricingResponse> {
  const res = await fetch(`${API_BASE_URL}/pricing`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load pricing (${res.status})`);
  return res.json();
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("access_token");
}

export function setToken(token: string): void {
  window.localStorage.setItem("access_token", token);
}

export function clearToken(): void {
  window.localStorage.removeItem("access_token");
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function signup(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Signup failed");
  const data = await res.json();
  return data.access_token;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Login failed");
  const data = await res.json();
  return data.access_token;
}

export async function fetchMe(): Promise<any> {
  const res = await authedFetch("/auth/me");
  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
  return res.json();
}

export async function fetchSightings(): Promise<any> {
  const res = await authedFetch("/sightings");
  if (res.status === 402) {
    const detail = (await res.json()).detail;
    throw new Object({ paymentRequired: true, detail });
  }
  if (!res.ok) throw new Error(`Failed to load sightings (${res.status})`);
  return res.json();
}

export async function startCheckout(tier: "standard" | "pro"): Promise<string> {
  const res = await authedFetch("/billing/checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Checkout failed");
  const data = await res.json();
  return data.checkout_url;
}
