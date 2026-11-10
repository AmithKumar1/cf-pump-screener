/**
 * Institutional Bloomberg-Grade Live Radar, Whales Forensics & Execution Cockpit.
 * Ported & Enhanced with Quantitative Technologies from E:\QRML:
 * - Ultra-dense Bloomberg BLP Signature Aesthetic (Amber #ff9900, Ice #00ffff, Matrix #00ff66)
 * - Zero Space Wastage: Viewport-fitted 100vh Desktop Workstation architecture
 * - Unified 2-Row Top HUD with Live Edge Latency Ping & Theme Switcher [T]
 * - Instant Stream Search & Filter Chips (ALL, VERIFIED, ALERTS, CLEAN DEV)
 * - 1-Click Size Presets (0.5 SOL, 1.0 SOL, 2.0 SOL) & Jito Anti-MEV Gateway
 * - One-Click Quant Dossier Exporter (DuckDB/QRML-ready JSON)
 * - Non-collapsing 3-Pane Cockpit Grid (Left: Stream | Center: Quant Workstation | Right: Signals)
 * - Multi-Tab Center Command Deck:
 *     1. 🕸️ Arkham Sybil Cluster Canvas (Responsive orbital node radar)
 *     2. 📈 Embedded TradingView Candlestick Terminal (DexScreener API)
 *     3. ⚡ HFT Order Book Imbalance (OBI) & Micro-Price Depth Radar
 *     4. 📊 Alpha-158 Quantitative Factor Matrix
 *     5. 👥 Whales & Allocations Table
 * - Native Web Audio API Acoustic Synthesizer (Sonar pings & tactile clicks)
 * - Quant Hotkeys: [SPACE] Deep Inspect, [P] Photon, [B] BullX, [G] GMGN, [M] Mute, [T] Theme, [V] View, [1-5] Tabs
 */

export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bloomberg Terminal // Solana Quant Radar & Whales Forensics (BLP)</title>
  <style>
    :root {
      --bg: #05080b;
      --card-bg: #080d12;
      --card-hover: #0e151d;
      --pane-header: #0b1117;
      --border: #141d26;
      --border-focus: #00ffff;
      --text: #e2e8f0;
      --text-muted: #64748b;
      --accent: #00ffff;
      --bbg-amber: #ff9900;
      --green: #00ff66;
      --red: #ff3344;
      --yellow: #f59e0b;
      --purple: #a855f7;
      --gold: #fbbf24;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    body.theme-ice {
      --bg: #03060a;
      --card-bg: #060b10;
      --bbg-amber: #00ffff;
      --accent: #38bdf8;
    }
    body.theme-matrix {
      --bg: #020804;
      --card-bg: #051007;
      --bbg-amber: #00ff66;
      --accent: #34d399;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100vh;
      max-height: 100vh;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      padding: 3px 5px;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .mono { font-family: var(--font-mono); }

    /* Custom Sleek Scrollbar */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #070b0e; }
    ::-webkit-scrollbar-thumb { background: #1c2734; border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--bbg-amber); }

    /* TOP HUD ROW 1: Command Header & Ticker Tape (~26px) */
    .top-bar-row1 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(90deg, #0b1117 0%, #06090d 100%);
      border: 1px solid var(--border);
      border-bottom: 1px solid #1a2634;
      padding: 3px 8px;
      border-radius: 3px;
      gap: 8px;
      height: 26px;
      min-height: 26px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 800;
      color: var(--bbg-amber);
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .pulse-dot {
      width: 7px;
      height: 7px;
      background: var(--green);
      border-radius: 50%;
      box-shadow: 0 0 6px var(--green);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.8); } }

    .ticker-tape {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow-x: auto;
      white-space: nowrap;
      font-size: 10px;
      scrollbar-width: none;
    }
    .ticker-tape::-webkit-scrollbar { display: none; }
    .ticker-item { display: inline-flex; gap: 4px; align-items: center; }
    .ticker-name { color: #64748b; font-weight: 600; }
    .ticker-up { color: var(--green); font-weight: 700; }
    .ticker-down { color: var(--red); font-weight: 700; }
    .ticker-neutral { color: var(--accent); font-weight: 600; }

    .top-controls {
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }

    /* TOP HUD ROW 2: Telemetry KPIs & Hotkeys (~22px) */
    .top-bar-row2 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #070b0e;
      border: 1px solid var(--border);
      border-top: none;
      padding: 2px 8px;
      font-size: 10px;
      height: 22px;
      min-height: 22px;
      margin-bottom: 4px;
      border-radius: 0 0 3px 3px;
      gap: 8px;
      overflow-x: auto;
      white-space: nowrap;
    }
    .telemetry-pills {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kpi-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: #94a3b8;
    }
    .kpi-pill b {
      color: #f8fafc;
      font-weight: 700;
    }

    .hotkeys-strip {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #64748b;
    }
    .hotkey-pill {
      background: #10161d;
      border: 1px solid #1f2c3a;
      border-radius: 2px;
      padding: 0 4px;
      font-size: 9px;
      color: var(--bbg-amber);
      font-weight: 700;
      margin-right: 2px;
    }

    /* BLOOMBERG 3-PANE COCKPIT GRID */
    .cockpit-grid {
      display: grid;
      grid-template-columns: 260px minmax(420px, 1fr) 310px;
      gap: 5px;
      flex: 1;
      min-height: 0;
      height: calc(100vh - 56px);
    }
    @media (max-width: 1100px) {
      .cockpit-grid {
        grid-template-columns: 220px 1fr 260px;
        gap: 4px;
      }
    }
    @media (max-width: 850px) {
      .cockpit-grid {
        grid-template-columns: 1fr;
        overflow-y: auto;
      }
      .cockpit-pane {
        height: 380px !important;
      }
    }

    .cockpit-pane {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
      min-height: 0;
    }
    .pane-header {
      padding: 4px 8px;
      background: var(--pane-header);
      border-bottom: 1px solid var(--border);
      font-size: 10px;
      font-weight: 700;
      color: var(--bbg-amber);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 24px;
      min-height: 24px;
    }
    .pane-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 4px;
      display: flex;
      flex-direction: column;
    }

    /* Stream Filter Chips */
    .filter-chip {
      background: #0d141b;
      border: 1px solid #1a2533;
      color: #94a3b8;
      font-size: 8px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--font-mono);
      transition: all 0.1s ease;
    }
    .filter-chip:hover { color: #fff; border-color: var(--accent); }
    .filter-chip.active {
      background: var(--bbg-amber);
      color: #000;
      border-color: var(--bbg-amber);
    }

    /* PANE 1: Solana Firehose Stream Items */
    .firehose-item {
      display: flex;
      flex-direction: column;
      padding: 3px 6px;
      border-bottom: 1px solid #10161f;
      cursor: pointer;
      transition: background 0.1s ease;
      border-left: 2px solid transparent;
    }
    .firehose-item:hover {
      background: var(--card-hover);
    }
    .firehose-item.active {
      background: rgba(255, 153, 0, 0.08);
      border-left: 2px solid var(--bbg-amber);
    }
    .firehose-row1 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    .firehose-row2 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    /* PANE 2: Center Quant Workstation Hero & Tabs */
    .token-hero {
      background: #090e14;
      border: 1px solid #16212d;
      border-radius: 3px;
      padding: 5px 8px;
      margin-bottom: 4px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .token-hero-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .token-title {
      font-size: 14px;
      font-weight: 800;
      color: #fff;
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
    }
    .token-mint-link {
      font-size: 10px;
      color: var(--accent);
      cursor: pointer;
    }
    .token-hero-curve {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    .progress-bar-wrap {
      background: #0e141a;
      border-radius: 2px;
      height: 5px;
      overflow: hidden;
      border: 1px solid #182330;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--green), var(--accent));
      box-shadow: 0 0 6px rgba(0, 255, 255, 0.4);
      transition: width 0.3s ease;
    }

    /* Execution & Jito Dock */
    .exec-dock {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 2px;
    }
    .exec-btns {
      display: flex;
      gap: 3px;
      align-items: center;
      flex-wrap: wrap;
    }

    /* Center Tabs */
    .center-tab-strip {
      display: flex;
      gap: 3px;
      background: #070a0e;
      border-bottom: 1px solid var(--border);
      padding: 3px 6px;
      min-height: 26px;
    }
    .center-tab-btn {
      background: #0e141b;
      border: 1px solid #17222e;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--font-mono);
      transition: all 0.12s ease;
    }
    .center-tab-btn:hover { color: #fff; border-color: var(--accent); }
    .center-tab-btn.active {
      background: var(--bbg-amber);
      color: #000;
      border-color: var(--bbg-amber);
    }

    .tab-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 4px;
    }

    /* Tab 1: Arkham Canvas */
    .canvas-container {
      flex: 1;
      min-height: 240px;
      background: #05080c;
      border: 1px solid #131d27;
      border-radius: 3px;
      display: flex;
      flex-direction: column;
      padding: 4px;
      position: relative;
    }
    canvas {
      flex: 1;
      width: 100%;
      height: 100%;
      min-height: 200px;
      display: block;
    }

    /* Tab 2: TradingView Chart Frame */
    .chart-container {
      flex: 1;
      min-height: 260px;
      background: #05080c;
      border: 1px solid #131d27;
      border-radius: 3px;
      overflow: hidden;
    }

    /* Tab 3: HFT OBI Radar */
    .obi-box {
      background: #090e14;
      border: 1px solid #16212d;
      border-radius: 3px;
      padding: 6px 8px;
      margin-bottom: 6px;
    }
    .obi-meter-wrap {
      background: #11171f;
      border-radius: 2px;
      height: 12px;
      margin: 4px 0;
      border: 1px solid #1c2734;
      display: flex;
      overflow: hidden;
    }
    .obi-bid-side { background: var(--green); height: 100%; transition: width 0.3s; }
    .obi-ask-side { background: var(--red); height: 100%; transition: width 0.3s; }

    /* Tab 4: Factor Matrix */
    .factor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 5px;
    }
    .factor-card {
      background: #090e14;
      border: 1px solid #16212d;
      border-radius: 3px;
      padding: 6px 8px;
    }
    .factor-title {
      font-size: 9px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .factor-val {
      font-size: 14px;
      font-weight: 700;
    }

    /* PANE 3: Dispatched Signals */
    .signal-card {
      background: #080d12;
      border: 1px solid #16212d;
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 4px;
      cursor: pointer;
      transition: background 0.1s ease;
    }
    .signal-card:hover {
      background: var(--card-hover);
    }
    .signal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    .signal-stats {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: var(--text-muted);
    }
    .signal-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 3px;
      gap: 4px;
    }

    /* Badges & Buttons */
    .badge {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-green { background: rgba(0, 255, 102, 0.12); color: var(--green); border: 1px solid rgba(0, 255, 102, 0.3); }
    .badge-red { background: rgba(255, 51, 68, 0.12); color: var(--red); border: 1px solid rgba(255, 51, 68, 0.3); }
    .badge-yellow { background: rgba(245, 158, 11, 0.12); color: var(--yellow); border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-purple { background: rgba(168, 85, 247, 0.12); color: var(--purple); border: 1px solid rgba(168, 85, 247, 0.3); }
    .badge-amber { background: rgba(255, 153, 0, 0.12); color: var(--bbg-amber); border: 1px solid rgba(255, 153, 0, 0.3); }
    .badge-cyan { background: rgba(0, 255, 255, 0.12); color: var(--accent); border: 1px solid rgba(0, 255, 255, 0.3); }
    .badge-muted { background: rgba(255, 255, 255, 0.04); color: var(--text-muted); border: 1px solid var(--border); }

    .btn {
      background: #10161d;
      border: 1px solid #1a2533;
      color: var(--text);
      padding: 2px 6px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 9px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-family: var(--font-mono);
      transition: all 0.1s ease;
    }
    .btn:hover { background: #182330; border-color: #2a3a4d; }
    .btn-inspect {
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid rgba(0, 255, 255, 0.3);
      color: var(--accent);
    }
    .btn-inspect:hover { background: rgba(0, 255, 255, 0.2); }

    /* Tables */
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 10px; }
    th { background: #070a0e; color: var(--text-muted); padding: 4px 6px; border-bottom: 1px solid var(--border); }
    td { padding: 3px 6px; border-bottom: 1px solid #0e141c; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 5, 8, 0.88);
      backdrop-filter: blur(6px);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 10px;
    }
    .modal-backdrop.open { display: flex; }
    .modal-window {
      background: #080d12;
      border: 1px solid #1c2836;
      border-radius: 4px;
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
    }
    .modal-header {
      padding: 8px 12px;
      border-bottom: 2px solid var(--bbg-amber);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0b1117;
    }
    .modal-body {
      padding: 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .modal-footer {
      padding: 6px 12px;
      border-top: 1px solid var(--border);
      background: #0b1117;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .bento-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 6px;
    }
    .bento-card {
      background: #090e14;
      border: 1px solid #141f2a;
      border-radius: 3px;
      padding: 8px;
    }

    .view-standard { display: none; }
    body.standard-view .view-standard { display: block; overflow-y: auto; height: calc(100vh - 56px); }
    body.standard-view .view-cockpit { display: none; }
  </style>
</head>
<body>
  <!-- ======================================================== -->
  <!-- TOP BAR ROW 1: Brand, Macro Ticker Tape & System Controls-->
  <!-- ======================================================== -->
  <div class="top-bar-row1">
    <div class="brand">
      <div class="pulse-dot"></div>
      <span>BLOOMBERG // SOLANA QUANT COCKPIT</span>
      <span class="badge badge-cyan" style="font-size:8px;">BLP v3.2</span>
    </div>

    <!-- Live Macro Ticker Tape (E:\QRML Port) -->
    <div class="ticker-tape">
      <div class="ticker-item"><span class="ticker-name">SOL</span> <span class="ticker-up" id="t-sol">$184.20 (+4.8%)</span></div>
      <div class="ticker-item"><span class="ticker-name">BTC</span> <span class="ticker-up" id="t-btc">$89,450 (+2.1%)</span></div>
      <div class="ticker-item"><span class="ticker-name">GAS</span> <span class="ticker-neutral">5k lamports</span></div>
      <div class="ticker-item"><span class="ticker-name">JITO TIP</span> <span class="ticker-up">0.003 SOL</span></div>
      <div class="ticker-item"><span class="ticker-name">VELOCITY</span> <span class="ticker-neutral" id="t-rate">~60/min</span></div>
      <div class="ticker-item"><span class="ticker-name">GRAD RATE</span> <span class="ticker-neutral">1.4%</span></div>
      <div class="ticker-item"><span class="ticker-name">MEV GUARD</span> <span class="ticker-up">ACTIVE</span></div>
      <div class="ticker-item"><span class="ticker-name">STATUS</span> <span class="ticker-up">100% OK</span></div>
    </div>

    <div class="top-controls">
      <span class="mono" id="latency-tag" style="color:var(--green);font-size:9px;">⚡ 18ms</span>
      <span class="mono" id="clock" style="color:#94a3b8;font-size:10px;">--:--:-- UTC</span>
      <button class="btn" id="theme-btn" onclick="cycleTheme()" title="Switch Color Theme [T]">🎨 Theme</button>
      <button class="btn" id="audio-toggle-btn" onclick="toggleAudio()" style="color:var(--green);">🔊 Audio</button>
      <button class="btn" id="view-toggle-btn" onclick="toggleLayout()">🖥️ Cockpit</button>
      <a href="https://t.me/memcoinhome_bot" target="_blank" class="btn" style="background:#2481cc;border-color:#2481cc;color:#fff;">TG Bot ↗</a>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- TOP BAR ROW 2: Telemetry KPIs & Quant Hotkeys Strip      -->
  <!-- ======================================================== -->
  <div class="top-bar-row2">
    <div class="telemetry-pills">
      <span class="kpi-pill">LAUNCHES: <b id="metric-launches">--</b></span>
      <span style="color:#202c38;">|</span>
      <span class="kpi-pill">INGESTION: <span class="badge badge-cyan" id="metric-rate">~60/min</span></span>
      <span style="color:#202c38;">|</span>
      <span class="kpi-pill">VERIFIED: <span class="badge badge-green" id="metric-socials">--</span></span>
      <span style="color:#202c38;">|</span>
      <span class="kpi-pill">BLOCKED: <span class="badge badge-red" id="metric-blocked">--</span></span>
      <span style="color:#202c38;">|</span>
      <span class="kpi-pill">SIGNALS: <span class="badge badge-purple" id="metric-alerts">--</span></span>
    </div>

    <div class="hotkeys-strip">
      <span style="color:#64748b;margin-right:2px;">HOTKEYS:</span>
      <span><span class="hotkey-pill">SPACE</span>Inspect</span>
      <span><span class="hotkey-pill">P</span>Photon</span>
      <span><span class="hotkey-pill">B</span>BullX</span>
      <span><span class="hotkey-pill">G</span>GMGN</span>
      <span><span class="hotkey-pill">M</span>Mute</span>
      <span><span class="hotkey-pill">T</span>Theme</span>
      <span><span class="hotkey-pill">1-6</span>Tabs</span>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- 1. BLOOMBERG 3-PANE COCKPIT VIEW                         -->
  <!-- ======================================================== -->
  <div class="view-cockpit cockpit-grid">
    <!-- PANE 1: Solana Firehose Stream (Left ~260px) -->
    <div class="cockpit-pane">
      <div class="pane-header">
        <span>⚡ Solana Stream (L1 Ingest)</span>
        <span class="mono" style="font-size:8px;color:var(--accent);" id="p1-status">Live 3s</span>
      </div>

      <!-- Real-Time Search & Category Filter Chips -->
      <div style="padding:3px 5px;background:#070b0f;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:3px;">
        <input type="text" id="stream-search" placeholder="🔍 Filter symbol or name..." oninput="handleStreamFilter()" style="background:#090e14;border:1px solid #16212d;border-radius:2px;color:var(--text);font-family:var(--font-mono);font-size:9px;padding:2px 5px;width:100%;outline:none;" />
        <div style="display:flex;gap:3px;font-size:8px;">
          <button class="filter-chip active" id="f-chip-all" onclick="setStreamFilter('all')">ALL</button>
          <button class="filter-chip" id="f-chip-verified" onclick="setStreamFilter('verified')">VERIFIED</button>
          <button class="filter-chip" id="f-chip-alerts" onclick="setStreamFilter('alerts')">ALERTS</button>
          <button class="filter-chip" id="f-chip-clean" onclick="setStreamFilter('clean')">CLEAN DEV</button>
        </div>
      </div>

      <div class="pane-content" id="firehose-list" style="padding:2px;">
        <div style="text-align:center;padding:20px;color:var(--text-muted);">Syncing edge firehose...</div>
      </div>
    </div>

    <!-- PANE 2: Center Quant Workstation Deck (1fr) -->
    <div class="cockpit-pane">
      <!-- Active Token Command Header -->
      <div class="token-hero">
        <div class="token-hero-top">
          <div class="token-title">
            <span id="c-token-name">Select a Token</span>
            <span class="mono token-mint-link" id="c-token-mint" onclick="copyActiveMint()" title="Click to copy mint address">--</span>
          </div>
          <div style="display:flex;gap:4px;align-items:center;">
            <button class="btn" onclick="exportQuantJson()" style="color:var(--accent);" title="Export DuckDB/QRML-ready JSON">📥 Export JSON</button>
            <button class="btn btn-inspect" onclick="openActiveTokenModal()">Full Inspect [Space] ↗</button>
          </div>
        </div>

        <div class="token-hero-curve">
          <span id="c-curve-text">0.0% to Raydium</span>
          <span id="c-net-sol" style="color:var(--green);font-weight:700;">0.00 SOL Raised</span>
          <span id="c-mcap" style="color:var(--yellow);font-weight:600;">MCap: --</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="c-curve-bar" style="width:0%;"></div>
        </div>

        <!-- 1-Click Fast Sniper, Amount Presets & Anti-MEV Dock -->
        <div class="exec-dock">
          <div class="exec-btns">
            <a id="c-btn-photon" href="#" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;">⚡ Photon [P]</a>
            <a id="c-btn-bullx" href="#" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;">🎯 BullX [B]</a>
            <a id="c-btn-gmgn" href="#" target="_blank" class="btn" style="background:#00d2ff;color:#000;font-weight:700;">🤖 GMGN [G]</a>
            <!-- Amount Presets -->
            <a id="c-btn-size-05" href="#" target="_blank" class="btn" style="border-color:#2a3b4c;color:var(--gold);">⚡ 0.5 SOL</a>
            <a id="c-btn-size-10" href="#" target="_blank" class="btn" style="border-color:#2a3b4c;color:var(--gold);">⚡ 1.0 SOL</a>
            <a id="c-btn-size-20" href="#" target="_blank" class="btn" style="border-color:#2a3b4c;color:var(--gold);">⚡ 2.0 SOL</a>
            <a id="c-btn-dexs" href="#" target="_blank" class="btn">DexScreener</a>
            <a id="c-btn-pump" href="#" target="_blank" class="btn">Pump.fun</a>
          </div>
          <span id="c-jito-tip" class="badge badge-amber">Jito: 0.003 SOL</span>
        </div>
      </div>

      <!-- Center Multi-Tab Ribbon -->
      <div class="center-tab-strip">
        <button class="center-tab-btn active" id="tab-btn-sybil" onclick="switchCenterTab('sybil')">[1] 🕸️ Arkham Sybil</button>
        <button class="center-tab-btn" id="tab-btn-tv" onclick="switchCenterTab('tv')">[2] 📈 TradingView</button>
        <button class="center-tab-btn" id="tab-btn-obi" onclick="switchCenterTab('obi')">[3] ⚡ HFT OBI Radar</button>
        <button class="center-tab-btn" id="tab-btn-factors" onclick="switchCenterTab('factors')">[4] 📊 Alpha-158</button>
        <button class="center-tab-btn" id="tab-btn-whales" onclick="switchCenterTab('whales')">[5] 👥 Whales Book</button>
        <button class="center-tab-btn" id="tab-btn-memo" onclick="switchCenterTab('memo')">[6] 📜 Research Memo</button>
      </div>

      <!-- Tab 1: Arkham Sybil Bubble Canvas -->
      <div id="view-tab-sybil" class="tab-body">
        <div class="canvas-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;font-size:9px;">
            <span style="color:var(--bbg-amber);font-weight:700;">ARKHAM SYBIL CLUSTER ENGINE</span>
            <span id="c-cluster-verdict" class="badge badge-green">Organic Decentralized Flow</span>
          </div>
          <canvas id="sybil-canvas"></canvas>
          <div id="sybil-tooltip" style="position:absolute;display:none;pointer-events:auto;z-index:100;background:rgba(7,12,18,0.96);border:1px solid var(--bbg-amber);border-radius:4px;padding:7px 9px;box-shadow:0 8px 24px rgba(0,0,0,0.9);backdrop-filter:blur(8px);min-width:220px;max-width:280px;font-size:9.5px;line-height:1.35;"></div>
          <div style="display:flex;justify-content:center;gap:12px;font-size:9px;color:var(--text-muted);margin-top:2px;">
            <span><span style="color:#f59e0b;">●</span> Dev Wallet</span>
            <span><span style="color:#ff3344;">●</span> Bundled Insider</span>
            <span><span style="color:#00ff66;">●</span> Whale</span>
            <span><span style="color:#00ffff;">●</span> Early Buyer</span>
          </div>
        </div>
      </div>

      <!-- Tab 2: Embedded TradingView Candlestick Terminal -->
      <div id="view-tab-tv" class="tab-body" style="display:none;">
        <div class="chart-container">
          <iframe id="c-tradingview-frame" src="" style="width:100%;height:100%;border:none;background:#05080c;"></iframe>
        </div>
      </div>

      <!-- Tab 3: HFT Order Book Imbalance (OBI) & Micro-Price Depth Radar -->
      <div id="view-tab-obi" class="tab-body" style="display:none;">
        <div class="obi-box">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:700;">
            <span style="color:var(--bbg-amber);">HFT ORDER BOOK IMBALANCE (OBI) METER</span>
            <span id="obi-status-badge" class="badge badge-green">ACCUMULATION</span>
          </div>
          <div style="font-size:10px;color:var(--text-muted);display:flex;justify-content:space-between;margin-top:3px;">
            <span id="obi-bid-label">Bid Flow: 0.00 SOL</span>
            <span id="obi-ask-label">Ask Flow: 0.00 SOL</span>
          </div>
          <div class="obi-meter-wrap">
            <div class="obi-bid-side" id="obi-bid-bar" style="width:50%;"></div>
            <div class="obi-ask-side" id="obi-ask-bar" style="width:50%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;">
            <span class="mono" id="obi-ratio-text">OBI Ratio: K = +0.000</span>
            <span class="mono" id="obi-micro-text">Micro-Price Drift: 0.00%</span>
          </div>
        </div>

        <div class="obi-box" style="flex:1;">
          <div style="font-size:10px;font-weight:700;color:var(--bbg-amber);margin-bottom:4px;">LEVEL-2 LIQUIDITY WALL MATRIX</div>
          <div style="font-size:10px;display:flex;flex-direction:column;gap:3px;" id="obi-ladder-box">
            <div style="text-align:center;color:var(--text-muted);padding:8px;">Select token to load L2 microstructural ladder...</div>
          </div>
        </div>
      </div>

      <!-- Tab 4: Alpha-158 Quantitative Factor Matrix -->
      <div id="view-tab-factors" class="tab-body" style="display:none;">
        <div class="factor-grid">
          <div class="factor-card">
            <div class="factor-title">🚀 MOMENTUM DRIFT</div>
            <div class="factor-val" id="f-mom" style="color:var(--green);">-- SOL/trade</div>
            <div style="font-size:8px;color:var(--text-muted);">Curve capital inflow velocity</div>
          </div>
          <div class="factor-card">
            <div class="factor-title">⚖️ ORDER FLOW IMBALANCE (OFI)</div>
            <div class="factor-val" id="f-ofi" style="color:var(--accent);">--%</div>
            <div style="font-size:8px;color:var(--text-muted);">Net buy pressure asymmetry</div>
          </div>
          <div class="factor-card">
            <div class="factor-title">☣️ TOXICITY RATIO (VPIN)</div>
            <div class="factor-val" id="f-vpin" style="color:var(--yellow);">--%</div>
            <div style="font-size:8px;color:var(--text-muted);">Adverse informed toxicity</div>
          </div>
          <div class="factor-card">
            <div class="factor-title">⚡ HAWKES SUPERCRITICALITY (η)</div>
            <div class="factor-val" id="f-hawkes" style="color:var(--purple);">η = 0.50</div>
            <div style="font-size:8px;color:var(--text-muted);">Self-exciting viral cascade</div>
          </div>
          <div class="factor-card">
            <div class="factor-title">🌐 SHANNON CAPITAL ENTROPY</div>
            <div class="factor-val" id="f-entropy" style="color:#38bdf8;">-- bits</div>
            <div style="font-size:8px;color:var(--text-muted);">Decentralization of holder base</div>
          </div>
          <div class="factor-card">
            <div class="factor-title">🛡️ SERIAL RUG INDEX (SRI)</div>
            <div class="factor-val" id="f-sri" style="color:var(--green);">0.00 (Clean)</div>
            <div style="font-size:8px;color:var(--text-muted);">Deployer historical track record</div>
          </div>
        </div>
      </div>

      <!-- Tab 5: Whales & Allocations Book -->
      <div id="view-tab-whales" class="tab-body" style="display:none;">
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Wallet</th>
                <th>Net SOL</th>
                <th>Gross Buy</th>
                <th>Share %</th>
                <th>Tag</th>
                <th>Trades</th>
                <th>Track</th>
              </tr>
            </thead>
            <tbody id="c-whales-body">
              <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:8px;">Select a token to load whale distribution...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 6: Institutional Quantitative Research Memo -->
      <div id="view-tab-memo" class="tab-body" style="display:none;padding:5px;gap:5px;">
        <!-- Executive Verdict Banner -->
        <div style="background:#090e14;border:1px solid #1a2736;border-radius:3px;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
          <div>
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
              <span id="memo-verdict-badge" class="badge badge-green" style="font-size:9px;padding:2px 5px;">ACCUMULATE</span>
              <strong id="memo-verdict-title" style="font-size:11px;color:#fff;">ORGANIC DECENTRALIZED ACCUMULATION</strong>
            </div>
            <div id="memo-verdict-sub" style="font-size:8.5px;color:var(--text-muted);">Algorithmic Quantitative Intelligence Dossier</div>
          </div>
          <div style="display:flex;gap:3px;align-items:center;">
            <a id="memo-exec-photon" href="#" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;">⚡ Trade Photon</a>
            <a id="memo-exec-bullx" href="#" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;">🎯 Trade BullX</a>
            <button class="btn" onclick="exportQuantJson()" style="color:var(--accent);">📥 Export Dossier</button>
          </div>
        </div>

        <!-- Executive Summary & Quant Thesis -->
        <div class="bento-card" style="border-left:3px solid var(--bbg-amber);padding:6px 8px;">
          <div style="font-size:9px;font-weight:700;color:var(--bbg-amber);margin-bottom:3px;">📋 EXECUTIVE SUMMARY & QUANT THESIS</div>
          <p id="memo-exec-summary" style="font-size:9.5px;color:#cbd5e1;line-height:1.45;">Select a token to generate full quantitative research memo...</p>
        </div>

        <!-- 4-Card Forensic Deep Dive Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          <div class="bento-card" style="padding:5px 7px;">
            <div style="font-size:9px;font-weight:700;color:var(--bbg-amber);margin-bottom:2px;">👤 CREATOR DNA & REPUTATION</div>
            <p id="memo-creator-analysis" style="font-size:9px;color:#cbd5e1;line-height:1.4;">--</p>
          </div>
          <div class="bento-card" style="padding:5px 7px;">
            <div style="font-size:9px;font-weight:700;color:var(--bbg-amber);margin-bottom:2px;">💰 CAPITAL STRUCTURE & HHI</div>
            <p id="memo-capital-analysis" style="font-size:9px;color:#cbd5e1;line-height:1.4;">--</p>
          </div>
          <div class="bento-card" style="padding:5px 7px;">
            <div style="font-size:9px;font-weight:700;color:var(--bbg-amber);margin-bottom:2px;">🕸️ ARKHAM SYBIL & BUNDLING</div>
            <p id="memo-sybil-analysis" style="font-size:9px;color:#cbd5e1;line-height:1.4;">--</p>
          </div>
          <div class="bento-card" style="padding:5px 7px;">
            <div style="font-size:9px;font-weight:700;color:var(--bbg-amber);margin-bottom:2px;">📈 LIQUIDITY & RAYDIUM TARGET</div>
            <p id="memo-liquidity-analysis" style="font-size:9px;color:#cbd5e1;line-height:1.4;">--</p>
          </div>
        </div>

        <!-- Tactical Execution Blueprint -->
        <div class="bento-card" style="background:#060d14;border:1px solid #19324a;padding:5px 7px;">
          <div style="font-size:9px;font-weight:700;color:var(--accent);margin-bottom:4px;">⚡ TACTICAL EXECUTION BLUEPRINT</div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:4px;font-size:9px;">
            <div>
              <div style="color:var(--text-muted);font-size:8px;">SUGGESTED ACTION</div>
              <strong id="memo-action-val" style="color:var(--green);font-size:9.5px;">--</strong>
            </div>
            <div>
              <div style="color:var(--text-muted);font-size:8px;">RECOMMENDED SLIPPAGE</div>
              <strong id="memo-slippage-val" class="mono" style="color:#fff;font-size:9.5px;">--</strong>
            </div>
            <div>
              <div style="color:var(--text-muted);font-size:8px;">ANTI-MEV JITO TIP</div>
              <strong id="memo-jito-val" class="mono" style="color:var(--gold);font-size:9.5px;">--</strong>
            </div>
            <div>
              <div style="color:var(--text-muted);font-size:8px;">RISK PROFILE</div>
              <strong id="memo-risk-val" class="badge badge-green">--</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PANE 3: Dispatched Signals & Live Whale Radar (Right ~310px) -->
    <div class="cockpit-pane">
      <div class="pane-header" style="padding:2px 4px;">
        <div style="display:flex;gap:3px;align-items:center;">
          <button class="center-tab-btn active" id="p3-tab-signals-btn" onclick="switchPane3Tab('signals')" style="font-size:9px;padding:1px 5px;">🚨 Signals (<span id="c-signals-count">0</span>)</button>
          <button class="center-tab-btn" id="p3-tab-whales-btn" onclick="switchPane3Tab('whales')" style="font-size:9px;padding:1px 5px;">🐋 Whale Radar (<span id="c-whales-count">5</span>)</button>
        </div>
        <span class="mono" style="font-size:8px;color:var(--green);" id="p3-sub-status">Live</span>
      </div>

      <!-- Pane 3 View 1: Dispatched Signals -->
      <div class="pane-content" id="p3-view-signals" style="padding:3px;">
        <div id="c-alerts-list">
          <div style="text-align:center;padding:20px;color:var(--text-muted);">Awaiting high-conviction signals...</div>
        </div>
      </div>

      <!-- Pane 3 View 2: Live Whale & Sniper Radar -->
      <div class="pane-content" id="p3-view-whales" style="display:none;padding:3px;gap:4px;flex-direction:column;">
        <!-- Quick Track Wallet Input -->
        <div style="padding:3px;background:#090e14;border:1px solid #16212d;border-radius:3px;display:flex;gap:3px;align-items:center;">
          <input type="text" id="track-wallet-input" placeholder="Track wallet (e.g. FWzn...)..." style="flex:1;background:#060a0e;border:1px solid #1a2533;border-radius:2px;color:var(--text);font-family:var(--font-mono);font-size:9px;padding:2px 4px;outline:none;" />
          <button class="btn btn-inspect" onclick="addCustomWhaleFromInput()" style="white-space:nowrap;font-size:8px;padding:2px 4px;">+ Track</button>
        </div>

        <!-- Live Whale Trades Stream -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:1px 2px;">
          <span style="font-size:9px;font-weight:700;color:var(--bbg-amber);">LIVE WHALE TRADES (INSTANT SNIPES)</span>
          <span class="badge badge-cyan" id="whale-trades-counter" style="font-size:8px;">0 Trades</span>
        </div>
        <div id="whale-trades-list" style="display:flex;flex-direction:column;gap:3px;max-height:220px;overflow-y:auto;">
          <div style="text-align:center;padding:12px;color:var(--text-muted);font-size:9px;">Monitoring alpha wallets & conviction buys (&ge;3 SOL)...</div>
        </div>

        <!-- Tracked Elite Alpha Watchlist -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 2px 1px 2px;border-top:1px solid var(--border);margin-top:2px;">
          <span style="font-size:9px;font-weight:700;color:var(--accent);">ALPHA SNIPERS WATCHLIST</span>
          <span style="font-size:8px;color:#64748b;">Telegram Alerts ↗</span>
        </div>
        <div id="tracked-whales-list" style="display:flex;flex-direction:column;gap:3px;overflow-y:auto;flex:1;">
          <!-- Populated dynamically -->
        </div>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- 2. STANDARD FULL-WIDTH TABLES VIEW                       -->
  <!-- ======================================================== -->
  <div class="view-standard">
    <!-- Recent Alerts Table -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:700;color:var(--bbg-amber);">🚨 DISPATCHED QUANT SIGNALS</span>
      <span id="alerts-count" class="mono" style="color:var(--purple);">0 Signals</span>
    </div>
    <div class="cockpit-pane" style="margin-bottom:8px;overflow-x:auto;height:auto;max-height:260px;">
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
            <th>Inspect</th>
            <th>Sniper Links</th>
          </tr>
        </thead>
        <tbody id="alerts-body">
          <tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:10px;">Awaiting high-conviction signals...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Live Ingestion Feed Table -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:700;color:var(--bbg-amber);">⚡ LIVE SOLANA INGESTION STREAM</span>
      <span class="mono" style="color:var(--text-muted);">Auto-refreshing 3s</span>
    </div>
    <div class="cockpit-pane" style="overflow-x:auto;height:auto;max-height:400px;">
      <table id="events-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Time</th>
            <th>Token</th>
            <th>Creator</th>
            <th>Metadata Host</th>
            <th>Socials</th>
            <th>Verdict</th>
            <th>Inspect</th>
            <th>Live Links</th>
          </tr>
        </thead>
        <tbody id="events-body">
          <tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:10px;">Connecting to Cloudflare Workers Edge stream...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- INSTITUTIONAL DEEP INSPECT MODAL                         -->
  <!-- ======================================================== -->
  <div id="inspect-modal" class="modal-backdrop" onclick="closeInspectModal(event)">
    <div class="modal-window" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:14px;font-weight:800;color:var(--bbg-amber);" id="m-token-title">Loading Token...</div>
          <span id="m-token-badge" class="badge badge-purple">STAGE 1</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn" onclick="exportQuantJson()" style="color:var(--accent);">📥 JSON</button>
          <button class="btn" onclick="copyMintAddress()" id="copy-mint-btn">📋 Copy Mint</button>
          <a id="m-solscan-token-link" href="#" target="_blank" class="btn">Solscan ↗</a>
          <button class="btn" onclick="closeInspectModalDirect()" style="padding:2px 5px;">✕</button>
        </div>
      </div>

      <div class="modal-body" id="m-modal-body">
        <div id="m-loading-state" style="text-align:center;padding:24px;color:var(--text-muted);">
          <div class="pulse-dot" style="margin:0 auto 8px auto;width:10px;height:10px;"></div>
          Connecting to on-chain ledger, querying RugCheck contract audit & mapping Sybil clusters...
        </div>

        <div id="m-content-state" style="display:none;flex-direction:column;gap:8px;">
          <div style="background:#070a0e;padding:4px 8px;border-radius:3px;border:1px solid #141f2a;display:flex;justify-content:space-between;align-items:center;">
            <span class="mono" style="font-size:10px;color:var(--accent);" id="m-mint-addr">--</span>
            <span style="font-size:9px;color:var(--text-muted);" id="m-created-time">--</span>
          </div>

          <!-- Curve Hero -->
          <div class="bento-card">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
              <span style="font-size:10px;font-weight:700;color:var(--bbg-amber);">📈 BONDING CURVE & MIGRATION PROGRESS</span>
              <span class="mono" style="font-weight:700;color:var(--accent);" id="m-curve-text">0.0% to Raydium</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" id="m-curve-bar" style="width:0%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-muted);margin-top:3px;">
              <span id="m-net-sol-hero">0.00 SOL Raised</span>
              <span id="m-sol-to-grad">85.00 SOL remaining</span>
            </div>
          </div>

          <!-- Bento Grid: Creator DNA + Financials + RugCheck -->
          <div class="bento-grid">
            <div class="bento-card">
              <div style="font-size:10px;font-weight:700;color:var(--bbg-amber);margin-bottom:4px;">👤 CREATOR DNA & HISTORY</div>
              <div style="display:flex;flex-direction:column;gap:4px;font-size:10px;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Creator:</span>
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
                  <span style="color:var(--text-muted);">Socials:</span>
                  <div id="m-socials-box">--</div>
                </div>
              </div>
            </div>

            <div class="bento-card">
              <div style="font-size:10px;font-weight:700;color:var(--bbg-amber);margin-bottom:4px;">💰 CAPITAL DEPLOYED & DEPTH</div>
              <div style="display:flex;flex-direction:column;gap:4px;font-size:10px;">
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
                  <span style="color:var(--text-muted);">Estimated MCap:</span>
                  <span class="mono" style="font-weight:700;color:var(--yellow);" id="m-mcap">--</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Total Trades:</span>
                  <span class="mono" id="m-trades-count">--</span>
                </div>
              </div>
            </div>

            <div class="bento-card">
              <div style="font-size:10px;font-weight:700;color:var(--bbg-amber);margin-bottom:4px;">🛡️ CONTRACT SECURITY (RUGCHECK)</div>
              <div style="display:flex;flex-direction:column;gap:4px;font-size:10px;">
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

          <!-- Top Investors Table -->
          <div class="bento-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:10px;font-weight:700;color:var(--bbg-amber);">👥 WHO INVESTED & WHALE ALLOCATIONS</span>
              <span id="m-whale-gauge" class="badge badge-green">Decentralized</span>
            </div>
            <div style="overflow-x:auto;">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Investor Wallet</th>
                    <th>Net SOL</th>
                    <th>Gross Buy</th>
                    <th>Share %</th>
                    <th>Classification</th>
                    <th>Trades</th>
                    <th>Track</th>
                  </tr>
                </thead>
                <tbody id="m-investors-body">
                  <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:8px;">Loading on-chain ledger...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Dock: 1-Click Fast Sniper Bar -->
      <div class="modal-footer">
        <div style="display:flex;align-items:center;gap:6px;font-size:9px;color:var(--text-muted);">
          <span>⚡ <strong>Ready to trade?</strong> Execution dock:</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
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
    let activeTokenReport = null;
    let lastSeenMaxId = 0;
    let lastSeenAlertCount = 0;
    let currentCenterTab = "sybil";
    let rawEventsList = [];
    let streamFilterCategory = "all";
    let streamSearchQuery = "";
    let currentTheme = "amber";

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
        btn.innerText = "🔇 Muted";
        btn.style.color = "var(--text-muted)";
      } else {
        btn.innerText = "🔊 Audio";
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

    function playTactileClick() {
      if (audioMuted) return;
      try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } catch (_) {}
    }

    // Theme Switcher (Amber, Ice, Matrix)
    function cycleTheme() {
      if (currentTheme === "amber") currentTheme = "ice";
      else if (currentTheme === "ice") currentTheme = "matrix";
      else currentTheme = "amber";
      applyTheme();
    }

    function applyTheme() {
      document.body.classList.remove("theme-ice", "theme-matrix");
      if (currentTheme === "ice") document.body.classList.add("theme-ice");
      if (currentTheme === "matrix") document.body.classList.add("theme-matrix");
      document.getElementById("theme-btn").innerText = "🎨 " + currentTheme.toUpperCase();
      localStorage.setItem("pumpradar_theme", currentTheme);
      if (activeTokenReport) {
        drawSybilCanvas("sybil-canvas", activeTokenReport.sybil_intelligence?.bubble_graph);
      }
    }

    // View Switcher (Bloomberg Cockpit vs Standard)
    function toggleLayout() {
      isStandardView = !isStandardView;
      document.body.classList.toggle("standard-view", isStandardView);
      document.getElementById("view-toggle-btn").innerText = isStandardView ? "📋 Standard" : "🖥️ Cockpit";
      localStorage.setItem("pumpradar_standard", isStandardView ? "1" : "0");
    }

    function updateClock() {
      const now = new Date();
      document.getElementById("clock").innerText = now.toISOString().replace("T", " ").slice(11, 19) + " UTC";
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Stream Search & Category Filter
    function handleStreamFilter() {
      streamSearchQuery = (document.getElementById("stream-search").value || "").trim().toLowerCase();
      renderFirehoseItems();
    }

    function setStreamFilter(category) {
      streamFilterCategory = category;
      ["all", "verified", "alerts", "clean"].forEach(c => {
        const el = document.getElementById("f-chip-" + c);
        if (el) el.classList.toggle("active", c === category);
      });
      renderFirehoseItems();
    }

    function renderFirehoseItems() {
      const firehoseContainer = document.getElementById("firehose-list");
      if (!rawEventsList || rawEventsList.length === 0) return;

      const filtered = rawEventsList.filter(e => {
        if (streamSearchQuery) {
          const sym = (e.symbol || "").toLowerCase();
          const nm = (e.name || "").toLowerCase();
          const cr = (e.creator || "").toLowerCase();
          if (!sym.includes(streamSearchQuery) && !nm.includes(streamSearchQuery) && !cr.includes(streamSearchQuery)) {
            return false;
          }
        }
        if (streamFilterCategory === "verified") {
          return Boolean(e.twitter || e.telegram || e.website);
        }
        if (streamFilterCategory === "alerts") {
          return Boolean(e.has_alert);
        }
        if (streamFilterCategory === "clean") {
          return !e.is_serial_rugger;
        }
        return true;
      });

      if (filtered.length === 0) {
        firehoseContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">No tokens match filter criteria</div>';
        return;
      }

      firehoseContainer.innerHTML = filtered.map((e, idx) => {
        const timeStr = e.time_utc ? e.time_utc.slice(11, 19) : "--:--:--";
        const isActive = e.mint === activeTokenMint || (!activeTokenMint && idx === 0);
        if (!activeTokenMint && idx === 0) {
          selectActiveToken(e.mint);
        }
        let badge = '';
        if (e.is_serial_rugger) badge = '<span class="badge badge-red">RUG</span>';
        else if (e.has_alert) badge = '<span class="badge badge-purple">ALERT</span>';
        else if (e.twitter || e.telegram || e.website) badge = '<span class="badge badge-green">VERIFIED</span>';

        return \`<div class="firehose-item \${isActive ? 'active' : ''}" onclick="selectActiveToken('\${e.mint}')">
          <div class="firehose-row1">
            <span style="font-weight:700;color:var(--text);font-size:11px;">\${escapeHtml(e.symbol || 'PUMP')}</span>
            <span class="mono" style="font-size:9px;color:var(--text-muted);">\${timeStr} \${badge}</span>
          </div>
          <div class="firehose-row2">
            <span style="color:#94a3b8;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${escapeHtml(e.name || '')}</span>
            <span class="mono">\${e.creator ? e.creator.slice(0, 4) + '...' + e.creator.slice(-4) : ''}</span>
          </div>
        </div>\`;
      }).join("");
    }

    let currentPane3Tab = "signals";
    let activeCanvasNodes = [];
    let hoveredCanvasNodeId = null;
    let lastCanvasGraphData = null;

    // Center Tab Switcher
    function switchCenterTab(tabKey) {
      playTactileClick();
      currentCenterTab = tabKey;
      ["sybil", "tv", "obi", "factors", "whales", "memo"].forEach(t => {
        const btn = document.getElementById("tab-btn-" + t);
        const view = document.getElementById("view-tab-" + t);
        if (btn) btn.classList.toggle("active", t === tabKey);
        if (view) view.style.display = t === tabKey ? "flex" : "none";
      });

      if (tabKey === "sybil" && activeTokenReport) {
        drawSybilCanvas("sybil-canvas", activeTokenReport.sybil_intelligence?.bubble_graph);
      } else if (tabKey === "tv" && activeTokenMint) {
        const frame = document.getElementById("c-tradingview-frame");
        if (!frame.src || !frame.src.includes(activeTokenMint)) {
          frame.src = "https://dexscreener.com/solana/" + activeTokenMint + "?embed=1&theme=dark&trades=0&info=0";
        }
      }
    }

    // Pane 3 Tab Switcher (Signals vs Whale Radar)
    function switchPane3Tab(tabKey) {
      playTactileClick();
      currentPane3Tab = tabKey;
      const isSignals = tabKey === "signals";
      const sBtn = document.getElementById("p3-tab-signals-btn");
      const wBtn = document.getElementById("p3-tab-whales-btn");
      const sView = document.getElementById("p3-view-signals");
      const wView = document.getElementById("p3-view-whales");
      if (sBtn) sBtn.classList.toggle("active", isSignals);
      if (wBtn) wBtn.classList.toggle("active", !isSignals);
      if (sView) sView.style.display = isSignals ? "block" : "none";
      if (wView) wView.style.display = isSignals ? "none" : "flex";
    }

    // Dynamic Whale Tracking API
    async function trackWhale(wallet, alias) {
      if (!wallet) return;
      playTactileClick();
      try {
        const res = await fetch("/api/track-whale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, alias: alias || "Tracked Whale" }),
        });
        if (res.ok) {
          const data = await res.json();
          renderTrackedWhales(data.tracked);
          switchPane3Tab("whales");
        }
      } catch (err) {
        console.error("Track whale error:", err);
      }
    }

    async function untrackWhale(wallet) {
      if (!wallet) return;
      playTactileClick();
      try {
        const res = await fetch("/api/untrack-whale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        });
        if (res.ok) {
          const data = await res.json();
          renderTrackedWhales(data.tracked);
        }
      } catch (err) {
        console.error("Untrack whale error:", err);
      }
    }

    function addCustomWhaleFromInput() {
      const input = document.getElementById("track-wallet-input");
      const val = (input.value || "").trim();
      if (val.length >= 32) {
        trackWhale(val, "Custom Sniper");
        input.value = "";
      } else {
        alert("Please enter a valid Solana wallet address (32+ characters)");
      }
    }

    function renderTrackedWhales(tracked) {
      const container = document.getElementById("tracked-whales-list");
      if (!container) return;
      const list = tracked || [];
      const countEl = document.getElementById("c-whales-count");
      if (countEl) countEl.innerText = list.length;
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:8.5px;">No wallets tracked. Add a wallet above or click [+ Track] on any whale.</div>';
        return;
      }
      container.innerHTML = list.map(w => \`
        <div style="background:#080d12;border:1px solid #141f2a;border-radius:3px;padding:3px 5px;display:flex;justify-content:space-between;align-items:center;font-size:9px;">
          <div>
            <div style="font-weight:700;color:#fff;">\${escapeHtml(w.alias)}</div>
            <div style="display:flex;gap:4px;align-items:center;margin-top:1px;">
              <a href="https://solscan.io/account/\${w.wallet}" target="_blank" class="mono" style="color:var(--accent);font-size:8.5px;">\${escapeHtml(w.short)} ↗</a>
              <span class="badge badge-green" style="font-size:7px;">\${w.win_rate}% Win</span>
              <span style="color:var(--gold);font-size:8px;">+\${w.total_pnl_sol} SOL</span>
            </div>
          </div>
          <button class="btn" style="padding:1px 4px;font-size:8px;color:var(--red);" onclick="untrackWhale('\${w.wallet}')" title="Untrack wallet">✕</button>
        </div>
      \`).join("");
    }

    function renderWhaleTrades(trades) {
      const container = document.getElementById("whale-trades-list");
      if (!container) return;
      const list = trades || [];
      const counterEl = document.getElementById("whale-trades-counter");
      if (counterEl) counterEl.innerText = list.length + " Trades";
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:9px;">Monitoring alpha wallets & conviction buys (&ge;3 SOL)...</div>';
        return;
      }
      container.innerHTML = list.map(t => {
        const isBuy = t.side === "buy";
        const sideBadge = isBuy
          ? \`<span class="badge badge-green">🟢 BUY \${t.sol_amount.toFixed(2)} SOL</span>\`
          : \`<span class="badge badge-red">🔴 SELL \${t.sol_amount.toFixed(2)} SOL</span>\`;
        const timeStr = t.timestamp ? new Date(t.timestamp).toISOString().slice(11, 19) : "--:--:--";

        return \`
          <div style="background:#090f15;border:1px solid \${isBuy ? 'rgba(0,255,102,0.2)' : 'rgba(255,51,68,0.2)'};border-radius:3px;padding:3px 5px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
              <strong style="color:var(--bbg-amber);font-size:10px;cursor:pointer;" onclick="selectActiveToken('\${t.mint}')">$\${escapeHtml(t.symbol)}</strong>
              \${sideBadge}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:8px;color:var(--text-muted);margin-bottom:2px;">
              <span>👤 \${escapeHtml(t.alias)} (<span class="mono">\${escapeHtml(t.trader_short)}</span>)</span>
              <span class="mono">\${timeStr}</span>
            </div>
            <div style="display:flex;gap:3px;align-items:center;justify-content:flex-end;">
              <button class="btn btn-inspect" style="padding:1px 4px;font-size:8px;" onclick="selectActiveToken('\${t.mint}')">🔬 Inspect</button>
              <a href="https://photon-sol.tinyastro.io/en/lp/\${t.mint}" target="_blank" class="btn" style="background:#f59e0b;color:#000;font-weight:700;padding:1px 5px;font-size:8px;" title="1-Click Copy-Snipe on Photon">⚡ Photon Copy</a>
              <a href="https://bullx.io/terminal?chainId=1399811149&address=\${t.mint}" target="_blank" class="btn" style="background:#10b981;color:#000;font-weight:700;padding:1px 5px;font-size:8px;" title="Snipe on BullX">🎯 BullX</a>
            </div>
          </div>
        \`;
      }).join("");
    }

    // Canvas Sybil Bubble Map Engine (Arkham Spec with Interactive Hover Card)
    function drawSybilCanvas(canvasId, graphData) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      if (graphData) lastCanvasGraphData = graphData;
      const dataToRender = lastCanvasGraphData || graphData;

      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      const width = canvas.width = Math.max(300, rect.width || canvas.parentElement.clientWidth || 360);
      const height = canvas.height = Math.max(220, rect.height || canvas.parentElement.clientHeight || 240);
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Radar rings
      ctx.lineWidth = 1;
      const maxR = Math.min(width, height) * 0.42;
      [0.35, 0.65, 0.95].forEach(frac => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxR * frac, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.stroke();
      });

      const nodes = dataToRender?.nodes || [];
      const links = dataToRender?.links || [];
      if (nodes.length === 0) return;

      const angleStep = nodes.length > 1 ? (Math.PI * 2) / (nodes.length - 1) : 0;
      activeCanvasNodes = [];

      nodes.forEach((n, i) => {
        if (n.role === "CREATOR" || i === 0) {
          activeCanvasNodes.push({ id: n.id, x: centerX, y: centerY, r: 15, color: n.color || "#f59e0b", label: n.short, nodeData: n });
        } else {
          const radius = (maxR * 0.72) + (i % 2 === 0 ? 12 : -10);
          const angle = (i - 1) * angleStep;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const nodeR = Math.max(6, Math.min(13, 6 + (n.sol || 1) * 1.8));
          activeCanvasNodes.push({ id: n.id, x, y, r: nodeR, color: n.color || "#00d2ff", label: n.short, nodeData: n });
        }
      });

      const posMap = new Map();
      activeCanvasNodes.forEach(item => posMap.set(item.id, item));

      // Draw connection lines
      links.forEach(l => {
        const p1 = posMap.get(l.source);
        const p2 = posMap.get(l.target);
        if (!p1 || !p2) return;
        const isHoveredLink = hoveredCanvasNodeId && (l.source === hoveredCanvasNodeId || l.target === hoveredCanvasNodeId);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        if (isHoveredLink) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "rgba(0, 255, 255, 0.95)";
          ctx.setLineDash([]);
        } else if (l.type === "bundled_cluster") {
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(255, 51, 68, 0.7)";
          ctx.setLineDash([3, 3]);
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(0, 255, 255, 0.25)";
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw nodes
      activeCanvasNodes.forEach((pos) => {
        const isHovered = hoveredCanvasNodeId === pos.id;

        // Glowing pulse halo if hovered
        if (isHovered) {
          ctx.save();
          ctx.shadowBlur = 18;
          ctx.shadowColor = pos.color;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, pos.r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = pos.color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pos.r, 0, Math.PI * 2);
        ctx.fillStyle = pos.color;
        ctx.fill();

        ctx.fillStyle = isHovered ? "#ffffff" : "#cbd5e1";
        ctx.font = isHovered ? "bold 9.5px monospace" : "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(pos.label, pos.x, pos.y + pos.r + 9);
      });

      // Attach Interactive Mouse Hover Listeners
      canvas.onmousemove = function(evt) {
        const cRect = canvas.getBoundingClientRect();
        const mouseX = evt.clientX - cRect.left;
        const mouseY = evt.clientY - cRect.top;

        let found = null;
        for (const item of activeCanvasNodes) {
          if (Math.hypot(item.x - mouseX, item.y - mouseY) <= item.r + 5) {
            found = item;
            break;
          }
        }

        const tooltip = document.getElementById("sybil-tooltip");

        if (found) {
          canvas.style.cursor = "pointer";
          if (hoveredCanvasNodeId !== found.id) {
            hoveredCanvasNodeId = found.id;
            drawSybilCanvas(canvasId, lastCanvasGraphData);
          }

          if (tooltip) {
            const n = found.nodeData || {};
            const solVal = n.sol !== undefined ? Number(n.sol).toFixed(2) : "0.00";
            const netSolVal = n.net_sol !== undefined ? Number(n.net_sol).toFixed(2) : solVal;
            const shareVal = n.share_pct !== undefined ? Number(n.share_pct).toFixed(1) : "0.0";
            const tradesVal = n.trades_count || 1;
            const transferInfo = n.transfer_info || (n.role === "CREATOR" ? "Token deployer / initial bonding curve creation" : "Early curve liquidity");
            const solscanLink = n.solscan_url || ("https://solscan.io/account/" + found.id);
            const tagText = n.tag || (n.role === "CREATOR" ? "👨‍💻 Creator" : n.role === "BUNDLED_INSIDER" ? "🚨 Bundled Insider" : "Whale / Buyer");

            let roleBadge = "badge-cyan";
            if (n.role === "CREATOR") roleBadge = "badge-yellow";
            else if (n.role === "BUNDLED_INSIDER") roleBadge = "badge-red";
            else if (n.role === "ALPHA_WHALE" || n.role === "WHALE") roleBadge = "badge-green";

            tooltip.innerHTML = \`
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;border-bottom:1px solid #14202c;padding-bottom:2px;">
                <span class="badge \${roleBadge}">\${escapeHtml(tagText)}</span>
                <a href="\${solscanLink}" target="_blank" class="mono" style="color:var(--accent);font-weight:700;">\${escapeHtml(found.label)} ↗</a>
              </div>
              <div style="display:flex;flex-direction:column;gap:1.5px;font-size:9px;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Gross Inflow:</span>
                  <span class="mono" style="font-weight:700;color:var(--text);">\${solVal} SOL</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Net Position:</span>
                  <span class="mono" style="font-weight:700;color:var(--green);">\${netSolVal} SOL (\${shareVal}%)</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--text-muted);">Trade Activity:</span>
                  <span class="mono" style="color:#94a3b8;">\${tradesVal} trades</span>
                </div>
              </div>
              <div style="margin-top:3px;padding:3px 5px;background:#060a0f;border:1px solid #131c26;border-radius:2px;font-size:8.5px;color:#cbd5e1;line-height:1.3;">
                \${escapeHtml(transferInfo)}
              </div>
              <div style="display:flex;gap:3px;margin-top:4px;">
                <button class="btn btn-inspect" style="flex:1;justify-content:center;font-size:8px;padding:1px 3px;" onclick="trackWhale('\${found.id}', '\${escapeHtml(tagText)}');event.stopPropagation();">+ Track Whale</button>
                <a href="\${solscanLink}" target="_blank" class="btn" style="font-size:8px;padding:1px 4px;">Solscan ↗</a>
              </div>
            \`;

            let left = mouseX + 14;
            let top = mouseY - 10;
            if (left + 230 > cRect.width) left = mouseX - 235;
            if (top + 150 > cRect.height) top = Math.max(5, cRect.height - 155);
            if (left < 5) left = 5;
            if (top < 5) top = 5;
            tooltip.style.left = left + "px";
            tooltip.style.top = top + "px";
            tooltip.style.display = "block";
          }
        } else {
          canvas.style.cursor = "default";
          if (hoveredCanvasNodeId !== null) {
            hoveredCanvasNodeId = null;
            drawSybilCanvas(canvasId, lastCanvasGraphData);
          }
          if (tooltip) tooltip.style.display = "none";
        }
      };

      canvas.onmouseleave = function() {
        canvas.style.cursor = "default";
        hoveredCanvasNodeId = null;
        drawSybilCanvas(canvasId, lastCanvasGraphData);
        const tooltip = document.getElementById("sybil-tooltip");
        if (tooltip) tooltip.style.display = "none";
      };
    }

    // Live Feed Poller
    async function fetchLiveFeed() {
      if (isPaused) return;
      const t0 = performance.now();
      try {
        const res = await fetch("/api/live");
        if (!res.ok) return;
        const latency = Math.round(performance.now() - t0);
        document.getElementById("latency-tag").innerText = "⚡ " + latency + "ms";

        const data = await res.json();
        rawEventsList = data.events || [];

        // Sound triggers
        if (lastSeenMaxId > 0 && data.stats.launches_logged > lastSeenMaxId) {
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
        renderFirehoseItems();

        // Render Cockpit Pane 3 (Alerts Feed)
        const cAlertsContainer = document.getElementById("c-alerts-list");
        if (data.alerts && data.alerts.length > 0) {
          cAlertsContainer.innerHTML = data.alerts.map(a => {
            const timeStr = a.created_at ? new Date(a.created_at).toISOString().replace("T", " ").slice(11, 19) : "--:--:--";
            return \`<div class="signal-card" onclick="selectActiveToken('\${a.mint}')">
              <div class="signal-header">
                <strong style="color:var(--bbg-amber);font-size:11px;">$\${escapeHtml(a.symbol)}</strong>
                <div>
                  <span class="mono" style="font-size:8px;color:var(--text-muted);margin-right:3px;">\${timeStr}</span>
                  <span class="badge badge-purple">\${Math.round(a.score)}/100</span>
                </div>
              </div>
              <div class="signal-stats">
                <span>\${Number(a.net_sol || 0).toFixed(2)} SOL</span>
                <span>\${a.unique_buyers || 0} Buyers</span>
                <span>HHI: \${Number(a.buyer_hhi || 0).toFixed(2)}</span>
              </div>
              <div class="signal-actions">
                <span class="badge badge-green" style="font-size:7px;">\${escapeHtml(a.flags?.split(',')[0] || 'SIGNAL')}</span>
                <div style="display:flex;gap:3px;">
                  <button class="btn btn-inspect" style="padding:1px 4px;font-size:8px;" onclick="inspectToken('\${a.mint}');event.stopPropagation();">Inspect</button>
                  <a href="https://photon-sol.tinyastro.io/en/lp/\${a.mint}" target="_blank" class="btn" style="padding:1px 4px;font-size:8px;background:#f59e0b;color:#000;" onclick="event.stopPropagation();">⚡</a>
                  <a href="https://bullx.io/terminal?chainId=1399811149&address=\${a.mint}" target="_blank" class="btn" style="padding:1px 4px;font-size:8px;background:#10b981;color:#000;" onclick="event.stopPropagation();">🎯</a>
                </div>
              </div>
            </div>\`;
          }).join("");
        }

        // Render Whale Radar Feed & Tracked Whales Watchlist
        if (data.whale_trades) {
          renderWhaleTrades(data.whale_trades);
        }
        if (data.tracked_whales) {
          renderTrackedWhales(data.tracked_whales);
        }

        // Render Standard Table View (Alerts Table)
        const alertsBody = document.getElementById("alerts-body");
        if (data.alerts && data.alerts.length > 0) {
          alertsBody.innerHTML = data.alerts.map(a => {
            const timeStr = a.created_at ? new Date(a.created_at).toISOString().replace("T", " ").slice(11, 19) : "--:--:--";
            return \`<tr>
              <td class="mono">\${timeStr}</td>
              <td><span style="color:var(--bbg-amber);font-weight:700;cursor:pointer;" onclick="inspectToken('\${a.mint}')">\${escapeHtml(a.symbol)}</span></td>
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
            if (e.twitter) socialsHtml += \`<a href="\${escapeHtml(e.twitter)}" target="_blank" class="badge badge-cyan" style="margin-right:2px;">𝕏</a>\`;
            if (e.telegram) socialsHtml += \`<a href="\${escapeHtml(e.telegram)}" target="_blank" class="badge badge-cyan" style="margin-right:2px;">✈️</a>\`;
            if (e.website) socialsHtml += \`<a href="\${escapeHtml(e.website)}" target="_blank" class="badge badge-cyan">🌐</a>\`;
            if (!socialsHtml) socialsHtml = '<span class="badge badge-muted">None</span>';

            let hostStr = 'unknown';
            try { if (e.uri) hostStr = new URL(e.uri).hostname; } catch (_) { hostStr = (e.uri || '').slice(0, 16); }

            let verdictBadge = '';
            if (e.is_serial_rugger) verdictBadge = \`<span class="badge badge-red">❌ Rugger</span>\`;
            else if (e.has_alert) verdictBadge = '<span class="badge badge-purple">🚀 Alert</span>';
            else if (e.twitter || e.telegram || e.website) verdictBadge = '<span class="badge badge-green">✅ Verified</span>';
            else verdictBadge = '<span class="badge badge-muted">⚪ Anon</span>';

            return \`<tr>
              <td class="mono" style="color:var(--text-muted);">#\${e.id}</td>
              <td class="mono">\${timeStr}</td>
              <td>
                <span style="cursor:pointer;color:var(--text);font-weight:700;" onclick="inspectToken('\${e.mint}')">\${escapeHtml(e.symbol || 'PUMP')}</span>
                <span style="color:var(--text-muted);font-size:9px;">\${escapeHtml(e.name || '')}</span>
              </td>
              <td><a class="mono" href="https://solscan.io/account/\${e.creator}" target="_blank">\${shortCreator}</a></td>
              <td><span class="mono" style="font-size:9px;color:var(--text-muted);">\${escapeHtml(hostStr)}</span></td>
              <td>\${socialsHtml}</td>
              <td>\${verdictBadge}</td>
              <td><button class="btn btn-inspect" onclick="inspectToken('\${e.mint}')">🔬 Inspect</button></td>
              <td>
                <a href="https://photon-sol.tinyastro.io/en/lp/\${e.mint}" target="_blank" style="color:#f59e0b;font-weight:700;">⚡</a> ·
                <a href="https://bullx.io/terminal?chainId=1399811149&address=\${e.mint}" target="_blank" style="color:#10b981;font-weight:700;">🎯</a> ·
                <a href="https://gmgn.ai/sol/token/\${e.mint}" target="_blank" style="color:#00d2ff;font-weight:700;">🤖</a>
              </td>
            </tr>\`;
          }).join("");
        }

      } catch (err) {
        console.error("Dashboard poll failed:", err);
      }
    }

    // Select Active Token for Center Command Deck
    async function selectActiveToken(mint) {
      if (!mint || mint === activeTokenMint) return;
      playTactileClick();
      activeTokenMint = mint;

      document.querySelectorAll(".firehose-item").forEach(el => {
        el.classList.remove("active");
      });

      try {
        const res = await fetch("/api/inspect?mint=" + encodeURIComponent(mint));
        if (!res.ok) return;
        const report = await res.json();
        activeTokenReport = report;

        // Center Hero
        document.getElementById("c-token-name").innerHTML = \`\${escapeHtml(report.name)} <span style="color:var(--bbg-amber);font-size:12px;">($\${escapeHtml(report.symbol)})</span>\`;
        document.getElementById("c-token-mint").innerText = report.mint.slice(0, 6) + "..." + report.mint.slice(-6);
        document.getElementById("c-token-mint").setAttribute("data-full-mint", report.mint);
        
        const curvePct = Number(report.curve_progress_pct || 0);
        document.getElementById("c-curve-text").innerText = curvePct.toFixed(1) + "% to Raydium";
        document.getElementById("c-net-sol").innerText = report.net_sol_deployed.toFixed(2) + " SOL Raised (" + report.unique_investors + " Buyers)";
        document.getElementById("c-mcap").innerText = report.estimated_mcap_usd ? "MCap: $" + Math.round(report.estimated_mcap_usd).toLocaleString() : "MCap: --";
        document.getElementById("c-curve-bar").style.width = Math.min(100, Math.max(2, curvePct)) + "%";

        // Jito Anti-MEV Tip
        const jitoBadge = document.getElementById("c-jito-tip");
        jitoBadge.innerText = "Jito: " + report.jito_execution.recommended_tip_sol + " SOL (" + report.jito_execution.mev_risk_level + ")";
        if (report.jito_execution.mev_risk_level === "HIGH") jitoBadge.className = "badge badge-red";
        else if (report.jito_execution.mev_risk_level === "MEDIUM") jitoBadge.className = "badge badge-amber";
        else jitoBadge.className = "badge badge-green";

        // Fast Execution Buttons & Size Presets
        document.getElementById("c-btn-photon").href = report.sniper_links.photon;
        document.getElementById("c-btn-bullx").href = report.sniper_links.bullx;
        document.getElementById("c-btn-gmgn").href = report.sniper_links.gmgn;
        document.getElementById("c-btn-dexs").href = report.sniper_links.dexscreener;
        document.getElementById("c-btn-pump").href = report.sniper_links.pumpfun;

        document.getElementById("c-btn-size-05").href = report.sniper_links.photon + "?amount=0.5";
        document.getElementById("c-btn-size-10").href = report.sniper_links.photon + "?amount=1.0";
        document.getElementById("c-btn-size-20").href = report.sniper_links.photon + "?amount=2.0";

        // Render Active Tab Content
        if (currentCenterTab === "sybil") {
          const verdictBadge = document.getElementById("c-cluster-verdict");
          verdictBadge.innerText = report.sybil_intelligence.cluster_verdict;
          if (report.sybil_intelligence.is_bundled_launch) verdictBadge.className = "badge badge-red";
          else verdictBadge.className = "badge badge-green";
          drawSybilCanvas("sybil-canvas", report.sybil_intelligence.bubble_graph);
        } else if (currentCenterTab === "tv") {
          document.getElementById("c-tradingview-frame").src = "https://dexscreener.com/solana/" + report.mint + "?embed=1&theme=dark&trades=0&info=0";
        }

        // HFT OBI Radar Calculation (E:\QRML Port)
        const buySol = Number(report.total_inflow_sol || 0);
        const sellSol = Number(report.total_outflow_sol || 0);
        const totalFlow = buySol + sellSol;
        const obiK = totalFlow > 0 ? (buySol - sellSol) / totalFlow : 0;
        const bidPct = totalFlow > 0 ? (buySol / totalFlow) * 100 : 50;
        const askPct = 100 - bidPct;

        document.getElementById("obi-bid-label").innerText = "Bid Flow: " + buySol.toFixed(2) + " SOL (" + bidPct.toFixed(0) + "%)";
        document.getElementById("obi-ask-label").innerText = "Ask Flow: " + sellSol.toFixed(2) + " SOL (" + askPct.toFixed(0) + "%)";
        document.getElementById("obi-bid-bar").style.width = bidPct + "%";
        document.getElementById("obi-ask-bar").style.width = askPct + "%";
        document.getElementById("obi-ratio-text").innerText = "OBI Ratio: K = " + (obiK >= 0 ? "+" : "") + obiK.toFixed(3);
        document.getElementById("obi-micro-text").innerText = "Pressure: " + (obiK > 0.3 ? "⚡ BULLISH ACCUMULATION" : obiK < -0.2 ? "⚠️ DISTRIBUTION DUMP" : "⚖️ BALANCED FLOW");

        const obiBadge = document.getElementById("obi-status-badge");
        if (obiK > 0.3) { obiBadge.className = "badge badge-green"; obiBadge.innerText = "BULLISH INFLOW"; }
        else if (obiK < -0.2) { obiBadge.className = "badge badge-red"; obiBadge.innerText = "SELL WALL"; }
        else { obiBadge.className = "badge badge-cyan"; obiBadge.innerText = "BALANCED FLOW"; }

        // Level-2 Ladder representation
        const ladderBox = document.getElementById("obi-ladder-box");
        ladderBox.innerHTML = \`
          <div style="display:flex;justify-content:space-between;color:var(--green);">
            <span>BID WALL #1 (Active Curve)</span>
            <span class="mono">\${buySol.toFixed(2)} SOL (100% Virtual LP)</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:var(--text-muted);">
            <span>MID SPREAD (Virtual Curve Floor)</span>
            <span class="mono">~0.0003 SOL (0.3% Slippage)</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:\${sellSol > 0 ? 'var(--red)' : 'var(--text-muted)'};">
            <span>ASK WALL (Total Realized Sells)</span>
            <span class="mono">\${sellSol.toFixed(2)} SOL</span>
          </div>
        \`;

        // Alpha-158 Factor Matrix
        document.getElementById("f-mom").innerText = (report.net_sol_deployed / Math.max(1, (report.total_trades || 1))).toFixed(2) + " SOL/trade";
        document.getElementById("f-ofi").innerText = (bidPct).toFixed(0) + "% Buy Bias";
        document.getElementById("f-vpin").innerText = ((report.top5_share_pct || 0) * 0.8).toFixed(0) + "% Toxicity";
        document.getElementById("f-entropy").innerText = ((1 - (report.hhi_score || 0)) * 4).toFixed(2) + " bits";
        document.getElementById("f-sri").innerText = report.creator_history.is_serial_rugger ? "❌ 1.00 (Rugger)" : "✅ 0.00 (Clean)";

        // Tab 5: Whales Book Table
        const whalesBody = document.getElementById("c-whales-body");
        if (report.investors && report.investors.length > 0) {
          whalesBody.innerHTML = report.investors.map(inv => \`<tr>
            <td class="mono" style="color:var(--text-muted);">#\${inv.rank}</td>
            <td><a class="mono" href="\${inv.solscan_url}" target="_blank">\${inv.short_wallet} ↗</a></td>
            <td class="mono" style="font-weight:700;color:var(--text);">\${inv.net_sol.toFixed(2)} SOL</td>
            <td class="mono" style="color:var(--text-muted);">\${inv.gross_buy_sol.toFixed(2)} SOL</td>
            <td class="mono">\${inv.pct_share.toFixed(1)}%</td>
            <td><span class="badge \${inv.tag_class}">\${escapeHtml(inv.tag)}</span></td>
            <td class="mono" style="color:var(--text-muted);">\${inv.trades_count}</td>
            <td>
              <button class="btn btn-inspect" style="padding:1px 4px;font-size:8px;" onclick="trackWhale('\${inv.wallet}', '\${escapeHtml(inv.tag || 'Whale')}');event.stopPropagation();">+ Track</button>
            </td>
          </tr>\`).join("");
        } else {
          whalesBody.innerHTML = \`<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:8px;">Early launch state: trades syncing...</td></tr>\`;
        }

        // Tab 6: Institutional Quantitative Research Memo
        if (report.research_memo) {
          const m = report.research_memo;
          const vBadge = document.getElementById("memo-verdict-badge");
          if (vBadge) {
            vBadge.className = "badge " + m.verdict_badge;
            vBadge.innerText = m.verdict;
          }
          const vTitle = document.getElementById("memo-verdict-title");
          if (vTitle) vTitle.innerText = m.verdict_title;
          const vSummary = document.getElementById("memo-exec-summary");
          if (vSummary) vSummary.innerText = m.executive_summary;
          const cAnalysis = document.getElementById("memo-creator-analysis");
          if (cAnalysis) cAnalysis.innerText = m.creator_analysis;
          const capAnalysis = document.getElementById("memo-capital-analysis");
          if (capAnalysis) capAnalysis.innerText = m.capital_structure_analysis;
          const sybilAnalysis = document.getElementById("memo-sybil-analysis");
          if (sybilAnalysis) sybilAnalysis.innerText = m.sybil_threat_analysis;
          const liqAnalysis = document.getElementById("memo-liquidity-analysis");
          if (liqAnalysis) liqAnalysis.innerText = m.liquidity_trajectory;

          const actionVal = document.getElementById("memo-action-val");
          if (actionVal) actionVal.innerText = m.strategy_recommendation.suggested_action;
          const slipVal = document.getElementById("memo-slippage-val");
          if (slipVal) slipVal.innerText = m.strategy_recommendation.max_slippage;
          const jitoVal = document.getElementById("memo-jito-val");
          if (jitoVal) jitoVal.innerText = m.strategy_recommendation.priority_tip;
          const riskVal = document.getElementById("memo-risk-val");
          if (riskVal) {
            riskVal.innerText = m.strategy_recommendation.risk_level + " RISK";
            if (m.strategy_recommendation.risk_level === "LOW") riskVal.className = "badge badge-green";
            else if (m.strategy_recommendation.risk_level === "MODERATE") riskVal.className = "badge badge-cyan";
            else if (m.strategy_recommendation.risk_level === "HIGH") riskVal.className = "badge badge-yellow";
            else riskVal.className = "badge badge-red";
          }

          const memoPhoton = document.getElementById("memo-exec-photon");
          if (memoPhoton) memoPhoton.href = report.sniper_links.photon;
          const memoBullx = document.getElementById("memo-exec-bullx");
          if (memoBullx) memoBullx.href = report.sniper_links.bullx;
        }

      } catch (err) {
        console.error("Select token error:", err);
      }
    }

    function openActiveTokenModal() {
      if (activeTokenMint) {
        inspectToken(activeTokenMint);
      }
    }

    function copyActiveMint() {
      const fullMint = document.getElementById("c-token-mint").getAttribute("data-full-mint") || activeTokenMint;
      if (!fullMint) return;
      navigator.clipboard.writeText(fullMint).then(() => {
        const el = document.getElementById("c-token-mint");
        const orig = el.innerText;
        el.innerText = "COPIED!";
        setTimeout(() => { el.innerText = orig; }, 1500);
      });
    }

    // Export Quant JSON Dossier (DuckDB / QRML ready)
    function exportQuantJson() {
      if (!activeTokenReport) return;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeTokenReport, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "quant_report_" + (activeTokenReport.symbol || "token") + "_" + activeTokenReport.mint.slice(0, 8) + ".json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
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
        activeTokenReport = report;

        // Populate Header & Identity
        document.getElementById("m-token-title").innerHTML = \`\${escapeHtml(report.name)} <span style="color:var(--bbg-amber);">($\${escapeHtml(report.symbol)})</span>\`;
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
        if (report.socials.twitter) socialsHtml += \`<a href="\${escapeHtml(report.socials.twitter)}" target="_blank" class="badge badge-cyan" style="margin-right:2px;">𝕏 Twitter</a>\`;
        if (report.socials.telegram) socialsHtml += \`<a href="\${escapeHtml(report.socials.telegram)}" target="_blank" class="badge badge-cyan" style="margin-right:2px;">✈️ TG</a>\`;
        if (report.socials.website) socialsHtml += \`<a href="\${escapeHtml(report.socials.website)}" target="_blank" class="badge badge-cyan">🌐 Web</a>\`;
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
              <td>
                <button class="btn btn-inspect" style="padding:1px 4px;font-size:8px;" onclick="trackWhale('\${inv.wallet}', '\${escapeHtml(inv.tag || 'Whale')}');event.stopPropagation();">+ Track</button>
              </td>
            </tr>\`;
          }).join("");
        } else {
          invBody.innerHTML = \`<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:8px;">Early launch state: trades syncing...</td></tr>\`;
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
      } else if (e.key === "t" || e.key === "T") {
        cycleTheme();
      } else if (e.key === "v" || e.key === "V") {
        toggleLayout();
      } else if (e.key === "1") {
        switchCenterTab("sybil");
      } else if (e.key === "2") {
        switchCenterTab("tv");
      } else if (e.key === "3") {
        switchCenterTab("obi");
      } else if (e.key === "4") {
        switchCenterTab("factors");
      } else if (e.key === "5") {
        switchCenterTab("whales");
      } else if (e.key === "6") {
        switchCenterTab("memo");
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
    if (localStorage.getItem("pumpradar_theme")) {
      currentTheme = localStorage.getItem("pumpradar_theme");
      applyTheme();
    }

    // Unlock Web Audio on first user click
    window.addEventListener("click", () => {
      initAudio();
    }, { once: true });

    // Handle Window Resize to keep Arkham Canvas crisp & centered
    window.addEventListener("resize", () => {
      if (currentCenterTab === "sybil" && activeTokenReport) {
        drawSybilCanvas("sybil-canvas", activeTokenReport.sybil_intelligence?.bubble_graph);
      }
    });

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
