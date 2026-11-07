// ==UserScript==
// @name         Ghost Bypass
// @namespace    https://github.com/ghost-bypass
// @version      1.0.2
// @description  Auto-bypass vrxscripts gate
// @match        https://vrxscripts.virexx.workers.dev/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      vrxscripts.virexx.workers.dev
// @connect      api.allorigins.win
// @connect      api.codetabs.com
// @connect      corsproxy.io
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const CFG = {
    MIN_WAIT_MS: 35000,
    MAX_WAIT_MS: 40000,
    BLUE:       '#3b82f6',
    BLUE_DIM:   '#1e40af',
    BLUE_GLOW:  '#60a5fa',
    BLUE_BG:    '#0a1020',
    BLUE_SUR:   '#0f172a',
    TEXT:       '#e2e8f0',
    MUTED:      '#94a3b8',
    OK:         '#4ade80',
    ERR:        '#f87171',
    W:          250,
    W_MIN:      140,
  };

  const S = {
    minimized: false,
    running:   false,
    done:      false,
    code:      null,
    source:    null,
    waitStart: 0,
    waitMs:    0,
    timer:     0,
    gate:      null,
  };

  function detectGate() {
    const m = location.href.match(/\/s\/([^/?#]+)/);
    if (!m) return null;
    return {
      kind: 'vrx',
      name: m[1],
      endpoint: location.origin + '/api/code/' + m[1],
    };
  }

  const host = document.createElement('div');
  host.id = 'ghost-bypass-host';
  host.style.cssText =
    'all: initial; position: fixed; z-index: 2147483647; top: 20px; right: 20px;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .panel {
        width: ${CFG.W}px;
        background: ${CFG.BLUE_BG};
        border-radius: 12px;
        overflow: hidden;
        box-shadow:
          0 0 0 1px ${CFG.BLUE_DIM},
          0 0 24px -8px ${CFG.BLUE_GLOW}88,
          0 16px 40px -12px rgba(0,0,0,.7);
        font-family: system-ui,-apple-system,"Segoe UI",sans-serif;
        font-size: 12px;
        color: ${CFG.TEXT};
        user-select: none;
        transition: width .2s ease;
      }
      .panel.min { width: ${CFG.W_MIN}px; }
      .bar {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 8px 8px 12px;
        background: linear-gradient(180deg, ${CFG.BLUE_SUR}, ${CFG.BLUE_BG});
        cursor: grab;
      }
      .bar:active { cursor: grabbing; }
      .logo {
        width: 7px; height: 7px; border-radius: 50%;
        background: ${CFG.BLUE};
        box-shadow: 0 0 8px ${CFG.BLUE_GLOW};
        flex-shrink: 0;
      }
      .logo.ok  { background: ${CFG.OK};  box-shadow: 0 0 8px ${CFG.OK};  }
      .logo.err { background: ${CFG.ERR}; box-shadow: 0 0 8px ${CFG.ERR}; }
      .logo.run { animation: pulse 1.1s ease-in-out infinite; }
      @keyframes pulse {
        0%,100% { opacity: 1; transform: scale(1); }
        50%     { opacity: .35; transform: scale(.8); }
      }
      .title {
        flex: 1;
        font-weight: 800; font-size: 11px; letter-spacing: .06em;
        color: ${CFG.BLUE_GLOW};
        text-transform: uppercase;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .btn {
        width: 18px; height: 18px;
        display: grid; place-items: center;
        border-radius: 5px;
        background: transparent;
        border: 0;
        color: ${CFG.MUTED};
        cursor: pointer;
        padding: 0;
        font: 800 14px/1 system-ui;
        transition: background .15s, color .15s;
      }
      .btn:hover { background: ${CFG.BLUE_DIM}66; color: ${CFG.TEXT}; }
      .body {
        padding: 10px 12px 12px;
        display: flex; flex-direction: column; gap: 8px;
      }
      .panel.min .body { display: none; }
      .status {
        font: 600 11px ui-monospace,Consolas,monospace;
        color: ${CFG.MUTED};
        display: flex; align-items: center; gap: 6px;
        min-height: 14px;
      }
      .status .k { flex-shrink: 0; color: ${CFG.BLUE_GLOW}; font-weight: 800; }
      .status .v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bar-track {
        height: 4px;
        background: ${CFG.BLUE_DIM}55;
        border-radius: 2px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%; width: 0%;
        background: linear-gradient(90deg, ${CFG.BLUE}, ${CFG.BLUE_GLOW});
        transition: width .2s linear;
      }
      .cd {
        display: flex; justify-content: space-between;
        font: 700 10px ui-monospace,Consolas,monospace;
        color: ${CFG.MUTED};
      }
      .cd b { color: ${CFG.BLUE_GLOW}; }
      .actions { display: flex; gap: 6px; }
      .actions button {
        flex: 1;
        padding: 7px 8px;
        border: 0;
        border-radius: 7px;
        background: ${CFG.BLUE}1a;
        color: ${CFG.BLUE_GLOW};
        font: 800 11px system-ui;
        cursor: pointer;
        transition: background .15s, transform .1s;
        box-shadow: inset 0 0 0 1px ${CFG.BLUE_DIM}55;
      }
      .actions button:hover:not(:disabled) {
        background: ${CFG.BLUE}2e;
        box-shadow: inset 0 0 0 1px ${CFG.BLUE}aa;
      }
      .actions button:active:not(:disabled) { transform: scale(.97); }
      .actions button:disabled { opacity: .35; cursor: not-allowed; }
      .actions button.primary {
        background: linear-gradient(180deg, ${CFG.BLUE}, ${CFG.BLUE_DIM});
        color: #fff;
        box-shadow: inset 0 0 0 1px ${CFG.BLUE_GLOW}66, 0 4px 12px -4px ${CFG.BLUE_GLOW}66;
      }
      .actions button.primary:hover:not(:disabled) {
        background: linear-gradient(180deg, ${CFG.BLUE_GLOW}, ${CFG.BLUE});
      }
      .log {
        max-height: 60px;
        overflow-y: auto;
        font: 500 10px/1.5 ui-monospace,Consolas,monospace;
        color: ${CFG.MUTED};
        padding: 6px 8px;
        border-radius: 6px;
        background: #00000055;
        box-shadow: inset 0 0 0 1px ${CFG.BLUE_DIM}33;
        display: none;
      }
      .log.show { display: block; }
      .log .ok  { color: ${CFG.OK}; }
      .log .err { color: ${CFG.ERR}; }
      .log div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style>
    <div class="panel" id="panel">
      <div class="bar" id="bar">
        <span class="logo" id="logo"></span>
        <span class="title" id="title">Ghost Bypass</span>
        <button class="btn" id="min" title="Minimize">—</button>
      </div>
      <div class="body" id="body">
        <div class="status">
          <span class="k" id="k">IDLE</span>
          <span class="v" id="v">scanning</span>
        </div>
        <div class="bar-track"><div class="bar-fill" id="fill"></div></div>
        <div class="cd">
          <span><b id="cdLeft">0</b>s left</span>
          <span id="cdPct">0%</span>
        </div>
        <div class="actions">
          <button id="start" class="primary">Start</button>
          <button id="copy">Copy</button>
        </div>
        <div class="log" id="log"></div>
      </div>
    </div>
  `;

  const $ = (id) => shadow.getElementById(id);
  const panel = $('panel');
  const bar = $('bar');
  const logo = $('logo');
  const titleEl = $('title');
  const btnMin = $('min');
  const btnStart = $('start');
  const btnCopy = $('copy');
  const kEl = $('k');
  const vEl = $('v');
  const fillEl = $('fill');
  const cdLeftEl = $('cdLeft');
  const cdPctEl = $('cdPct');
  const logEl = $('log');

  function log(msg, kind) {
    const d = document.createElement('div');
    if (kind) d.className = kind;
    d.textContent = msg;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    if (logEl.children.length > 20) logEl.removeChild(logEl.firstChild);
    if (!logEl.classList.contains('show')) logEl.classList.add('show');
  }

  function setLogo(kind) { logo.className = 'logo' + (kind ? ' ' + kind : ''); }
  function setStatus(k, v, kind) { kEl.textContent = k; vEl.textContent = v; setLogo(kind); }
  function setProgress(pct) {
    const p = Math.max(0, Math.min(100, pct));
    fillEl.style.width = p.toFixed(1) + '%';
    cdPctEl.textContent = Math.round(p) + '%';
  }
  function setCountdown(sec) { cdLeftEl.textContent = Math.max(0, Math.ceil(sec)); }

  btnMin.addEventListener('click', () => {
    S.minimized = !S.minimized;
    panel.classList.toggle('min', S.minimized);
    btnMin.textContent = S.minimized ? '+' : '—';
    btnMin.title = S.minimized ? 'Expand' : 'Minimize';
  });

  let dragging = false, dragX = 0, dragY = 0, startX = 0, startY = 0;

  bar.addEventListener('mousedown', (e) => {
    if (e.target === btnMin) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    const r = host.getBoundingClientRect();
    dragX = r.left; dragY = r.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    host.style.left = Math.max(0, dragX + (e.clientX - startX)) + 'px';
    host.style.top  = Math.max(0, dragY + (e.clientY - startY)) + 'px';
    host.style.right = 'auto';
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  bar.addEventListener('touchstart', (e) => {
    if (e.target === btnMin) return;
    const t = e.touches[0];
    dragging = true;
    startX = t.clientX; startY = t.clientY;
    const r = host.getBoundingClientRect();
    dragX = r.left; dragY = r.top;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    host.style.left = Math.max(0, dragX + (t.clientX - startX)) + 'px';
    host.style.top  = Math.max(0, dragY + (t.clientY - startY)) + 'px';
    host.style.right = 'auto';
  }, { passive: true });
  window.addEventListener('touchend', () => { dragging = false; });

  function req(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          timeout: 15000,
          onload: (r) => {
            if (r.status >= 200 && r.status < 300) resolve(r.responseText);
            else reject(new Error('HTTP ' + r.status));
          },
          onerror: () => reject(new Error('network')),
          ontimeout: () => reject(new Error('timeout')),
        });
      } else {
        fetch(url, { cache: 'no-store', credentials: 'include' })
          .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
          })
          .then(resolve)
          .catch(reject);
      }
    });
  }

  function isValidCode(text) {
    if (!text) return false;
    const t = text.trim();
    if (t.length < 20) return false;
    if (/^<!doctype/i.test(t) || /^<html/i.test(t)) return false;
    return true;
  }

  async function fetchCode(endpoint) {
    log('GET ' + endpoint);
    try {
      const txt = await req(endpoint);
      if (isValidCode(txt)) {
        log('OK direct · ' + txt.length + 'B', 'ok');
        return { code: txt, source: 'direct' };
      }
      log('bad body direct', 'err');
    } catch (e) {
      log('direct: ' + e.message, 'err');
    }

    const encoded = encodeURIComponent(endpoint);
    const proxies = [
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + encoded },
      { name: 'codetabs',   url: 'https://api.codetabs.com/v1/proxy?quest=' + encoded },
      { name: 'corsproxy',  url: 'https://corsproxy.io/?url=' + encoded },
    ];

    for (const p of proxies) {
      log('via ' + p.name);
      try {
        const txt = await req(p.url);
        if (isValidCode(txt)) {
          log('OK ' + p.name + ' · ' + txt.length + 'B', 'ok');
          return { code: txt, source: p.name };
        }
        log(p.name + ': bad body', 'err');
      } catch (e) {
        log(p.name + ': ' + e.message, 'err');
      }
    }

    return { code: null, source: null };
  }

  function waitTick() {
    const elapsed = Date.now() - S.waitStart;
    const remain = Math.max(0, S.waitMs - elapsed);
    setCountdown(remain / 1000);
    setProgress(S.waitMs > 0 ? (elapsed / S.waitMs) * 100 : 100);
    if (remain <= 0) {
      clearInterval(S.timer);
      S.timer = 0;
      runFetch();
    }
  }

  async function runFetch() {
    setStatus('FETCH', 'loading…', 'run');
    const result = await fetchCode(S.gate.endpoint);
    if (!result.code) {
      setStatus('FAIL', 'no response', 'err');
      S.running = false;
      btnStart.disabled = false;
      btnStart.textContent = 'Retry';
      return;
    }
    S.code = result.code;
    S.source = result.source;
    S.done = true;
    S.running = false;
    setStatus('DONE', result.source + ' · ' + result.code.length + 'B', 'ok');
    setProgress(100);
    btnStart.textContent = 'Copied';
    btnStart.disabled = true;
    if (typeof GM_setClipboard === 'function') GM_setClipboard(result.code, 'text');
    else if (navigator.clipboard) navigator.clipboard.writeText(result.code).catch(() => {});
    log('copied to clipboard', 'ok');
    applyToPage(result.code);
  }

  function applyToPage(code) {
    const codeEl = document.getElementById('code');
    if (codeEl) codeEl.textContent = code;
    const reward = document.getElementById('reward');
    if (reward) {
      reward.classList.add('show');
      reward.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const gate = document.getElementById('gate-script');
    if (gate) {
      gate.querySelectorAll('.step').forEach((s) => s.setAttribute('data-state', 'done'));
      gate.querySelectorAll('.step-fill').forEach((f) => {
        f.style.transition = 'transform .4s ease';
        f.style.transform = 'scaleX(1)';
      });
      const cnt = gate.querySelector('.gate-count b');
      if (cnt) cnt.textContent = '4';
      const go = gate.querySelector('.gate-go');
      if (go) go.disabled = false;
      gate.classList.add('opened');
    }
  }

  function start() {
    if (S.running) return;
    S.gate = detectGate();
    if (!S.gate) {
      setStatus('NO GATE', 'not a /s/ page', 'err');
      log('no gate detected', 'err');
      return;
    }
    S.running = true;
    S.done = false;
    S.code = null;
    S.waitMs = CFG.MIN_WAIT_MS + Math.floor(Math.random() * (CFG.MAX_WAIT_MS - CFG.MIN_WAIT_MS));
    S.waitStart = Date.now();
    btnStart.disabled = true;
    btnStart.textContent = 'Waiting';
    setStatus('WAIT', (S.waitMs / 1000).toFixed(1) + 's', 'run');
    log('gate: ' + S.gate.name);
    log('wait ' + (S.waitMs / 1000).toFixed(1) + 's');
    S.timer = setInterval(waitTick, 100);
    waitTick();
  }

  btnStart.addEventListener('click', () => {
    if (S.done && S.code) {
      if (typeof GM_setClipboard === 'function') GM_setClipboard(S.code, 'text');
      else if (navigator.clipboard) navigator.clipboard.writeText(S.code).catch(() => {});
      log('re-copied', 'ok');
      return;
    }
    start();
  });

  btnCopy.addEventListener('click', () => {
    if (!S.code) { log('nothing to copy', 'err'); return; }
    if (typeof GM_setClipboard === 'function') GM_setClipboard(S.code, 'text');
    else if (navigator.clipboard) navigator.clipboard.writeText(S.code).catch(() => {});
    log('copied', 'ok');
    btnCopy.textContent = 'Copied';
    setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1200);
  });

  log('loaded · ' + location.pathname);

  let tries = 0;
  const scan = setInterval(() => {
    tries++;
    const g = detectGate();
    if (g) {
      clearInterval(scan);
      setStatus('READY', g.name, 'ok');
      log('gate: ' + g.name);
      setTimeout(start, 600);
      return;
    }
    if (tries >= 30) {
      clearInterval(scan);
      setStatus('IDLE', 'not a /s/ page', '');
      log('no /s/ path here');
    }
  }, 500);

})();
