import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8010";

const TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

axios.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Clear token on 401 errors (except for login endpoint)
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      setAuthToken(null);
    }
    return Promise.reject(error);
  }
);

export type LoginRequest = { user_id: string; password: string };
export type LoginResponse = { access_token: string; token_type: "bearer" };

export type Config = {
  market_handling_cost: number;
  fixed_cost: number;
  packaging_cost: number;
  delivery_cost: number;
};

export type CalculateSalePriceRequest = {
  buy_price_per_kg: number;
  wastage_percent: number;
  margin_percent: number;
  raw_fish_product_id?: number | null;
  raw_fish_product_name?: string | null;
  total_kg?: number;
  total_purchase_kg?: number;
  expiry_date?: string;
};

export type CalculateSalePriceResponse = {
  buy_price_per_gram: number;
  effective_price_per_gram: number;
  margin_price_per_gram: number;
  final_sale_price_per_gram: number;
  packet_prices: Record<string, number>;
};

export type RecordItem = {
  id: number;
  record_date: string; // YYYY-MM-DD
  created_at: string; // ISO string
  inputs: CalculateSalePriceRequest;
  config: Config;
  outputs: CalculateSalePriceResponse;
};

export type RawFishProduct = {
  id: number;
  name: string;
  created_at: string;
};

export async function getConfig() {
  const res = await axios.get<Config>(`${API_BASE_URL}/config`);
  return res.data;
}

export async function saveConfig(cfg: Config) {
  const res = await axios.post<Config>(`${API_BASE_URL}/config`, cfg);
  return res.data;
}

export async function calculateSalePrice(payload: CalculateSalePriceRequest) {
  const res = await axios.post<CalculateSalePriceResponse>(
    `${API_BASE_URL}/calculate/sale-price`,
    payload
  );
  return res.data;
}

export async function createRecord(payload: { record_date: string } & CalculateSalePriceRequest) {
  const res = await axios.post<RecordItem>(`${API_BASE_URL}/records`, payload);
  return res.data;
}

export async function listRecords(params?: { from_date?: string; to_date?: string; limit?: number }) {
  const res = await axios.get<RecordItem[]>(`${API_BASE_URL}/records`, { params });
  return res.data;
}

export async function listRawFishProducts(params?: { limit?: number }) {
  const res = await axios.get<RawFishProduct[]>(`${API_BASE_URL}/raw-fish-products`, { params });
  return res.data;
}

export async function createRawFishProduct(payload: { name: string }) {
  const res = await axios.post<RawFishProduct>(`${API_BASE_URL}/raw-fish-products`, payload);
  return res.data;
}

export async function updateRecord(
  recordId: number,
  payload: { buy_price_per_kg: number; wastage_percent: number; margin_percent: number; total_kg?: number; total_purchase_kg?: number; expiry_date?: string }
) {
  const res = await axios.patch<RecordItem>(`${API_BASE_URL}/records/${recordId}`, payload);
  return res.data;
}

export async function deleteRecord(recordId: number) {
  const res = await axios.delete<{ status: string; id: string }>(`${API_BASE_URL}/records/${recordId}`);
  return res.data;
}

export async function login(payload: LoginRequest) {
  const res = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/login`, payload);
  return res.data;
}

export async function logout() {
  const res = await axios.post<{ status: string }>(`${API_BASE_URL}/auth/logout`);
  return res.data;
}

export async function me() {
  const res = await axios.get<{ user_id: string }>(`${API_BASE_URL}/auth/me`);
  return res.data;
}


