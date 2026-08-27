'use client';

class ApiClient {
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  getUser() {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  setUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  async refreshTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        this.clearTokens();
        return false;
      }

      const data = await res.json();
      if (data.success) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(path, { ...options, headers });

    // If 401, try refreshing tokens
    if (res.status === 401) {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        const newToken = this.getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryRes = await fetch(path, { ...options, headers });
          const data = await retryRes.json();
          if (!retryRes.ok) throw { status: retryRes.status, ...data.error };
          return data.data;
        }
      }
      this.clearTokens();
      throw { status: 401, code: 'UNAUTHORIZED', message: 'Session expired' };
    }

    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data.error };
    return data.data;
  }

  get<T = any>(path: string) { return this.request<T>(path); }
  post<T = any>(path: string, body: any) { return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) }); }
  put<T = any>(path: string, body: any) { return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) }); }
  del<T = any>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();
