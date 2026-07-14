/* Phone Shop Management System - Client utilities (vanilla JS) */

window.App = window.App || {};

App.TOKEN_KEY = "pss_session";
App.USER_KEY = "pss_user";

App.getToken = function () {
  return localStorage.getItem(App.TOKEN_KEY);
};
App.setToken = function (t) {
  if (t) localStorage.setItem(App.TOKEN_KEY, t);
  else localStorage.removeItem(App.TOKEN_KEY);
};
App.setUser = function (u) {
  if (u) localStorage.setItem(App.USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(App.USER_KEY);
};
App.getUser = function () {
  try {
    return JSON.parse(localStorage.getItem(App.USER_KEY) || "null");
  } catch (e) {
    return null;
  }
};
App.logout = async function () {
  try {
    await fetch("/api/auth", {
      method: "DELETE",
      headers: App.authHeaders(),
    });
  } catch (e) {}
  App.setToken(null);
  App.setUser(null);
  location.href = "/index.html";
};
App.authHeaders = function () {
  const h = { "Content-Type": "application/json" };
  const t = App.getToken();
  if (t) h["Authorization"] = "Bearer " + t;
  return h;
};

/* Auth-required gate: redirects to login if no valid session */
App.requireAuth = async function () {
  const token = App.getToken();
  if (!token) {
    location.href = "/index.html";
    return null;
  }
  try {
    const res = await fetch("/api/auth", { headers: App.authHeaders() });
    if (!res.ok) {
      App.setToken(null);
      App.setUser(null);
      location.href = "/index.html";
      return null;
    }
    const data = await res.json();
    App.setUser(data.user);
    return data.user;
  } catch (e) {
    location.href = "/index.html";
    return null;
  }
};

/* Generic API helper */
App.api = async function (path, options) {
  options = options || {};
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body !== "string" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    options.body = JSON.stringify(options.body);
  }
  const token = App.getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(path, { ...options, headers });
  const ct = res.headers.get("content-type") || "";
  let data = null;
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch (e) {}
  } else {
    // For CSV / binary responses, expose the raw response
    data = { _raw: res };
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || ("Request failed: " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

/* Toast notifications */
App.toast = function (msg, type) {
  type = type || "info";
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(10px)";
    t.style.transition = "all 0.3s";
    setTimeout(() => t.remove(), 320);
  }, 3500);
};

/* Modal helpers */
App.openModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
};
App.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
};
App.closeAllModals = function () {
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => {
    m.classList.remove("open");
  });
};

/* Currency formatter - Ghana Cedis */
App.ghs = function (n) {
  const num = Number(n) || 0;
  return "GHS " + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* Relative time */
App.timeAgo = function (d) {
  if (!d) return "";
  const date = new Date(d);
  const now = Date.now();
  const diff = now - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const days = Math.floor(h / 24);
  if (days < 30) return days + "d ago";
  return date.toLocaleDateString();
};

/* Download a blob / text as file */
App.downloadText = function (content, filename, mime) {
  const blob = new Blob([content], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
};

/* Stock badge class */
App.stockBadge = function (stock) {
  if (stock <= 0) return { cls: "stock-out", label: "Out of stock" };
  if (stock < 3) return { cls: "stock-low", label: stock + " left" };
  return { cls: "stock-ok", label: stock + " in stock" };
};

/* Default phone image fallback (random tech photo) */
App.FALLBACK_PHONES = [
  "https://images.pexels.com/photos/18311092/pexels-photo-18311092.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/14979013/pexels-photo-14979013.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/9403817/pexels-photo-9403817.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/36680544/pexels-photo-36680544.jpeg?auto=compress&cs=tinysrgb&w=600",
];
App.FALLBACK_PARTS = [
  "https://images.pexels.com/photos/6755075/pexels-photo-6755075.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6754839/pexels-photo-6754839.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/31862950/pexels-photo-31862950.jpeg?auto=compress&cs=tinysrgb&w=600",
];
App.phoneImg = function (url, idx) {
  if (url) return url;
  return App.FALLBACK_PHONES[(idx || 0) % App.FALLBACK_PHONES.length];
};
App.partImg = function (url, idx) {
  if (url) return url;
  return App.FALLBACK_PARTS[(idx || 0) % App.FALLBACK_PARTS.length];
};

/* Role labels */
App.ROLE_LABELS = {
  admin: "System Admin",
  shop_admin: "Shop Admin",
  worker: "Worker",
  repairer: "Repairer",
};

/* Seed the demo data if needed */
App.seedIfNeeded = async function () {
  try {
    const res = await fetch("/api/seed");
    if (res.ok) {
      const data = await res.json();
      if (data.seeded) {
        App._seedResult = data;
      }
    }
  } catch (e) {}
};
