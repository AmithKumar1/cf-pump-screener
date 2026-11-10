/**
 * Institutional Live Radar & Forensics Dashboard for Cloudflare Workers edge.
 * Provides a real-time terminal UI directly in the browser to inspect incoming tokens,
 * metadata URIs, verified socials, and forensic defense decisions.
 */

export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PumpRadar — Live Edge Forensics & Screener</title>
  <style>
    :root {
      --bg: #090d10;
      --card-bg: #10161b;
      --border: #1b242c;
      --text: #e2e8f0;
      --text-muted: #738496;
      --accent: #00d2ff;
      --green: #10b981;
      --red: #ef4444;
      --yellow: #f59e0b;
      --purple: #a855f7;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      padding: 16px;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .mono { font-family: var(--font-mono); }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .pulse-dot {
      width: 10px;
      height: 10px;
      background: var(--green);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--green);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.1);
      color: var(--green);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    /* KPI Grid */
    .metrics-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
    }
    .metric-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .metric-val {
      font-size: 22px;
      font-weight: 700;
      font-family: var(--font-mono);
    }

    /* Section & Table */
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12px;
    }
    th {
      background: #0d1216;
      color: var(--text-muted);
      font-weight: 600;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
      white-space: nowrap;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      font-family: var(--font-mono);
      text-transform: uppercase;
    }
    .badge-green { background: rgba(16, 185, 129, 0.15); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-red { background: rgba(239, 68, 68, 0.15); color: var(--red); border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-yellow { background: rgba(245, 158, 11, 0.15); color: var(--yellow); border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-purple { background: rgba(168, 85, 247, 0.15); color: var(--purple); border: 1px solid rgba(168, 85, 247, 0.3); }
    .badge-muted { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid var(--border); }

    .social-link {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(0, 210, 255, 0.08);
      color: var(--accent);
      font-size: 11px;
      margin-right: 4px;
    }
    .social-link:hover { background: rgba(0, 210, 255, 0.2); text-decoration: none; }

    /* Button */
    .btn {
      background: #19222a;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 5px 12px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
    }
    .btn:hover { background: #222d37; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="pulse-dot"></div>
      <span>PUMPRADAR <span style="color:var(--text-muted);font-weight:400;">/ EDGE FORENSICS</span></span>
      <span class="status-badge">LIVE CLOUDFLARE STREAM</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <span class="mono" id="clock" style="color:var(--text-muted);">--:--:-- UTC</span>
      <button class="btn" id="pause-btn" onclick="togglePause()">Pause Feed</button>
      <a href="https://t.me/memcoinhome_bot" target="_blank" class="btn" style="background:#2481cc;border-color:#2481cc;color:#fff;">Open @memcoinhome_bot ↗</a>
    </div>
  </header>

  <!-- Metrics Bar -->
  <div class="metrics-bar">
    <div class="metric-card">
      <div class="metric-label">Launches Logged</div>
      <div class="metric-val" id="metric-launches">--</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Live Ingestion Rate</div>
      <div class="metric-val" id="metric-rate" style="color:var(--accent);">~60/min</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Verified Socials Found</div>
      <div class="metric-val" id="metric-socials" style="color:var(--green);">--</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Serial Ruggers Blocked</div>
      <div class="metric-val" id="metric-blocked" style="color:var(--red);">--</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Alerts Dispatched</div>
      <div class="metric-val" id="metric-alerts" style="color:var(--purple);">--</div>
    </div>
  </div>

  <!-- Recent Alerts Section -->
  <div class="section-title">
    <span>🚨 Dispatched Quant Signals (@memcoinhome_bot)</span>
    <span id="alerts-count" class="mono" style="color:var(--purple);">0 Active</span>
  </div>
  <div class="table-container">
    <table id="alerts-table">
      <thead>
        <tr>
          <th>Time (UTC)</th>
          <th>Token</th>
          <th>Score</th>
          <th>Net SOL</th>
          <th>Buyers</th>
          <th>HHI</th>
          <th>Stage Flags</th>
          <th>Inspect</th>
        </tr>
      </thead>
      <tbody id="alerts-body">
        <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Awaiting high-conviction breakout signals...</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Live Ingestion Feed -->
  <div class="section-title">
    <span>⚡ Live Solana Ingestion & Metadata Forensic Stream (Auto-Refreshing)</span>
    <span id="feed-status" class="mono" style="color:var(--text-muted);">Polling every 3s</span>
  </div>
  <div class="table-container">
    <table id="events-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Time (UTC)</th>
          <th>Token (Symbol / Name)</th>
          <th>Creator Wallet</th>
          <th>Metadata Host (URI)</th>
          <th>Discovered Socials</th>
          <th>Forensic Verdict</th>
          <th>Live Links</th>
        </tr>
      </thead>
      <tbody id="events-body">
        <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">Connecting to Cloudflare Workers Edge stream...</td></tr>
      </tbody>
    </table>
  </div>

  <script>
    let isPaused = false;
    function togglePause() {
      isPaused = !isPaused;
      document.getElementById("pause-btn").innerText = isPaused ? "Resume Feed" : "Pause Feed";
      document.getElementById("feed-status").innerText = isPaused ? "Feed Paused" : "Polling every 3s";
    }

    function updateClock() {
      const now = new Date();
      document.getElementById("clock").innerText = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
    }
    setInterval(updateClock, 1000);
    updateClock();

    async function fetchLiveFeed() {
      if (isPaused) return;
      try {
        const res = await fetch("/api/live");
        if (!res.ok) return;
        const data = await res.json();

        // Update KPIs
        document.getElementById("metric-launches").innerText = data.stats.launches_logged || 0;
        document.getElementById("metric-socials").innerText = data.stats.with_socials || 0;
        document.getElementById("metric-blocked").innerText = data.stats.serial_ruggers_blocked || 0;
        document.getElementById("metric-alerts").innerText = data.stats.signals_generated || 0;
        document.getElementById("alerts-count").innerText = (data.alerts?.length || 0) + " Signals";

        // Render Alerts Table
        const alertsBody = document.getElementById("alerts-body");
        if (data.alerts && data.alerts.length > 0) {
          alertsBody.innerHTML = data.alerts.map(a => {
            const timeStr = a.created_at ? new Date(a.created_at).toISOString().replace("T", " ").slice(11, 19) : "--:--:--";
            return \`<tr>
              <td class="mono">\${timeStr}</td>
              <td><strong>\${escapeHtml(a.symbol)}</strong></td>
              <td><span class="badge badge-purple">\${Math.round(a.score)}/100</span></td>
              <td class="mono">\${Number(a.net_sol || 0).toFixed(2)} SOL</td>
              <td class="mono">\${a.unique_buyers || 0}</td>
              <td class="mono">\${Number(a.buyer_hhi || 0).toFixed(3)}</td>
              <td><span class="badge badge-green">\${escapeHtml(a.flags || 'SIGNAL')}</span></td>
              <td>
                <a href="https://photon-sol.tinyastro.io/en/lp/\${a.mint}" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;padding:3px 8px;margin-right:4px;">⚡ Photon</a>
                <a href="https://bullx.io/terminal?chainId=1399811149&address=\${a.mint}" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;padding:3px 8px;margin-right:4px;">🎯 BullX</a>
                <a href="https://gmgn.ai/sol/token/\${a.mint}" target="_blank" class="btn" style="background:#00d2ff;color:#000;font-weight:700;padding:3px 8px;margin-right:4px;">🤖 GMGN</a>
                <a href="https://dexscreener.com/solana/\${a.mint}" target="_blank" class="btn" style="padding:3px 8px;margin-right:4px;">DexS ↗</a>
                <a href="https://pump.fun/coin/\${a.mint}" target="_blank" class="btn" style="padding:3px 8px;">Pump ↗</a>
              </td>
            </tr>\`;
          }).join("");
        }

        // Render Ingested Events Table
        const eventsBody = document.getElementById("events-body");
        if (data.events && data.events.length > 0) {
          eventsBody.innerHTML = data.events.map(e => {
            const timeStr = e.time_utc ? e.time_utc.slice(11, 19) : "--:--:--";
            const shortCreator = e.creator ? e.creator.slice(0, 4) + '...' + e.creator.slice(-4) : 'unknown';
            
            // Socials Badges
            let socialsHtml = '';
            if (e.twitter) socialsHtml += \`<a href="\${escapeHtml(e.twitter)}" target="_blank" class="social-link">𝕏 Twitter</a>\`;
            if (e.telegram) socialsHtml += \`<a href="\${escapeHtml(e.telegram)}" target="_blank" class="social-link">✈️ TG</a>\`;
            if (e.website) socialsHtml += \`<a href="\${escapeHtml(e.website)}" target="_blank" class="social-link">🌐 Web</a>\`;
            if (!socialsHtml) socialsHtml = '<span class="badge badge-muted">None</span>';

            // Extract Host from URI
            let hostStr = 'unknown';
            try {
              if (e.uri) hostStr = new URL(e.uri).hostname;
            } catch (_) { hostStr = (e.uri || '').slice(0, 20); }

            // Forensic Verdict
            let verdictBadge = '';
            if (e.is_serial_rugger) {
              verdictBadge = \`<span class="badge badge-red">❌ Serial Rugger (\${e.past_launches} rugs)</span>\`;
            } else if (e.has_alert) {
              verdictBadge = '<span class="badge badge-purple">🚀 Alert Sent</span>';
            } else if (e.twitter || e.telegram || e.website) {
              verdictBadge = '<span class="badge badge-green">✅ Verified Community</span>';
            } else {
              verdictBadge = '<span class="badge badge-muted">⚪ Anonymous / No Socials</span>';
            }

            return \`<tr>
              <td class="mono" style="color:var(--text-muted);">#\${e.id}</td>
              <td class="mono">\${timeStr}</td>
              <td><strong>\${escapeHtml(e.symbol || 'PUMP')}</strong> <span style="color:var(--text-muted);font-size:11px;">\${escapeHtml(e.name || '')}</span></td>
              <td><a class="mono" href="https://solscan.io/account/\${e.creator}" target="_blank">\${shortCreator}</a></td>
              <td><span class="mono" style="font-size:11px;color:var(--text-muted);">\${escapeHtml(hostStr)}</span></td>
              <td>\${socialsHtml}</td>
              <td>\${verdictBadge}</td>
              <td>
                <a href="https://photon-sol.tinyastro.io/en/lp/\${e.mint}" target="_blank" style="color:#f59e0b;font-weight:700;">⚡Photon</a> ·
                <a href="https://bullx.io/terminal?chainId=1399811149&address=\${e.mint}" target="_blank" style="color:#10b981;font-weight:700;">🎯BullX</a> ·
                <a href="https://gmgn.ai/sol/token/\${e.mint}" target="_blank" style="color:#00d2ff;font-weight:700;">🤖GMGN</a> ·
                <a href="https://dexscreener.com/solana/\${e.mint}" target="_blank">DexS</a> ·
                <a href="https://pump.fun/coin/\${e.mint}" target="_blank">Pump</a>
              </td>
            </tr>\`;
          }).join("");
        }

      } catch (err) {
        console.error("Dashboard poll failed:", err);
      }
    }

    function escapeHtml(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    setInterval(fetchLiveFeed, 3000);
    fetchLiveFeed();
  </script>
</body>
</html>`;
}
