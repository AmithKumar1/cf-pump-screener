/**
 * Institutional Live Radar & Forensics Dashboard for Cloudflare Workers edge.
 * Provides a real-time terminal UI directly in the browser to inspect incoming tokens,
 * whale rosters, money deployed, metadata URIs, and 1-click execution terminals.
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
      --bg: #070a0d;
      --card-bg: #0e141a;
      --card-hover: #121a22;
      --border: #1a2530;
      --border-focus: #00d2ff;
      --text: #e2e8f0;
      --text-muted: #64748b;
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
      background: #0b0f13;
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

    /* Buttons */
    .btn {
      background: #151d24;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 5px 12px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .btn:hover { background: #1e2832; border-color: #2d3d4d; }
    .btn-inspect {
      background: rgba(0, 210, 255, 0.12);
      border: 1px solid rgba(0, 210, 255, 0.4);
      color: var(--accent);
      font-weight: 700;
    }
    .btn-inspect:hover {
      background: rgba(0, 210, 255, 0.25);
      border-color: var(--accent);
    }
    .clickable-token {
      cursor: pointer;
      color: #fff;
      font-weight: 700;
      border-bottom: 1px dashed rgba(255,255,255,0.3);
    }
    .clickable-token:hover {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    /* Modal Styles */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(3, 6, 9, 0.85);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-backdrop.open { display: flex; }
    .modal-window {
      background: #0b1015;
      border: 1px solid #1e2b37;
      border-radius: 12px;
      width: 100%;
      max-width: 960px;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
      animation: modalFadeIn 0.2s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0e141a;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      background: #0e141a;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* Bento Grid inside Modal */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .bento-card {
      background: #11171f;
      border: 1px solid #1a2530;
      border-radius: 8px;
      padding: 14px;
    }
    .bento-card-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Neon Progress Bar */
    .progress-bar-wrap {
      background: #18222b;
      border-radius: 6px;
      height: 10px;
      overflow: hidden;
      margin-top: 6px;
      border: 1px solid #23313e;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #00d2ff);
      box-shadow: 0 0 10px rgba(0, 210, 255, 0.5);
      transition: width 0.4s ease;
    }

    /* Mini Table inside Modal */
    .mini-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .mini-table th {
      padding: 6px 8px;
      background: #0b0f14;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid #1a2530;
    }
    .mini-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #161f28;
    }
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
          <th>Deep Research</th>
          <th>1-Click Sniper</th>
        </tr>
      </thead>
      <tbody id="alerts-body">
        <tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px;">Awaiting high-conviction breakout signals...</td></tr>
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
          <th>Deep Research</th>
          <th>Live Links</th>
        </tr>
      </thead>
      <tbody id="events-body">
        <tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px;">Connecting to Cloudflare Workers Edge stream...</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Institutional Token & Whales Deep Inspector Modal -->
  <div id="inspect-modal" class="modal-backdrop" onclick="closeInspectModal(event)">
    <div class="modal-window" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:18px;font-weight:700;" id="m-token-title">Loading Token...</div>
          <span id="m-token-badge" class="badge badge-purple">STAGE 1</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="btn" onclick="copyMintAddress()" id="copy-mint-btn">📋 Copy Mint</button>
          <a id="m-solscan-token-link" href="#" target="_blank" class="btn">Solscan ↗</a>
          <button class="btn" onclick="closeInspectModalDirect()" style="padding:5px 8px;font-size:14px;">✕</button>
        </div>
      </div>

      <div class="modal-body" id="m-modal-body">
        <div id="m-loading-state" style="text-align:center;padding:40px;color:var(--text-muted);">
          <div class="pulse-dot" style="margin:0 auto 12px auto;width:14px;height:14px;"></div>
          Connecting to on-chain ledger, querying RugCheck security audit & mapping whale distribution...
        </div>

        <div id="m-content-state" style="display:none;flex-direction:column;gap:16px;">
          <!-- Mint Address Monospace Bar -->
          <div style="background:#090d11;padding:8px 12px;border-radius:6px;border:1px solid #1a2530;display:flex;justify-content:space-between;align-items:center;">
            <span class="mono" style="font-size:12px;color:var(--accent);" id="m-mint-addr">--</span>
            <span style="font-size:11px;color:var(--text-muted);" id="m-created-time">--</span>
          </div>

          <!-- Bonding Curve Progress Hero -->
          <div class="bento-card" style="background:#0e151d;border-color:#1e2d3b;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <span class="bento-card-title">📈 Bonding Curve & Graduation Progress</span>
              <span class="mono" style="font-weight:700;color:var(--accent);" id="m-curve-text">0.0% to Raydium</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" id="m-curve-bar" style="width:0%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:6px;">
              <span id="m-net-sol-hero">0.00 SOL Raised</span>
              <span id="m-sol-to-grad">85.00 SOL needed to migrate</span>
            </div>
          </div>

          <!-- Bento Grid Row: Creator DNA + Financials -->
          <div class="bento-grid">
            <!-- Card 1: Creator DNA -->
            <div class="bento-card">
              <div class="bento-card-title">👤 Creator DNA & Deployment History</div>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Creator Wallet:</span>
                  <a id="m-creator-link" href="#" target="_blank" class="mono">--</a>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Dev Initial Buy:</span>
                  <span class="mono" style="font-weight:700;" id="m-dev-buy">0.00 SOL</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Historical Launches:</span>
                  <span class="mono" id="m-past-launches">1 token</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="color:var(--text-muted);">Serial Rug Risk:</span>
                  <span id="m-rug-badge" class="badge badge-green">Clean Deployer</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="color:var(--text-muted);">Discovered Socials:</span>
                  <div id="m-socials-box">--</div>
                </div>
              </div>
            </div>

            <!-- Card 2: Financials & Market Depth -->
            <div class="bento-card">
              <div class="bento-card-title">💰 Capital Deployed & Market Depth</div>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Net SOL Deployed:</span>
                  <span class="mono" style="font-weight:700;color:var(--green);" id="m-net-sol">--</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Gross Buy Inflow:</span>
                  <span class="mono" id="m-gross-inflow">--</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Sell Outflow:</span>
                  <span class="mono" id="m-gross-outflow">--</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Estimated Market Cap:</span>
                  <span class="mono" style="font-weight:700;color:var(--yellow);" id="m-mcap">--</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Total Ingestion Trades:</span>
                  <span class="mono" id="m-trades-count">--</span>
                </div>
              </div>
            </div>

            <!-- Card 3: Security & RugCheck -->
            <div class="bento-card">
              <div class="bento-card-title">🛡️ Contract Security (RugCheck Audit)</div>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="color:var(--text-muted);">Audit Verdict:</span>
                  <span id="m-rugcheck-status" class="badge badge-green">✅ SAFE</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Danger Score:</span>
                  <span class="mono" id="m-danger-score">0 / 1000</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Mint Authority:</span>
                  <span style="color:var(--green);font-weight:600;">✅ Revoked</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Freeze Authority:</span>
                  <span style="color:var(--green);font-weight:600;">✅ Revoked</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">LP Protection:</span>
                  <span style="color:var(--green);font-weight:600;">100% Locked on Curve</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Investors & Whales Roster Table -->
          <div class="bento-card">
            <div class="bento-card-title">
              <span>👥 Who Invested & Whale Roster (Top Allocations)</span>
              <span id="m-whale-gauge" class="badge badge-green">Decentralized</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="mini-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Investor Wallet</th>
                    <th>Net SOL Invested</th>
                    <th>Gross Buy</th>
                    <th>Share of Pool</th>
                    <th>Entity Classification</th>
                    <th>Trades</th>
                  </tr>
                </thead>
                <tbody id="m-investors-body">
                  <tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:14px;">No on-chain trade data recorded yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Dock: 1-Click Fast Sniper Execution Bar -->
      <div class="modal-footer">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);">
          <span>⚡ <strong>Ready to trade?</strong> Zero-lag execution:</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;" id="m-sniper-actions">
          <a id="btn-photon" href="#" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;">⚡ Trade on Photon</a>
          <a id="btn-bullx" href="#" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;">🎯 Trade on BullX</a>
          <a id="btn-gmgn" href="#" target="_blank" class="btn" style="background:#00d2ff;color:#000;font-weight:700;">🤖 Trade on GMGN</a>
          <a id="btn-dexs" href="#" target="_blank" class="btn">DexScreener ↗</a>
          <a id="btn-pump" href="#" target="_blank" class="btn">Pump.fun ↗</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    let isPaused = false;
    let currentInspectedMint = "";

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
              <td><span class="clickable-token" onclick="inspectToken('\${a.mint}')"><strong>\${escapeHtml(a.symbol)}</strong></span></td>
              <td><span class="badge badge-purple">\${Math.round(a.score)}/100</span></td>
              <td class="mono">\${Number(a.net_sol || 0).toFixed(2)} SOL</td>
              <td class="mono">\${a.unique_buyers || 0}</td>
              <td class="mono">\${Number(a.buyer_hhi || 0).toFixed(3)}</td>
              <td><span class="badge badge-green">\${escapeHtml(a.flags || 'SIGNAL')}</span></td>
              <td>
                <button class="btn btn-inspect" onclick="inspectToken('\${a.mint}')">🔬 Inspect</button>
              </td>
              <td>
                <a href="https://photon-sol.tinyastro.io/en/lp/\${a.mint}" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;padding:3px 8px;margin-right:4px;">⚡ Photon</a>
                <a href="https://bullx.io/terminal?chainId=1399811149&address=\${a.mint}" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;padding:3px 8px;margin-right:4px;">🎯 BullX</a>
                <a href="https://gmgn.ai/sol/token/\${a.mint}" target="_blank" class="btn" style="background:#00d2ff;color:#000;font-weight:700;padding:3px 8px;margin-right:4px;">🤖 GMGN</a>
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
              <td>
                <span class="clickable-token" onclick="inspectToken('\${e.mint}')"><strong>\${escapeHtml(e.symbol || 'PUMP')}</strong></span>
                <span style="color:var(--text-muted);font-size:11px;">\${escapeHtml(e.name || '')}</span>
              </td>
              <td><a class="mono" href="https://solscan.io/account/\${e.creator}" target="_blank">\${shortCreator}</a></td>
              <td><span class="mono" style="font-size:11px;color:var(--text-muted);">\${escapeHtml(hostStr)}</span></td>
              <td>\${socialsHtml}</td>
              <td>\${verdictBadge}</td>
              <td>
                <button class="btn btn-inspect" onclick="inspectToken('\${e.mint}')">🔬 Inspect</button>
              </td>
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

    // Modal Deep Inspector Controller
    async function inspectToken(mint) {
      if (!mint) return;
      currentInspectedMint = mint;
      const modal = document.getElementById("inspect-modal");
      const loadingState = document.getElementById("m-loading-state");
      const contentState = document.getElementById("m-content-state");

      modal.classList.add("open");
      loadingState.style.display = "block";
      contentState.style.display = "none";
      document.getElementById("m-token-title").innerText = "Inspecting Token...";
      document.getElementById("copy-mint-btn").innerText = "📋 Copy Mint";

      try {
        const res = await fetch("/api/inspect?mint=" + encodeURIComponent(mint));
        if (!res.ok) throw new Error("HTTP " + res.status);
        const report = await res.json();

        // Populate Header & Identity
        document.getElementById("m-token-title").innerHTML = \`\${escapeHtml(report.name)} <span style="color:var(--accent);">($\${escapeHtml(report.symbol)})</span>\`;
        document.getElementById("m-mint-addr").innerText = report.mint;
        document.getElementById("m-created-time").innerText = "Created: " + (report.created_at || "--");
        document.getElementById("m-solscan-token-link").href = report.token_solscan;

        // Bonding Curve Bar
        const curvePct = Number(report.curve_progress_pct || 0);
        document.getElementById("m-curve-text").innerText = curvePct.toFixed(1) + "% to Raydium";
        document.getElementById("m-curve-bar").style.width = Math.min(100, Math.max(2, curvePct)) + "%";
        document.getElementById("m-net-sol-hero").innerText = report.net_sol_deployed.toFixed(2) + " SOL Raised (" + report.unique_investors + " Buyers)";
        document.getElementById("m-sol-to-grad").innerText = report.sol_to_graduation.toFixed(2) + " SOL remaining to migrate";

        // Creator DNA
        document.getElementById("m-creator-link").href = report.creator_solscan;
        document.getElementById("m-creator-link").innerText = report.creator_short;
        document.getElementById("m-dev-buy").innerText = report.creator_history.dev_buy_sol.toFixed(2) + " SOL (" + report.creator_history.dev_holds_pct + "% dev hold)";
        document.getElementById("m-past-launches").innerText = report.creator_history.past_launches + " past launches";
        
        const rugBadge = document.getElementById("m-rug-badge");
        if (report.creator_history.is_serial_rugger) {
          rugBadge.className = "badge badge-red";
          rugBadge.innerText = "❌ High Risk Serial Rugger";
        } else if (report.creator_history.is_alpha_creator) {
          rugBadge.className = "badge badge-purple";
          rugBadge.innerText = "🎯 Verified Alpha Deployer";
        } else {
          rugBadge.className = "badge badge-green";
          rugBadge.innerText = "✅ Clean Deployer";
        }

        // Socials box
        let socialsHtml = "";
        if (report.socials.twitter) socialsHtml += \`<a href="\${escapeHtml(report.socials.twitter)}" target="_blank" class="social-link">𝕏 Twitter</a>\`;
        if (report.socials.telegram) socialsHtml += \`<a href="\${escapeHtml(report.socials.telegram)}" target="_blank" class="social-link">✈️ TG</a>\`;
        if (report.socials.website) socialsHtml += \`<a href="\${escapeHtml(report.socials.website)}" target="_blank" class="social-link">🌐 Web</a>\`;
        if (!socialsHtml) socialsHtml = '<span class="badge badge-muted">No Socials Found</span>';
        document.getElementById("m-socials-box").innerHTML = socialsHtml;

        // Financials
        document.getElementById("m-net-sol").innerText = report.net_sol_deployed.toFixed(2) + " SOL";
        document.getElementById("m-gross-inflow").innerText = report.total_inflow_sol.toFixed(2) + " SOL";
        document.getElementById("m-gross-outflow").innerText = report.total_outflow_sol.toFixed(2) + " SOL";
        document.getElementById("m-mcap").innerText = report.estimated_mcap_usd ? "$" + Number(report.estimated_mcap_usd).toLocaleString() : "--";
        document.getElementById("m-trades-count").innerText = report.total_trades + " trades (" + report.unique_investors + " unique wallets)";

        // Security / RugCheck
        const secBadge = document.getElementById("m-rugcheck-status");
        if (report.security.rugcheck_status === "SAFE") {
          secBadge.className = "badge badge-green";
          secBadge.innerText = "✅ SAFE";
        } else if (report.security.rugcheck_status === "WARNING") {
          secBadge.className = "badge badge-yellow";
          secBadge.innerText = "⚠️ WARNING";
        } else {
          secBadge.className = "badge badge-red";
          secBadge.innerText = "❌ DANGER";
        }
        document.getElementById("m-danger-score").innerText = report.security.rugcheck_score + " / 1000";

        // Whale Gauge
        const whaleGauge = document.getElementById("m-whale-gauge");
        if (report.is_whale_concentrated) {
          whaleGauge.className = "badge badge-yellow";
          whaleGauge.innerText = "⚠️ Whale Concentrated (" + report.top5_share_pct.toFixed(0) + "% Top 5)";
        } else {
          whaleGauge.className = "badge badge-green";
          whaleGauge.innerText = "✅ Healthy Distribution (CR5: " + report.top5_share_pct.toFixed(0) + "%)";
        }

        // Render Investors Table
        const invBody = document.getElementById("m-investors-body");
        if (report.investors && report.investors.length > 0) {
          invBody.innerHTML = report.investors.map(inv => {
            return \`<tr>
              <td class="mono" style="color:var(--text-muted);">#\${inv.rank}</td>
              <td><a class="mono" href="\${inv.solscan_url}" target="_blank">\${inv.short_wallet} ↗</a></td>
              <td class="mono" style="font-weight:700;color:var(--text);">\${inv.net_sol.toFixed(2)} SOL</td>
              <td class="mono" style="color:var(--text-muted);">\${inv.gross_buy_sol.toFixed(2)} SOL</td>
              <td class="mono">\${inv.pct_share.toFixed(1)}%</td>
              <td><span class="badge \${inv.tag_class}">\${escapeHtml(inv.tag)}</span></td>
              <td class="mono" style="color:var(--text-muted);">\${inv.trades_count}</td>
            </tr>\`;
          }).join("");
        } else {
          invBody.innerHTML = \`<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:14px;">Early launch state: trades are syncing from Solana slots.</td></tr>\`;
        }

        // Wire 1-Click Fast Sniper Links
        document.getElementById("btn-photon").href = report.sniper_links.photon;
        document.getElementById("btn-bullx").href = report.sniper_links.bullx;
        document.getElementById("btn-gmgn").href = report.sniper_links.gmgn;
        document.getElementById("btn-dexs").href = report.sniper_links.dexscreener;
        document.getElementById("btn-pump").href = report.sniper_links.pumpfun;

        loadingState.style.display = "none";
        contentState.style.display = "flex";

      } catch (err) {
        loadingState.innerHTML = \`<div style="color:var(--red);padding:20px;">Failed to inspect token: \${escapeHtml(err.message)}</div>\`;
      }
    }

    function closeInspectModal(e) {
      if (e.target.id === "inspect-modal") {
        document.getElementById("inspect-modal").classList.remove("open");
      }
    }

    function closeInspectModalDirect() {
      document.getElementById("inspect-modal").classList.remove("open");
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeInspectModalDirect();
      }
    });

    function copyMintAddress() {
      if (!currentInspectedMint) return;
      navigator.clipboard.writeText(currentInspectedMint).then(() => {
        document.getElementById("copy-mint-btn").innerText = "✅ Copied!";
        setTimeout(() => {
          document.getElementById("copy-mint-btn").innerText = "📋 Copy Mint";
        }, 2000);
      });
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
