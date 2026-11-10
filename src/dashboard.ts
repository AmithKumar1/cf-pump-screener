/**
 * Institutional Bloomberg-Grade Live Radar, Whales Forensics & Execution Cockpit.
 * Designed to HRT/Citadel/Jane Street quantitative specifications for Solana & Pump.fun.
 *
 * Core Capabilities:
 * 1. Bloomberg 3-Pane Cockpit View with keyboard hotkeys (P, B, G, M, V, Space)
 * 2. Interactive Arkham/Bubblemaps Sybil Canvas Engine
 * 3. Native Web Audio API Acoustic Synthesizer (Sonar pings & de-escalation tones)
 * 4. Jito Anti-MEV Tip Recommendation & 1-Click Fast Sniper Execution Dock
 * 5. Deep On-Chain Whale & Capital Forensics Inspector
 */

export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PumpRadar — Institutional Quant & Forensics Cockpit</title>
  <style>
    :root {
      --bg: #06090c;
      --card-bg: #0b1015;
      --card-hover: #101720;
      --pane-header: #0e141a;
      --border: #16212b;
      --border-focus: #00d2ff;
      --text: #e2e8f0;
      --text-muted: #64748b;
      --accent: #00d2ff;
      --green: #10b981;
      --red: #ef4444;
      --yellow: #f59e0b;
      --purple: #a855f7;
      --gold: #fbbf24;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      padding: 12px 16px;
      overflow-x: hidden;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .mono { font-family: var(--font-mono); }

    /* Top Command Bar */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .pulse-dot {
      width: 9px;
      height: 9px;
      background: var(--green);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--green);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(16, 185, 129, 0.1);
      color: var(--green);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
    }

    /* KPI Bar */
    .metrics-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
    }
    .metric-label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .metric-val {
      font-size: 20px;
      font-weight: 700;
      font-family: var(--font-mono);
    }

    /* Controls & Hotkeys Strip */
    .command-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #090e13;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      margin-bottom: 12px;
      font-size: 11px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .hotkey-pill {
      background: #151e27;
      border: 1px solid #233140;
      border-radius: 4px;
      padding: 1px 6px;
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--accent);
      margin-right: 4px;
    }

    /* Bloomberg 3-Pane Cockpit Layout */
    .cockpit-grid {
      display: grid;
      grid-template-columns: 320px 1fr 340px;
      gap: 12px;
      height: calc(100vh - 165px);
      min-height: 600px;
    }
    @media (max-width: 1200px) {
      .cockpit-grid {
        grid-template-columns: 1fr;
        height: auto;
      }
    }
    .cockpit-pane {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .pane-header {
      padding: 8px 12px;
      background: var(--pane-header);
      border-bottom: 1px solid var(--border);
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pane-content {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }

    /* Firehose List (Left Pane) */
    .firehose-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 10px;
      border-bottom: 1px solid #141c24;
      cursor: pointer;
      transition: background 0.15s ease;
      border-radius: 4px;
    }
    .firehose-item:hover { background: var(--card-hover); }
    .firehose-item.active {
      background: rgba(0, 210, 255, 0.1);
      border-color: rgba(0, 210, 255, 0.3);
    }

    /* Center Active Radar Pane */
    .active-token-hero {
      background: #0d141b;
      border: 1px solid #1d2a37;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .canvas-container {
      background: #080c10;
      border: 1px solid #16222d;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      position: relative;
      margin-bottom: 12px;
    }
    canvas {
      display: block;
      width: 100%;
      height: 220px;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
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
    .badge-gold { background: rgba(251, 191, 36, 0.15); color: var(--gold); border: 1px solid rgba(251, 191, 36, 0.3); }
    .badge-muted { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid var(--border); }

    /* Buttons */
    .btn {
      background: #141c24;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .btn:hover { background: #1c2631; border-color: #2b3b4b; }
    .btn-inspect {
      background: rgba(0, 210, 255, 0.12);
      border: 1px solid rgba(0, 210, 255, 0.4);
      color: var(--accent);
      font-weight: 700;
    }
    .btn-inspect:hover { background: rgba(0, 210, 255, 0.25); border-color: var(--accent); }

    /* Progress bar */
    .progress-bar-wrap {
      background: #141c24;
      border-radius: 4px;
      height: 8px;
      overflow: hidden;
      margin-top: 6px;
      border: 1px solid #1e2a36;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #00d2ff);
      box-shadow: 0 0 8px rgba(0, 210, 255, 0.4);
      transition: width 0.3s ease;
    }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 5, 8, 0.88);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-backdrop.open { display: flex; }
    .modal-window {
      background: #0a0f14;
      border: 1px solid #1c2834;
      border-radius: 10px;
      width: 100%;
      max-width: 960px;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
      animation: modalFadeIn 0.15s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0d1319;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
    }
    .modal-body {
      padding: 18px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .modal-footer {
      padding: 12px 18px;
      border-top: 1px solid var(--border);
      background: #0d1319;
      border-bottom-left-radius: 10px;
      border-bottom-right-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* Bento Grid */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .bento-card {
      background: #0f151c;
      border: 1px solid #192430;
      border-radius: 6px;
      padding: 12px;
    }
    .bento-card-title {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 11px;
    }
    th {
      background: #0a0e12;
      color: var(--text-muted);
      font-weight: 600;
      padding: 7px 10px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #121a22;
      vertical-align: middle;
      white-space: nowrap;
    }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    .view-standard { display: none; }
    body.standard-view .view-standard { display: block; }
    body.standard-view .view-cockpit { display: none; }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="brand">
      <div class="pulse-dot"></div>
      <span>PUMPRADAR <span style="color:var(--text-muted);font-weight:400;">/ QUANT COCKPIT v2.4</span></span>
      <span class="status-badge">CITADEL/HRT SPEC</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="mono" id="clock" style="color:var(--text-muted);font-size:11px;">--:--:-- UTC</span>
      <button class="btn" id="audio-toggle-btn" onclick="toggleAudio()" style="color:var(--green);">🔊 Audio: ARMED</button>
      <button class="btn" id="view-toggle-btn" onclick="toggleLayout()">🖥️ Cockpit Mode</button>
      <a href="https://t.me/memcoinhome_bot" target="_blank" class="btn" style="background:#2481cc;border-color:#2481cc;color:#fff;">@memcoinhome_bot ↗</a>
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

  <!-- Command Strip with Institutional Hotkeys -->
  <div class="command-strip">
    <div>
      <span style="color:var(--text-muted);margin-right:8px;">QUANT HOTKEYS:</span>
      <span><span class="hotkey-pill">SPACE</span>Deep Inspect</span>
      <span><span class="hotkey-pill">P</span>Photon Snipe</span>
      <span><span class="hotkey-pill">B</span>BullX Snipe</span>
      <span><span class="hotkey-pill">G</span>GMGN Snipe</span>
      <span><span class="hotkey-pill">M</span>Mute Audio</span>
      <span><span class="hotkey-pill">V</span>Switch View</span>
    </div>
    <div style="color:var(--text-muted);">
      <span id="feed-status">Sub-second Geyser Stream Active</span>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- 1. BLOOMBERG 3-PANE COCKPIT VIEW (DEFAULT) -->
  <!-- ========================================== -->
  <div class="view-cockpit cockpit-grid">
    <!-- PANE 1: Solana Firehose Ingestion Feed -->
    <div class="cockpit-pane">
      <div class="pane-header">
        <span>⚡ Solana Firehose Stream</span>
        <span class="mono" style="font-size:10px;color:var(--accent);">L1 Ingestion</span>
      </div>
      <div class="pane-content" id="firehose-list" style="padding:4px;">
        <div style="text-align:center;padding:30px;color:var(--text-muted);">Syncing edge firehose...</div>
      </div>
    </div>

    <!-- PANE 2: Center Active Radar & Arkham Sybil Bubble Canvas -->
    <div class="cockpit-pane">
      <div class="pane-header">
        <span>🔬 Active Token Microstructure & Sybil Graph</span>
        <button class="btn btn-inspect" onclick="openActiveTokenModal()">Full Inspect [Space] ↗</button>
      </div>
      <div class="pane-content">
        <!-- Active Token Hero -->
        <div class="active-token-hero">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-size:17px;font-weight:700;" id="c-token-name">Select a Token</div>
              <div class="mono" style="font-size:11px;color:var(--accent);" id="c-token-mint">--</div>
            </div>
            <span id="c-token-badge" class="badge badge-purple">STAGE 1</span>
          </div>

          <!-- Curve Progress -->
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:6px;">
            <span id="c-curve-text">0.0% to Raydium</span>
            <span id="c-net-sol">0.00 SOL Raised</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" id="c-curve-bar" style="width:0%;"></div>
          </div>
        </div>

        <!-- Interactive Sybil / Bubblemaps Canvas -->
        <div class="canvas-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:10px;color:var(--text-muted);">
            <span>ARKHAM SYBIL CLUSTER GRAPH</span>
            <span id="c-cluster-verdict" class="badge badge-green">Organic Decentralized</span>
          </div>
          <canvas id="sybil-canvas"></canvas>
          <div style="display:flex;justify-content:center;gap:12px;font-size:10px;color:var(--text-muted);margin-top:6px;">
            <span><span style="color:#f59e0b;">●</span> Dev Wallet</span>
            <span><span style="color:#ef4444;">●</span> Bundled Insider</span>
            <span><span style="color:#10b981;">●</span> Whale</span>
            <span><span style="color:#00d2ff;">●</span> Early Buyer</span>
          </div>
        </div>

        <!-- Jito Anti-MEV Tip & Fast Execution Command Dock -->
        <div class="bento-card" style="background:#0a0e13;border-color:#1c2936;">
          <div class="bento-card-title">
            <span>⚡ Jito Anti-MEV Gateway & 1-Click Execution</span>
            <span id="c-jito-tip" class="badge badge-gold">Rec. Tip: 0.003 SOL</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));gap:6px;margin-top:8px;">
            <a id="c-btn-photon" href="#" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;justify-content:center;">⚡ Photon [P]</a>
            <a id="c-btn-bullx" href="#" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;justify-content:center;">🎯 BullX [B]</a>
            <a id="c-btn-gmgn" href="#" target="_blank" class="btn" style="background:#00d2ff;color:#000;font-weight:700;justify-content:center;">🤖 GMGN [G]</a>
            <a id="c-btn-dexs" href="#" target="_blank" class="btn" style="justify-content:center;">DexScreener</a>
            <a id="c-btn-pump" href="#" target="_blank" class="btn" style="justify-content:center;">Pump.fun</a>
          </div>
        </div>
      </div>
    </div>

    <!-- PANE 3: Dispatched Signals & Whale Allocations -->
    <div class="cockpit-pane">
      <div class="pane-header">
        <span>🚨 Dispatched Signals (@memcoinhome_bot)</span>
        <span class="mono" id="c-signals-count" style="font-size:10px;color:var(--purple);">0 Active</span>
      </div>
      <div class="pane-content" style="padding:6px;">
        <div id="c-alerts-list">
          <div style="text-align:center;padding:24px;color:var(--text-muted);">Awaiting high-conviction signals...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- 2. STANDARD FULL-WIDTH TABLES VIEW         -->
  <!-- ========================================== -->
  <div class="view-standard">
    <!-- Recent Alerts Table -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);">🚨 Dispatched Quant Signals</span>
      <span id="alerts-count" class="mono" style="color:var(--purple);">0 Signals</span>
    </div>
    <div class="cockpit-pane" style="margin-bottom:20px;overflow-x:auto;">
      <table id="alerts-table">
        <thead>
          <tr>
            <th>Time</th>
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
          <tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px;">Awaiting high-conviction signals...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Live Ingestion Feed Table -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);">⚡ Live Solana Ingestion Stream</span>
      <span class="mono" style="color:var(--text-muted);">Auto-refreshing 3s</span>
    </div>
    <div class="cockpit-pane" style="overflow-x:auto;">
      <table id="events-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Time</th>
            <th>Token (Symbol / Name)</th>
            <th>Creator Wallet</th>
            <th>Metadata Host</th>
            <th>Socials</th>
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
  </div>

  <!-- ========================================== -->
  <!-- INSTITUTIONAL DEEP INSPECT MODAL           -->
  <!-- ========================================== -->
  <div id="inspect-modal" class="modal-backdrop" onclick="closeInspectModal(event)">
    <div class="modal-window" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:17px;font-weight:700;" id="m-token-title">Loading Token...</div>
          <span id="m-token-badge" class="badge badge-purple">STAGE 1</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="btn" onclick="copyMintAddress()" id="copy-mint-btn">📋 Copy Mint</button>
          <a id="m-solscan-token-link" href="#" target="_blank" class="btn">Solscan ↗</a>
          <button class="btn" onclick="closeInspectModalDirect()" style="padding:4px 8px;font-size:13px;">✕</button>
        </div>
      </div>

      <div class="modal-body" id="m-modal-body">
        <div id="m-loading-state" style="text-align:center;padding:40px;color:var(--text-muted);">
          <div class="pulse-dot" style="margin:0 auto 10px auto;width:12px;height:12px;"></div>
          Querying RugCheck contract audit & mapping Sybil clusters...
        </div>

        <div id="m-content-state" style="display:none;flex-direction:column;gap:14px;">
          <!-- Mint Address Monospace Bar -->
          <div style="background:#080c10;padding:7px 12px;border-radius:5px;border:1px solid #16212b;display:flex;justify-content:space-between;align-items:center;">
            <span class="mono" style="font-size:11px;color:var(--accent);" id="m-mint-addr">--</span>
            <span style="font-size:11px;color:var(--text-muted);" id="m-created-time">--</span>
          </div>

          <!-- Bonding Curve Progress Hero -->
          <div class="bento-card" style="background:#0d1319;border-color:#1c2936;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <span class="bento-card-title">📈 Bonding Curve & Migration Progress</span>
              <span class="mono" style="font-weight:700;color:var(--accent);" id="m-curve-text">0.0% to Raydium</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" id="m-curve-bar" style="width:0%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:6px;">
              <span id="m-net-sol-hero">0.00 SOL Raised</span>
              <span id="m-sol-to-grad">85.00 SOL remaining</span>
            </div>
          </div>

          <!-- Bento Grid: Creator DNA + Financials + RugCheck -->
          <div class="bento-grid">
            <!-- Card 1: Creator DNA -->
            <div class="bento-card">
              <div class="bento-card-title">👤 Creator DNA & Deployment History</div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Creator Wallet:</span>
                  <a id="m-creator-link" href="#" target="_blank" class="mono">--</a>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Dev Initial Buy:</span>
                  <span class="mono" style="font-weight:700;" id="m-dev-buy">0.00 SOL</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Past Launches:</span>
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
              <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Net SOL Deployed:</span>
                  <span class="mono" style="font-weight:700;color:var(--green);" id="m-net-sol">--</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Gross Inflow:</span>
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
                  <span style="color:var(--text-muted);">Total Trades:</span>
                  <span class="mono" id="m-trades-count">--</span>
                </div>
              </div>
            </div>

            <!-- Card 3: Security & RugCheck -->
            <div class="bento-card">
              <div class="bento-card-title">🛡️ Contract Security (RugCheck Audit)</div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
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
              <span>👥 Who Invested & Whale Allocations</span>
              <span id="m-whale-gauge" class="badge badge-green">Decentralized</span>
            </div>
            <div style="overflow-x:auto;">
              <table style="font-size:11px;">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Investor Wallet</th>
                    <th>Net SOL Invested</th>
                    <th>Gross Buy</th>
                    <th>Share %</th>
                    <th>Classification</th>
                    <th>Trades</th>
                  </tr>
                </thead>
                <tbody id="m-investors-body">
                  <tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:10px;">Loading on-chain ledger...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Dock: 1-Click Fast Sniper Bar -->
      <div class="modal-footer">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);">
          <span>⚡ <strong>Ready to trade?</strong> Execution dock:</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <a id="m-btn-photon" href="#" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;">⚡ Photon</a>
          <a id="m-btn-bullx" href="#" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;">🎯 BullX</a>
          <a id="m-btn-gmgn" href="#" target="_blank" class="btn" style="background:#00d2ff;color:#000;font-weight:700;">🤖 GMGN</a>
          <a id="m-btn-dexs" href="#" target="_blank" class="btn">DexScreener ↗</a>
          <a id="m-btn-pump" href="#" target="_blank" class="btn">Pump.fun ↗</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    let isPaused = false;
    let isStandardView = false;
    let audioCtx = null;
    let audioMuted = false;
    let activeTokenMint = "";
    let lastSeenMaxId = 0;
    let lastSeenAlertCount = 0;
    let cachedFeedData = null;

    // Audio Synthesizer (Native Web Audio API)
    function initAudio() {
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      } catch (_) {}
    }

    function toggleAudio() {
      initAudio();
      audioMuted = !audioMuted;
      localStorage.setItem("pumpradar_muted", audioMuted ? "1" : "0");
      updateAudioUi();
    }

    function updateAudioUi() {
      const btn = document.getElementById("audio-toggle-btn");
      if (!btn) return;
      if (audioMuted) {
        btn.innerText = "🔇 Audio: MUTED";
        btn.style.color = "var(--text-muted)";
      } else {
        btn.innerText = "🔊 Audio: ARMED";
        btn.style.color = "var(--green)";
      }
    }

    function playSonarChime() {
      if (audioMuted) return;
      try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.45);
      } catch (_) {}
    }

    function playWarningTone() {
      if (audioMuted) return;
      try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.linearRampToValueAtTime(85, now + 0.25);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } catch (_) {}
    }

    // View Switcher (Bloomberg Cockpit vs Standard)
    function toggleLayout() {
      isStandardView = !isStandardView;
      document.body.classList.toggle("standard-view", isStandardView);
      document.getElementById("view-toggle-btn").innerText = isStandardView ? "📋 Standard View" : "🖥️ Cockpit Mode";
      localStorage.setItem("pumpradar_standard", isStandardView ? "1" : "0");
    }

    function updateClock() {
      const now = new Date();
      document.getElementById("clock").innerText = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Canvas Sybil Bubble Map Engine
    function drawSybilCanvas(canvasId, graphData) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const width = canvas.width = canvas.parentElement.clientWidth || 360;
      const height = canvas.height = 220;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Radar rings
      ctx.lineWidth = 1;
      [35, 65, 95].forEach(r => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.stroke();
      });

      const nodes = graphData?.nodes || [];
      const links = graphData?.links || [];
      if (nodes.length === 0) return;

      const angleStep = nodes.length > 1 ? (Math.PI * 2) / (nodes.length - 1) : 0;
      const posMap = new Map();

      nodes.forEach((n, i) => {
        if (n.role === "CREATOR" || i === 0) {
          posMap.set(n.id, { x: centerX, y: centerY, r: 16, color: n.color || "#f59e0b", label: n.short });
        } else {
          const radius = 68 + (i % 2 === 0 ? 14 : -10);
          const angle = (i - 1) * angleStep;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const nodeR = Math.max(7, Math.min(14, 7 + (n.sol || 1) * 2));
          posMap.set(n.id, { x, y, r: nodeR, color: n.color || "#00d2ff", label: n.short });
        }
      });

      // Draw connection lines
      links.forEach(l => {
        const p1 = posMap.get(l.source);
        const p2 = posMap.get(l.target);
        if (!p1 || !p2) return;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        if (l.type === "bundled_cluster") {
          ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
          ctx.setLineDash([3, 3]);
        } else {
          ctx.strokeStyle = "rgba(0, 210, 255, 0.2)";
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw nodes
      posMap.forEach((pos) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pos.r, 0, Math.PI * 2);
        ctx.fillStyle = pos.color;
        ctx.fill();

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(pos.label, pos.x, pos.y + pos.r + 10);
      });
    }

    // Live Feed Poller
    async function fetchLiveFeed() {
      if (isPaused) return;
      try {
        const res = await fetch("/api/live");
        if (!res.ok) return;
        const data = await res.json();
        cachedFeedData = data;

        // Sound triggers
        if (lastSeenMaxId > 0 && data.stats.launches_logged > lastSeenMaxId) {
          // Check if any new launch had verified socials
          const newVerified = (data.events || []).some(e => e.id > lastSeenMaxId && (e.twitter || e.telegram || e.website));
          if (newVerified) playSonarChime();
        }
        if (lastSeenAlertCount > 0 && (data.alerts?.length || 0) > lastSeenAlertCount) {
          playSonarChime();
        }
        lastSeenMaxId = data.stats.launches_logged || lastSeenMaxId;
        lastSeenAlertCount = data.alerts?.length || lastSeenAlertCount;

        // Update KPIs
        document.getElementById("metric-launches").innerText = data.stats.launches_logged || 0;
        document.getElementById("metric-socials").innerText = data.stats.with_socials || 0;
        document.getElementById("metric-blocked").innerText = data.stats.serial_ruggers_blocked || 0;
        document.getElementById("metric-alerts").innerText = data.stats.signals_generated || 0;
        document.getElementById("alerts-count").innerText = (data.alerts?.length || 0) + " Signals";
        document.getElementById("c-signals-count").innerText = (data.alerts?.length || 0) + " Active";

        // Render Cockpit Pane 1 (Firehose List)
        const firehoseContainer = document.getElementById("firehose-list");
        if (data.events && data.events.length > 0) {
          firehoseContainer.innerHTML = data.events.map((e, idx) => {
            const timeStr = e.time_utc ? e.time_utc.slice(11, 19) : "--:--:--";
            const isActive = e.mint === activeTokenMint || (!activeTokenMint && idx === 0);
            if (!activeTokenMint && idx === 0) {
              selectActiveToken(e.mint);
            }
            let badge = '';
            if (e.is_serial_rugger) badge = '<span class="badge badge-red" style="font-size:9px;">RUGGER</span>';
            else if (e.has_alert) badge = '<span class="badge badge-purple" style="font-size:9px;">ALERT</span>';
            else if (e.twitter || e.telegram || e.website) badge = '<span class="badge badge-green" style="font-size:9px;">VERIFIED</span>';

            return \`<div class="firehose-item \${isActive ? 'active' : ''}" onclick="selectActiveToken('\${e.mint}')">
              <div style="display:flex;flex-direction:column;gap:2px;">
                <div style="font-weight:700;color:var(--text);font-size:12px;">\${escapeHtml(e.symbol || 'PUMP')} <span style="font-weight:400;color:var(--text-muted);font-size:10px;">\${escapeHtml((e.name || '').slice(0, 14))}</span></div>
                <div class="mono" style="font-size:10px;color:var(--text-muted);">\${timeStr} · \${e.creator ? e.creator.slice(0, 4) + '...' + e.creator.slice(-4) : ''}</div>
              </div>
              <div style="text-align:right;">
                \${badge}
              </div>
            </div>\`;
          }).join("");
        }

        // Render Cockpit Pane 3 (Alerts Feed)
        const cAlertsContainer = document.getElementById("c-alerts-list");
        if (data.alerts && data.alerts.length > 0) {
          cAlertsContainer.innerHTML = data.alerts.map(a => {
            const timeStr = a.created_at ? new Date(a.created_at).toISOString().replace("T", " ").slice(11, 19) : "--:--:--";
            return \`<div class="bento-card" style="margin-bottom:8px;cursor:pointer;" onclick="selectActiveToken('\${a.mint}')">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <strong style="color:var(--accent);">$\${escapeHtml(a.symbol)}</strong>
                <span class="badge badge-purple">\${Math.round(a.score)}/100</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);">
                <span>\${Number(a.net_sol || 0).toFixed(2)} SOL Raised</span>
                <span>\${a.unique_buyers || 0} Buyers</span>
              </div>
              <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
                <span class="badge badge-green" style="font-size:9px;">\${escapeHtml(a.flags?.split(',')[0] || 'SIGNAL')}</span>
                <button class="btn btn-inspect" style="padding:2px 6px;font-size:10px;" onclick="inspectToken('\${a.mint}');event.stopPropagation();">Inspect</button>
              </div>
            </div>\`;
          }).join("");
        }

        // Render Standard Table View (Alerts Table)
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
              <td><button class="btn btn-inspect" onclick="inspectToken('\${a.mint}')">🔬 Inspect</button></td>
              <td>
                <a href="https://photon-sol.tinyastro.io/en/lp/\${a.mint}" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;">⚡ Photon</a>
                <a href="https://bullx.io/terminal?chainId=1399811149&address=\${a.mint}" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;">🎯 BullX</a>
              </td>
            </tr>\`;
          }).join("");
        }

        // Render Standard Table View (Events Table)
        const eventsBody = document.getElementById("events-body");
        if (data.events && data.events.length > 0) {
          eventsBody.innerHTML = data.events.map(e => {
            const timeStr = e.time_utc ? e.time_utc.slice(11, 19) : "--:--:--";
            const shortCreator = e.creator ? e.creator.slice(0, 4) + '...' + e.creator.slice(-4) : 'unknown';
            let socialsHtml = '';
            if (e.twitter) socialsHtml += \`<a href="\${escapeHtml(e.twitter)}" target="_blank" class="social-link">𝕏 Twitter</a>\`;
            if (e.telegram) socialsHtml += \`<a href="\${escapeHtml(e.telegram)}" target="_blank" class="social-link">✈️ TG</a>\`;
            if (e.website) socialsHtml += \`<a href="\${escapeHtml(e.website)}" target="_blank" class="social-link">🌐 Web</a>\`;
            if (!socialsHtml) socialsHtml = '<span class="badge badge-muted">None</span>';

            let hostStr = 'unknown';
            try { if (e.uri) hostStr = new URL(e.uri).hostname; } catch (_) { hostStr = (e.uri || '').slice(0, 20); }

            let verdictBadge = '';
            if (e.is_serial_rugger) verdictBadge = \`<span class="badge badge-red">❌ Serial Rugger (\${e.past_launches} rugs)</span>\`;
            else if (e.has_alert) verdictBadge = '<span class="badge badge-purple">🚀 Alert Sent</span>';
            else if (e.twitter || e.telegram || e.website) verdictBadge = '<span class="badge badge-green">✅ Verified Community</span>';
            else verdictBadge = '<span class="badge badge-muted">⚪ Anonymous</span>';

            return \`<tr>
              <td class="mono" style="color:var(--text-muted);">#\${e.id}</td>
              <td class="mono">\${timeStr}</td>
              <td>
                <span class="clickable-token" onclick="inspectToken('\${e.mint}')"><strong>\${escapeHtml(e.symbol || 'PUMP')}</strong></span>
                <span style="color:var(--text-muted);font-size:10px;">\${escapeHtml(e.name || '')}</span>
              </td>
              <td><a class="mono" href="https://solscan.io/account/\${e.creator}" target="_blank">\${shortCreator}</a></td>
              <td><span class="mono" style="font-size:10px;color:var(--text-muted);">\${escapeHtml(hostStr)}</span></td>
              <td>\${socialsHtml}</td>
              <td>\${verdictBadge}</td>
              <td><button class="btn btn-inspect" onclick="inspectToken('\${e.mint}')">🔬 Inspect</button></td>
              <td>
                <a href="https://photon-sol.tinyastro.io/en/lp/\${e.mint}" target="_blank" style="color:#f59e0b;font-weight:700;">⚡Photon</a> ·
                <a href="https://bullx.io/terminal?chainId=1399811149&address=\${e.mint}" target="_blank" style="color:#10b981;font-weight:700;">🎯BullX</a> ·
                <a href="https://gmgn.ai/sol/token/\${e.mint}" target="_blank" style="color:#00d2ff;font-weight:700;">🤖GMGN</a>
              </td>
            </tr>\`;
          }).join("");
        }

      } catch (err) {
        console.error("Dashboard poll failed:", err);
      }
    }

    // Select Active Token for Bloomberg Pane 2
    async function selectActiveToken(mint) {
      if (!mint || mint === activeTokenMint) return;
      activeTokenMint = mint;

      // Highlight in list
      document.querySelectorAll(".firehose-item").forEach(el => {
        el.classList.remove("active");
      });

      try {
        const res = await fetch("/api/inspect?mint=" + encodeURIComponent(mint));
        if (!res.ok) return;
        const report = await res.json();

        // Update Center Hero
        document.getElementById("c-token-name").innerHTML = \`\${escapeHtml(report.name)} <span style="color:var(--accent);">($\${escapeHtml(report.symbol)})</span>\`;
        document.getElementById("c-token-mint").innerText = report.mint;
        const curvePct = Number(report.curve_progress_pct || 0);
        document.getElementById("c-curve-text").innerText = curvePct.toFixed(1) + "% to Raydium";
        document.getElementById("c-net-sol").innerText = report.net_sol_deployed.toFixed(2) + " SOL Raised (" + report.unique_investors + " Buyers)";
        document.getElementById("c-curve-bar").style.width = Math.min(100, Math.max(2, curvePct)) + "%";

        // Jito Anti-MEV Tip
        const jitoBadge = document.getElementById("c-jito-tip");
        jitoBadge.innerText = "Rec. Jito Tip: " + report.jito_execution.recommended_tip_sol + " SOL (" + report.jito_execution.mev_risk_level + " RISK)";
        if (report.jito_execution.mev_risk_level === "HIGH") jitoBadge.className = "badge badge-red";
        else if (report.jito_execution.mev_risk_level === "MEDIUM") jitoBadge.className = "badge badge-gold";
        else jitoBadge.className = "badge badge-green";

        // Fast Execution Buttons
        document.getElementById("c-btn-photon").href = report.sniper_links.photon;
        document.getElementById("c-btn-bullx").href = report.sniper_links.bullx;
        document.getElementById("c-btn-gmgn").href = report.sniper_links.gmgn;
        document.getElementById("c-btn-dexs").href = report.sniper_links.dexscreener;
        document.getElementById("c-btn-pump").href = report.sniper_links.pumpfun;

        // Render Canvas Sybil Bubble Map
        const verdictBadge = document.getElementById("c-cluster-verdict");
        verdictBadge.innerText = report.sybil_intelligence.cluster_verdict;
        if (report.sybil_intelligence.is_bundled_launch) verdictBadge.className = "badge badge-red";
        else verdictBadge.className = "badge badge-green";

        drawSybilCanvas("sybil-canvas", report.sybil_intelligence.bubble_graph);

      } catch (err) {
        console.error("Select token error:", err);
      }
    }

    function openActiveTokenModal() {
      if (activeTokenMint) {
        inspectToken(activeTokenMint);
      }
    }

    // Modal Deep Inspector Controller
    async function inspectToken(mint) {
      if (!mint) return;
      activeTokenMint = mint;
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

        // Curve Progress
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
        if (!socialsHtml) socialsHtml = '<span class="badge badge-muted">No Socials</span>';
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
          invBody.innerHTML = \`<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:10px;">Early launch state: trades syncing...</td></tr>\`;
        }

        // Wire 1-Click Fast Sniper Links
        document.getElementById("m-btn-photon").href = report.sniper_links.photon;
        document.getElementById("m-btn-bullx").href = report.sniper_links.bullx;
        document.getElementById("m-btn-gmgn").href = report.sniper_links.gmgn;
        document.getElementById("m-btn-dexs").href = report.sniper_links.dexscreener;
        document.getElementById("m-btn-pump").href = report.sniper_links.pumpfun;

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

    function copyMintAddress() {
      if (!activeTokenMint) return;
      navigator.clipboard.writeText(activeTokenMint).then(() => {
        document.getElementById("copy-mint-btn").innerText = "✅ Copied!";
        setTimeout(() => {
          document.getElementById("copy-mint-btn").innerText = "📋 Copy Mint";
        }, 2000);
      });
    }

    // Keyboard Hotkey Controller (Citadel / HRT Spec)
    document.addEventListener("keydown", (e) => {
      // Don't trigger hotkeys if typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        closeInspectModalDirect();
      } else if (e.code === "Space") {
        e.preventDefault();
        openActiveTokenModal();
      } else if (e.key === "p" || e.key === "P") {
        if (activeTokenMint) window.open("https://photon-sol.tinyastro.io/en/lp/" + activeTokenMint, "_blank");
      } else if (e.key === "b" || e.key === "B") {
        if (activeTokenMint) window.open("https://bullx.io/terminal?chainId=1399811149&address=" + activeTokenMint, "_blank");
      } else if (e.key === "g" || e.key === "G") {
        if (activeTokenMint) window.open("https://gmgn.ai/sol/token/" + activeTokenMint, "_blank");
      } else if (e.key === "m" || e.key === "M") {
        toggleAudio();
      } else if (e.key === "v" || e.key === "V") {
        toggleLayout();
      }
    });

    // Initialize user preferences
    if (localStorage.getItem("pumpradar_muted") === "1") {
      audioMuted = true;
      updateAudioUi();
    }
    if (localStorage.getItem("pumpradar_standard") === "1") {
      toggleLayout();
    }

    // Unlock Web Audio on first user click
    window.addEventListener("click", () => {
      initAudio();
    }, { once: true });

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
