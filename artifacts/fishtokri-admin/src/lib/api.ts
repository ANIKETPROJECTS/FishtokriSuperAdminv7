function getToken() { return localStorage.getItem("fishtokri_token") || ""; }
function getBase() { return import.meta.env.BASE_URL?.replace(/\/$/, "") || ""; }

export function getCurrentAdmin(): { name: string; email: string } {
  try {
    const a = JSON.parse(localStorage.getItem("fishtokri_admin") || "{}");
    return { name: a.name || a.email || "", email: a.email || "" };
  } catch {
    return { name: "", email: "" };
  }
}

export function getCurrentAdminScope(): {
  role: string;
  superHubIds: string[];
  subHubIds: string[];
} {
  try {
    const a = JSON.parse(localStorage.getItem("fishtokri_admin") || "{}");
    return {
      role: typeof a.role === "string" ? a.role : "",
      superHubIds: Array.isArray(a.superHubIds)
        ? a.superHubIds.filter((x: any) => typeof x === "string")
        : [],
      subHubIds: Array.isArray(a.subHubIds)
        ? a.subHubIds.filter((x: any) => typeof x === "string")
        : [],
    };
  } catch {
    return { role: "", superHubIds: [], subHubIds: [] };
  }
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${getBase()}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Request failed");
  }
  return res.json();
}

export function formatRupees(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateDDMMYYYY(d: any) {
  if (!d) return "—";
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
