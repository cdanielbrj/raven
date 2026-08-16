export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
