import React, { useEffect, useMemo, useState } from "react";
import { getAuthToken, me, logout as apiLogout, setAuthToken } from "./api";
import { ConfigPage } from "./pages/ConfigPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { PriceCalculatorPage } from "./pages/PriceCalculatorPage";
import { ReverseCalculatorPage } from "./pages/ReverseCalculatorPage";

type Tab = "calculator" | "reverse" | "history" | "config";
type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;
  return "light"; // Default to light theme
}

export function App() {
  const [tab, setTab] = useState<Tab>("reverse");
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(!!getAuthToken());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) {
          setIsAuthed(false);
          setUserId(null);
          setAuthChecked(true);
        }
        return;
      }
      try {
        const res = await me();
        if (!cancelled) {
          setIsAuthed(true);
          setUserId(res.user_id);
          setAuthChecked(true);
        }
      } catch {
        setAuthToken(null);
        if (!cancelled) {
          setIsAuthed(false);
          setUserId(null);
          setAuthChecked(true);
        }
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const content = useMemo(() => {
    if (!authChecked) return <div className="card">Loading…</div>;
    if (!isAuthed)
      return (
        <LoginPage
          onLoggedIn={async () => {
            try {
              const res = await me();
              setIsAuthed(true);
              setUserId(res.user_id);
            } catch {
              setAuthToken(null);
              setIsAuthed(false);
              setUserId(null);
            }
          }}
        />
      );
    if (tab === "config") return <ConfigPage />;
    if (tab === "history") return <HistoryPage />;
    if (tab === "reverse") return <ReverseCalculatorPage />;
    return <PriceCalculatorPage />;
  }, [tab, authChecked, isAuthed]);

  return (
    <div className="app">
      {isAuthed && (
        <header className="header">
          <div className="header__title">Fish Pricing System</div>
          <div className="header__right">
            <div className="tabs" aria-label="Auth">
              <span className="tab" aria-label="Signed in user" title="Signed in user">
                {userId ?? "Signed in"}
              </span>
              <button
                className="tab"
                type="button"
                onClick={async () => {
                  try {
                    await apiLogout();
                  } catch {
                    // Ignore logout errors
                  }
                  setAuthToken(null);
                  setIsAuthed(false);
                  setUserId(null);
                }}
              >
                Logout
              </button>
            </div>
            <nav className="tabs" aria-label="Primary">
              <button
                className={`tab ${tab === "calculator" ? "tab--active" : ""}`}
                onClick={() => setTab("calculator")}
                type="button"
                disabled={!isAuthed}
              >
                Price Calculator
              </button>
              <button
                className={`tab ${tab === "reverse" ? "tab--active" : ""}`}
                onClick={() => setTab("reverse")}
                type="button"
                disabled={!isAuthed}
              >
                Yield & Price Calculator
              </button>
              <button
                className={`tab ${tab === "history" ? "tab--active" : ""}`}
                onClick={() => setTab("history")}
                type="button"
                disabled={!isAuthed}
              >
                History
              </button>
              <button
                className={`tab ${tab === "config" ? "tab--active" : ""}`}
                onClick={() => setTab("config")}
                type="button"
                disabled={!isAuthed}
              >
                Configuration
              </button>
            </nav>

            <button
              className="tab"
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>
        </header>
      )}

      <main className={`main ${!isAuthed ? "main--login" : ""}`}>{content}</main>

      {isAuthed && (
        <footer className="footer">
          Backend: <span className="mono">http://127.0.0.1:8010</span>
        </footer>
      )}
    </div>
  );
}


