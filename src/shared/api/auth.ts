import { api } from './client';
import type { LoginResult, Me, PublicTenant, Tenant } from './types';

export const authApi = {
  login: (username: string, password: string, tenant?: string) =>
    api.post<LoginResult>('/auth/login', { username, password, ...(tenant ? { tenant } : {}) }),
  me: () => api.get<Me>('/auth/me'),
  logout: () => api.post<null>('/auth/logout'),
  changePassword: (current_password: string, new_password: string) =>
    api.post<null>('/auth/change-password', { current_password, new_password }),
  publicTenant: (tenant?: string) => api.get<PublicTenant>('/public/tenant', { tenant }),
  tenant: () => api.get<Tenant>('/tenant'),
};
