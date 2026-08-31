'use client';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export async function exportCsv(type: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams({ type, ...filters });
  const token = getAccessToken();

  const response = await fetch(`/api/exports?${params.toString()}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Export failed');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export const ExportTypes = {
  AUDIT_LOGS: 'audit-logs',
  DISPATCHER_PERFORMANCE: 'dispatcher-performance',
  DRIVER_DETAILS: 'driver-details',
  COMPANY_PERFORMANCE: 'company-performance',
  MAIN_FINANCIAL: 'main-financial',
} as const;