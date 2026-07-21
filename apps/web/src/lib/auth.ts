import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_PUBLIC_API_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

const ACCESS_TOKEN_KEY = "openats_access_token";
const REFRESH_TOKEN_KEY = "openats_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function ensureAuthenticated(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;

  try {
    const res = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: "admin@local.host",
      password: "admin",
    });
    const { accessToken, refreshToken } = res.data;
    setTokens(accessToken, refreshToken);
    return accessToken;
  } catch (err) {
    console.error("Auto-login failed:", err);
    return null;
  }
}
