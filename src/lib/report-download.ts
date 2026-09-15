'use client';

/**
 * Downloads a truck detailed report (CSV) via authenticated fetch.
 * Cannot use a plain <a href> because /api/* requires a Bearer token
 * (enforced by middleware), so we fetch → blob → programmatic click.
 */
export async function downloadTruckReport(truckId: string, driverName: string): Promise<void> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const res = await fetch(`/api/owner/trucks/${truckId}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = 'Failed to export report';
    try {
      const data = await res.json();
      if (data?.error?.message) message = data.error.message;
    } catch {
      // non-JSON error body — keep default message
    }
    throw new Error(message);
  }

  const blob = await res.blob();

  // Prefer the server-provided filename from Content-Disposition
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fallbackName = `truck-report-${driverName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${new Date().toISOString().slice(0, 10)}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
