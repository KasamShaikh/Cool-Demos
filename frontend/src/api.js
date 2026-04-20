const API_BASE = process.env.REACT_APP_API_URL || "/api";

export async function getUrls() {
  const res = await fetch(`${API_BASE}/urls`);
  if (!res.ok) throw new Error("Failed to fetch URLs");
  return res.json();
}

export async function addUrl(url, bankName) {
  const res = await fetch(`${API_BASE}/urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, bank_name: bankName }),
  });
  if (!res.ok) throw new Error("Failed to add URL");
  return res.json();
}

export async function deleteUrl(id) {
  const res = await fetch(`${API_BASE}/urls/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete URL");
  return res.json();
}

export async function triggerScrape() {
  const res = await fetch(`${API_BASE}/scrape`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Scraping failed");
  }
  return res.json();
}

export async function getLatestResults() {
  const res = await fetch(`${API_BASE}/results/latest`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch results");
  }
  return res.json();
}
