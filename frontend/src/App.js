import React, { useState, useEffect, useCallback } from "react";
import { getUrls, addUrl, deleteUrl, triggerScrape, getLatestResults } from "./api";

/* ── Axis Bank Brand Palette ───────────────────────────────────── */
const AX = {
  burgundy: "#97144D",         /* Axis signature burgundy */
  burgundyDark: "#6E0F3A",     /* dark burgundy */
  burgundyLight: "#B8446E",    /* light burgundy */
  pink: "#F9E8EF",             /* soft pink background */
  cream: "#FFF8FA",            /* cream background */
  warmGray: "#F5F2F3",         /* page background */
  gold: "#8B6914",             /* gold accent */
  goldLight: "#F5ECD7",        /* light gold tint */
  white: "#FFFFFF",
  dark: "#1A1A1A",
  gray: "#6B5F63",
  lightGray: "#E5DEE0",
  green: "#2E7D32",            /* success green */
  greenBg: "#E8F5E9",
};

const STYLES = {
  app: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    maxWidth: 1200,
    margin: "0 auto",
    padding: 0,
    background: AX.warmGray,
    minHeight: "100vh",
  },
  topBar: {
    background: AX.burgundy,
    padding: "8px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarText: { color: AX.white, fontSize: 11, opacity: 0.8 },
  header: {
    background: `linear-gradient(135deg, ${AX.burgundy} 0%, ${AX.burgundyDark} 60%, #003E24 100%)`,
    color: AX.white,
    padding: "28px 40px",
    marginBottom: 0,
    position: "relative",
    overflow: "hidden",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 300,
    height: "100%",
    background: `linear-gradient(135deg, transparent 30%, rgba(0,145,90,0.15) 100%)`,
  },
  h1: { margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-0.5px", position: "relative", zIndex: 1 },
  subtitle: { margin: "8px 0 0", opacity: 0.8, fontSize: 13, position: "relative", zIndex: 1, fontWeight: 400 },
  brandAccent: {
    width: "100%",
    height: 4,
    background: `linear-gradient(90deg, ${AX.burgundy} 0%, ${AX.burgundyLight} 50%, ${AX.gold} 100%)`,
  },
  body: { padding: "24px 32px" },
  card: {
    background: AX.white,
    borderRadius: 8,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,145,90,0.06)",
    border: `1px solid ${AX.lightGray}`,
  },
  cardTitle: { margin: "0 0 16px", fontSize: 17, color: AX.burgundy, fontWeight: 600 },
  row: { display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" },
  inputGroup: { display: "flex", flexDirection: "column", flex: 1, minWidth: 200 },
  label: { fontSize: 12, fontWeight: 600, color: AX.gray, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" },
  input: {
    padding: "10px 14px",
    border: `1px solid ${AX.lightGray}`,
    borderRadius: 4,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  },
  btnPrimary: {
    padding: "10px 24px",
    background: AX.burgundy,
    color: AX.white,
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.2s",
  },
  btnDanger: {
    padding: "6px 14px",
    background: AX.pink,
    color: AX.white,
    border: "none",
    borderRadius: 4,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 500,
  },
  btnSuccess: {
    padding: "12px 28px",
    background: `linear-gradient(135deg, ${AX.burgundy}, ${AX.burgundyLight})`,
    color: AX.white,
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.3px",
  },
  btnOutline: {
    padding: "10px 20px",
    background: "transparent",
    color: AX.burgundy,
    border: `2px solid ${AX.burgundy}`,
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnGold: {
    padding: "10px 24px",
    background: `linear-gradient(135deg, ${AX.burgundyLight}, #2E9E5E)`,
    color: AX.white,
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    background: AX.cream,
    borderBottom: `2px solid ${AX.burgundy}`,
    fontWeight: 600,
    color: AX.burgundy,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  td: { padding: "9px 12px", borderBottom: `1px solid ${AX.lightGray}` },
  badge: (color) => ({
    display: "inline-block",
    padding: "3px 12px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: color === "senior" ? AX.goldLight : color === "general" ? "#E0F2E9" : "#E8F0E6",
    color: color === "senior" ? "#1B5E20" : color === "general" ? AX.burgundy : "#2E7D32",
    border: `1px solid ${color === "senior" ? "#66BB6A" : color === "general" ? "#81C784" : "#A5D6A7"}`,
  }),
  alert: (type) => ({
    padding: "12px 16px",
    borderRadius: 4,
    marginBottom: 16,
    fontSize: 13,
    background: type === "error" ? "#FDE7E9" : type === "success" ? AX.greenBg : AX.goldLight,
    color: type === "error" ? "#A80000" : type === "success" ? "#0E6B32" : "#7A5C00",
    borderLeft: `4px solid ${type === "error" ? AX.pink : type === "success" ? AX.green : AX.gold}`,
  }),
  spinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    border: `3px solid rgba(255,255,255,0.3)`,
    borderTopColor: AX.white,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginRight: 8,
    verticalAlign: "middle",
  },
  statsCard: {
    background: `linear-gradient(135deg, ${AX.burgundy}, ${AX.burgundyDark})`,
    color: AX.white,
    borderRadius: 8,
    padding: "16px 20px",
    textAlign: "center",
    flex: 1,
    minWidth: 140,
  },
  statsNum: { fontSize: 28, fontWeight: 700, margin: "4px 0" },
  statsLabel: { fontSize: 11, textTransform: "uppercase", opacity: 0.8, letterSpacing: "0.5px" },
  bankSection: {
    border: `1px solid ${AX.lightGray}`,
    borderRadius: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  bankHeader: {
    background: AX.cream,
    padding: "14px 20px",
    borderBottom: `2px solid ${AX.burgundy}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bankName: { fontSize: 16, fontWeight: 700, color: AX.burgundy, margin: 0 },
  rateHighlight: {
    background: AX.goldLight,
    border: `1px solid ${AX.gold}`,
    borderRadius: 6,
    padding: "12px 16px",
    margin: "12px 20px",
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
    alignItems: "center",
  },
};

function App() {
  const [urls, setUrls] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [newBank, setNewBank] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }
  const [activeTab, setActiveTab] = useState("urls"); // "urls" | "results"

  const loadUrls = useCallback(async () => {
    try {
      const data = await getUrls();
      setUrls(data);
    } catch {
      setMessage({ type: "error", text: "Failed to load URLs." });
    }
  }, []);

  useEffect(() => {
    loadUrls();
  }, [loadUrls]);

  const handleAddUrl = async (e) => {
    e.preventDefault();
    if (!newUrl.trim() || !newBank.trim()) return;
    try {
      setLoading(true);
      await addUrl(newUrl.trim(), newBank.trim());
      setNewUrl("");
      setNewBank("");
      setMessage({ type: "success", text: "URL added successfully." });
      await loadUrls();
    } catch {
      setMessage({ type: "error", text: "Failed to add URL." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUrl(id);
      setMessage({ type: "success", text: "URL removed." });
      await loadUrls();
    } catch {
      setMessage({ type: "error", text: "Failed to delete URL." });
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    setMessage({ type: "info", text: "Scraping in progress... This may take a few minutes." });
    try {
      const data = await triggerScrape();
      setResults(data.data);
      setMessage({
        type: "success",
        text: `Done! Extracted rates from ${data.data?.total_banks || 0} banks. Blob: ${data.blob_url || "N/A"}`,
      });
      setActiveTab("results");
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setScraping(false);
    }
  };

  const handleLoadLatest = async () => {
    try {
      const data = await getLatestResults();
      if (data) {
        setResults(data);
        setActiveTab("results");
      } else {
        setMessage({ type: "info", text: "No previous results found." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load results." });
    }
  };

  return (
    <div style={STYLES.app}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #00915A !important; box-shadow: 0 0 0 2px rgba(0,145,90,0.12); }
        tr:hover td { background: #F0F7F4; }
        button:hover { opacity: 0.9; }
      `}</style>

      {/* Top Bar */}
      <div style={STYLES.topBar}>
        <span style={STYLES.topBarText}>FD Rate Intelligence Platform</span>
        <span style={STYLES.topBarText}>Powered by Azure AI Foundry</span>
      </div>

      {/* Header */}
      <div style={STYLES.header}>
        <div style={STYLES.headerOverlay} />
        <h1 style={STYLES.h1}>
          <span style={{ fontSize: 18, marginRight: 10, verticalAlign: 'middle' }}>★★★★</span>
          Fixed Deposit Rate Scraper
        </h1>
        <p style={STYLES.subtitle}>
          AI-powered extraction of FD rates across banks &mdash; Senior Citizens, General &amp; all categories
        </p>
      </div>

      {/* Gold accent line */}
      <div style={STYLES.brandAccent} />

      <div style={STYLES.body}>
        {/* Message */}
        {message && (
          <div style={STYLES.alert(message.type)}>
            {message.text}
            <span
              onClick={() => setMessage(null)}
              style={{ float: "right", cursor: "pointer", fontWeight: "bold", fontSize: 16 }}
            >
              &times;
            </span>
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            style={activeTab === "urls" ? STYLES.btnPrimary : STYLES.btnOutline}
            onClick={() => setActiveTab("urls")}
          >
            Manage URLs ({urls.length})
          </button>
          <button
            style={activeTab === "results" ? STYLES.btnPrimary : STYLES.btnOutline}
            onClick={() => setActiveTab("results")}
          >
            View Results {results ? `(${results.total_banks} banks)` : ""}
          </button>
        </div>

        {/* ── URLs Tab ── */}
        {activeTab === "urls" && (
          <>
            {/* Add URL Form */}
            <div style={STYLES.card}>
              <h3 style={STYLES.cardTitle}>Add Bank URL</h3>
              <form onSubmit={handleAddUrl}>
                <div style={STYLES.row}>
                  <div style={STYLES.inputGroup}>
                    <label style={STYLES.label}>Bank Name</label>
                    <input
                      style={STYLES.input}
                      placeholder="e.g., State Bank of India"
                      value={newBank}
                      onChange={(e) => setNewBank(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ ...STYLES.inputGroup, flex: 2 }}>
                    <label style={STYLES.label}>FD Rates Page URL</label>
                    <input
                      style={STYLES.input}
                      type="url"
                      placeholder="https://www.sbi.co.in/web/interest-rates/deposit-rates/retail-domestic-term-deposits"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    style={{ ...STYLES.btnPrimary, opacity: loading ? 0.7 : 1 }}
                    disabled={loading}
                  >
                    {loading ? "Adding..." : "+ Add URL"}
                  </button>
                </div>
              </form>
            </div>

            {/* URL List */}
            <div style={STYLES.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ ...STYLES.cardTitle, margin: 0 }}>
                  Configured Banks ({urls.length})
                </h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={STYLES.btnGold} onClick={handleLoadLatest}>
                    Load Latest Results
                  </button>
                  <button
                    style={{ ...STYLES.btnSuccess, opacity: scraping || !urls.length ? 0.6 : 1 }}
                    onClick={handleScrape}
                    disabled={scraping || !urls.length}
                  >
                    {scraping ? (
                      <>
                        <span style={STYLES.spinner} />
                        Scraping...
                      </>
                    ) : (
                      "Scrape All FD Rates"
                    )}
                  </button>
                </div>
              </div>

              {urls.length === 0 ? (
                <p style={{ color: AX.gray, textAlign: "center", padding: 32 }}>
                  No URLs added yet. Add a bank FD rates page URL above to get started.
                </p>
              ) : (
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={STYLES.th}>#</th>
                      <th style={STYLES.th}>Bank</th>
                      <th style={STYLES.th}>URL</th>
                      <th style={STYLES.th}>Added</th>
                      <th style={STYLES.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urls.map((u, i) => (
                      <tr key={u.id}>
                        <td style={{ ...STYLES.td, color: AX.gray, fontWeight: 600 }}>{i + 1}</td>
                        <td style={STYLES.td}>
                          <strong style={{ color: AX.burgundy }}>{u.bank_name}</strong>
                        </td>
                        <td style={STYLES.td}>
                          <a
                            href={u.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: AX.burgundyLight, wordBreak: "break-all", fontSize: 12 }}
                          >
                            {u.url.length > 55 ? u.url.slice(0, 55) + "..." : u.url}
                          </a>
                        </td>
                        <td style={{ ...STYLES.td, fontSize: 12, color: AX.gray }}>
                          {u.added_at ? new Date(u.added_at).toLocaleDateString() : "—"}
                        </td>
                        <td style={STYLES.td}>
                          <button style={STYLES.btnDanger} onClick={() => handleDelete(u.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── Results Tab ── */}
        {activeTab === "results" && (
          <>
            {!results ? (
              <div style={{ ...STYLES.card, textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <p style={{ color: AX.gray, fontSize: 15, margin: 0 }}>
                  No results yet. Go to "Manage URLs" tab, add URLs, and click "Scrape All FD Rates".
                </p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                  <div style={STYLES.statsCard}>
                    <div style={STYLES.statsLabel}>Total Banks</div>
                    <div style={STYLES.statsNum}>{results.total_banks}</div>
                  </div>
                  <div style={{ ...STYLES.statsCard, background: `linear-gradient(135deg, #2E7D32, #1B5E20)` }}>
                    <div style={STYLES.statsLabel}>Total Rates</div>
                    <div style={STYLES.statsNum}>
                      {results.banks.reduce((s, b) => s + (b.rates?.length || 0), 0)}
                    </div>
                  </div>
                  <div style={{ ...STYLES.statsCard, background: `linear-gradient(135deg, ${AX.green}, #0E6B32)` }}>
                    <div style={STYLES.statsLabel}>Categories Found</div>
                    <div style={STYLES.statsNum}>
                      {new Set(results.banks.flatMap((b) => (b.rates || []).map((r) => r.category))).size}
                    </div>
                  </div>
                  <div style={{ ...STYLES.statsCard, background: `linear-gradient(135deg, ${AX.burgundyLight}, #00C67A)` }}>
                    <div style={STYLES.statsLabel}>Generated</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>
                      {new Date(results.generated_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Category Filter */}
                <ResultsView results={results} />
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "20px 0 32px", fontSize: 12, color: AX.gray }}>
        <span style={{ color: AX.burgundy, fontWeight: 700 }}>★★★★</span>{" "}
        FD Rate Scraper &mdash; Built with Azure AI Foundry &bull; BNP Paribas Theme
      </div>
    </div>
  );
}

/* ── Results View Component with filtering ── */
function ResultsView({ results }) {
  const [filterCategory, setFilterCategory] = useState("all");
  const [expandedBanks, setExpandedBanks] = useState(
    () => new Set(results.banks.map((_, i) => i))
  );

  const allCategories = [
    ...new Set(results.banks.flatMap((b) => (b.rates || []).map((r) => r.category))),
  ].sort();

  const toggleBank = (i) => {
    setExpandedBanks((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const getBadgeType = (cat) => {
    const lc = (cat || "").toLowerCase();
    if (lc.includes("senior")) return "senior";
    if (lc.includes("general") || lc.includes("regular")) return "general";
    return "other";
  };

  const getMaxRate = (rates) => {
    if (!rates || !rates.length) return null;
    return Math.max(...rates.map((r) => r.rate_percent || 0));
  };

  return (
    <>
      {/* Category Filter */}
      <div style={{ ...STYLES.card, padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: AX.burgundy, marginRight: 8 }}>
            FILTER BY CATEGORY:
          </span>
          <button
            onClick={() => setFilterCategory("all")}
            style={{
              padding: "4px 14px",
              borderRadius: 14,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: filterCategory === "all" ? AX.burgundy : AX.lightGray,
              color: filterCategory === "all" ? AX.white : AX.dark,
            }}
          >
            All
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: "4px 14px",
                borderRadius: 14,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: filterCategory === cat ? AX.burgundy : AX.lightGray,
                color: filterCategory === cat ? AX.white : AX.dark,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Per-Bank Results */}
      {results.banks.map((bank, i) => {
        const filteredRates =
          filterCategory === "all"
            ? bank.rates || []
            : (bank.rates || []).filter((r) => r.category === filterCategory);

        if (filterCategory !== "all" && filteredRates.length === 0) return null;

        const maxRate = getMaxRate(filteredRates);
        const isExpanded = expandedBanks.has(i);

        return (
          <div key={i} style={STYLES.bankSection}>
            {/* Bank Header */}
            <div
              style={{ ...STYLES.bankHeader, cursor: "pointer" }}
              onClick={() => toggleBank(i)}
            >
              <div>
                <h4 style={STYLES.bankName}>
                  <span style={{ marginRight: 8 }}>{isExpanded ? "▾" : "▸"}</span>
                  {bank.bank_name}
                  {bank.error && (
                    <span style={{ ...STYLES.badge("other"), marginLeft: 10 }}>Error</span>
                  )}
                </h4>
                <span style={{ fontSize: 11, color: AX.gray }}>
                  {filteredRates.length} rates &bull;{" "}
                  <a href={bank.source_url} target="_blank" rel="noopener noreferrer" style={{ color: AX.burgundyLight }}>
                    Source
                  </a>
                </span>
              </div>
              {maxRate && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: AX.gray, textTransform: "uppercase" }}>Best Rate</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: AX.green }}>{maxRate.toFixed(2)}%</div>
                </div>
              )}
            </div>

            {bank.error && (
              <div style={{ ...STYLES.alert("error"), margin: "12px 20px", borderRadius: 4 }}>
                {bank.error}
              </div>
            )}

            {isExpanded && filteredRates.length > 0 && (
              <>
                {/* Highlight: Best Senior Citizen rate */}
                {(() => {
                  const seniorRates = filteredRates.filter((r) =>
                    (r.category || "").toLowerCase().includes("senior")
                  );
                  const bestSenior = seniorRates.length
                    ? seniorRates.reduce((a, b) => ((a.rate_percent || 0) > (b.rate_percent || 0) ? a : b))
                    : null;
                  return bestSenior ? (
                    <div style={STYLES.rateHighlight}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: AX.gold }}>
                        ★ BEST SENIOR CITIZEN RATE
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: AX.burgundy }}>
                        {bestSenior.rate_percent}%
                      </span>
                      <span style={{ fontSize: 12, color: AX.gray }}>
                        {bestSenior.tenor_description}
                        {bestSenior.amount_slab ? ` · ${bestSenior.amount_slab}` : ""}
                      </span>
                    </div>
                  ) : null;
                })()}

                {/* Rates Table */}
                <div style={{ padding: "0 0 8px", overflowX: "auto" }}>
                  <table style={STYLES.table}>
                    <thead>
                      <tr>
                        <th style={STYLES.th}>Category</th>
                        <th style={STYLES.th}>Tenor / Tenure</th>
                        <th style={STYLES.th}>Rate (%)</th>
                        <th style={STYLES.th}>Amount Slab</th>
                        <th style={STYLES.th}>Scheme</th>
                        <th style={STYLES.th}>Effective Date</th>
                        <th style={STYLES.th}>Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRates.map((r, j) => (
                        <tr key={j}>
                          <td style={STYLES.td}>
                            <span style={STYLES.badge(getBadgeType(r.category))}>
                              {r.category}
                            </span>
                          </td>
                          <td style={STYLES.td}>{r.tenor_description || "—"}</td>
                          <td style={{
                            ...STYLES.td,
                            fontWeight: 700,
                            fontSize: 14,
                            color: r.rate_percent === maxRate ? AX.green : AX.dark,
                          }}>
                            {r.rate_percent != null ? `${r.rate_percent}%` : "—"}
                          </td>
                          <td style={STYLES.td}>{r.amount_slab || "—"}</td>
                          <td style={STYLES.td}>{r.scheme_name || "—"}</td>
                          <td style={{ ...STYLES.td, fontSize: 12 }}>{r.effective_date || "—"}</td>
                          <td style={{ ...STYLES.td, fontSize: 12, color: AX.gray }}>{r.additional_info || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {isExpanded && filteredRates.length === 0 && !bank.error && (
              <p style={{ padding: "16px 20px", color: AX.gray, fontStyle: "italic", margin: 0 }}>
                No rates extracted for this bank.
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}

export default App;
