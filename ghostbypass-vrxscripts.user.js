// ==UserScript==
// @name         Ghost Bypass
// @namespace    https://github.com/ghost-bypass
// @version      1.0.3
// @description  Auto-bypass vrxscripts, bstshrt, Lootlabs, Linkvertise, BoostyLink, Bstlar
// @match        https://vrxscripts.virexx.workers.dev/*
// @match        https://bstshrt.com/*
// @match        https://www.bstshrt.com/*
// @match        https://lootlabs.gg/*
// @match        https://*.lootlabs.gg/*
// @match        https://loot-links.com/*
// @match        https://*.loot-links.com/*
// @match        https://lootdest.com/*
// @match        https://*.lootdest.com/*
// @match        https://lootlinks.co/*
// @match        https://*.lootlinks.co/*
// @match        https://boostylink.com/*
// @match        https://*.boostylink.com/*
// @match        https://bstlar.com/*
// @match        https://*.bstlar.com/*
// @match        https://linkvertise.com/*
// @match        https://link-to.net/*
// @match        https://link-hub.net/*
// @match        https://link-target.org/*
// @match        https://link-target.net/*
// @match        https://link-center.net/*
// @match        https://direct-link.net/*
// @match        https://nerventualken.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM.xmlHttpRequest
// @connect      ad-server.linkvertise.com
// @connect      publisher.linkvertise.com
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    const HOST        = location.hostname;
    const IS_BSTLAR   = HOST === 'bstlar.com' || HOST.endsWith('.bstlar.com');
    const IS_BOOSTY   = HOST === 'boostylink.com' || HOST.endsWith('.boostylink.com');
    const IS_CAPTCHA  = HOST.includes('nerventualken.com');
    const IS_LOOTLABS = !IS_CAPTCHA && (HOST.includes('lootlabs.gg') || HOST.includes('loot-links') || HOST.includes('lootdest') || HOST.includes('lootlinks'));
    const LV_HOSTS    = ['linkvertise.com','link-to.net','link-hub.net','link-target.org','link-target.net','link-center.net','direct-link.net'];
    const IS_LV       = LV_HOSTS.some(h => HOST === h || HOST.endsWith('.' + h));
    const IS_VRX      = HOST === 'vrxscripts.virexx.workers.dev';
    const IS_BST      = HOST === 'bstshrt.com';

    const CONFIG = {
        debug:       false,
        lootlabs:    { enabled: true, autoRedirect: false },
        linkvertise: { enabled: true, autoRedirect: true,  maxIterations: 15 },
    };

    const dbg   = (...a) => CONFIG.debug && console.log('[Bypass]', ...a);
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function xorDecrypt(b64, keyLen = 5) {
        try {
            const raw   = atob(b64.trim().replace(/[^A-Za-z0-9+/=]/g, ''));
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            const key   = bytes.slice(0, keyLen);
            const plain = new Uint8Array(bytes.slice(keyLen).map((b, i) => b ^ key[i % keyLen]));
            return new TextDecoder().decode(plain).trim();
        } catch { return b64.trim(); }
    }

    function injectAdStyles() {
        if (document.getElementById('ghost-ad-style')) return;
        const s = document.createElement('style');
        s.id = 'ghost-ad-style';
        s.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            #ll-overlay * { font-family:'Inter',system-ui,sans-serif; box-sizing:border-box; margin:0; padding:0; }
            #ll-overlay { position:fixed; inset:0; background:rgba(2,6,23,0.85); backdrop-filter:blur(8px); z-index:2147483647; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .3s; pointer-events:none; }
            #ll-overlay.show { opacity:1; pointer-events:auto; }
            .gam-card { width:min(440px,calc(100vw - 32px)); background:#0f172a; border:1px solid #1e293b; border-radius:16px; box-shadow:0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px rgba(59,130,246,0.1); overflow:hidden; transform:translateY(20px); transition:transform .3s cubic-bezier(0.16,1,0.3,1); display:flex; flex-direction:column; }
            #ll-overlay.show .gam-card { transform:translateY(0); }
            .gam-header { padding:20px 24px; border-bottom:1px solid #1e293b; display:flex; align-items:center; gap:12px; background:linear-gradient(180deg, rgba(59,130,246,0.1) 0%, transparent 100%); }
            .gam-icon { width:32px; height:32px; border-radius:8px; background:#3b82f6; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:16px; box-shadow:0 4px 12px rgba(59,130,246,0.4); }
            .gam-title-group { display:flex; flex-direction:column; }
            .gam-title { font-size:16px; font-weight:700; color:#f8fafc; letter-spacing:-0.01em; }
            .gam-sub { font-size:12px; color:#94a3b8; font-weight:500; }
            .gam-body { padding:24px; display:flex; flex-direction:column; gap:16px; min-height:120px; justify-content:center; }
            .gam-status { display:flex; align-items:center; gap:8px; font-size:13px; color:#cbd5e1; font-weight:500; }
            .gam-spinner { width:16px; height:16px; border-radius:50%; border:2px solid #334155; border-top-color:#3b82f6; animation:gam-spin 0.8s linear infinite; flex-shrink:0; }
            @keyframes gam-spin { to { transform:rotate(360deg); } }
            .gam-iframe-wrap { width:100%; display:none; flex-direction:column; align-items:center; gap:12px; }
            .gam-iframe { width:100%; height:78px; border:none; border-radius:8px; background:#fff; }
            .gam-footer { padding:20px 24px; border-top:1px solid #1e293b; background:#0b1120; display:flex; gap:12px; }
            .gam-btn { flex:1; padding:12px; border-radius:8px; font-size:14px; font-weight:600; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px; }
            .gam-btn-primary { background:#3b82f6; color:#fff; box-shadow:0 4px 12px rgba(59,130,246,0.3); }
            .gam-btn-primary:hover:not(:disabled) { background:#2563eb; transform:translateY(-1px); }
            .gam-btn-primary:disabled { background:#334155; color:#64748b; cursor:not-allowed; box-shadow:none; }
            .gam-btn-secondary { background:#1e293b; color:#e2e8f0; border:1px solid #334155; flex:0 0 auto; padding:12px 20px; }
            .gam-btn-secondary:hover { background:#334155; color:#fff; }
            #ll-error-msg { font-size:13px; color:#f87171; text-align:center; margin-top:12px; word-break:break-word; }
        `;
        (document.head || document.documentElement).appendChild(s);
    }

    function createAdModal() {
        if (document.getElementById('ll-overlay')) return;
        injectAdStyles();
        const el = document.createElement('div');
        el.id = 'll-overlay';
        el.innerHTML = `
            <div class="gam-card">
                <div class="gam-header">
                    <div class="gam-icon" id="ll-topbar-dot">G</div>
                    <div class="gam-title-group">
                        <span class="gam-title" id="ll-card-title">Ghost Unlocker</span>
                        <span class="gam-sub" id="ll-card-sub">Initializing...</span>
                    </div>
                </div>
                <div class="gam-body">
                    <div class="gam-status" id="gam-status">
                        <div class="gam-spinner" id="ll-spinner"></div>
                        <span id="gam-status-text">Working...</span>
                    </div>
                    <div class="gam-iframe-wrap" id="gam-iframe-wrap">
                        <iframe class="gam-iframe" id="ll-captcha-iframe"></iframe>
                    </div>
                </div>
                <div class="gam-footer">
                    <button class="gam-btn gam-btn-primary" id="ll-btn" disabled>
                        <span id="ll-btn-icon">→</span>
                        <span id="ll-btn-text">Waiting for link...</span>
                    </button>
                    <button class="gam-btn gam-btn-secondary" id="gam-btn-close">Close</button>
                </div>
            </div>
        `;
        document.documentElement.appendChild(el);
        setTimeout(() => el.classList.add('show'), 100);
        document.getElementById('gam-btn-close').onclick = () => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        };
    }

    function enableRedirectBtn(url, auto) {
        const btn     = document.getElementById('ll-btn');
        const btnText = document.getElementById('ll-btn-text');
        const spinner = document.getElementById('ll-spinner');
        const frame   = document.getElementById('ll-captcha-iframe');
        const wrap    = document.getElementById('gam-iframe-wrap');
        if (spinner) spinner.style.display = 'none';
        if (frame) { frame.style.display = 'none'; if (wrap) { wrap.style.minHeight = '0'; wrap.style.padding = '0'; } }
        if (auto && url?.startsWith('http')) { location.href = url; return; }
        if (btn)     { btn.disabled = false; btn.classList.add('ready'); btn.onclick = () => url?.startsWith('http') && (location.href = url); }
        if (btnText) btnText.textContent = 'Continue to destination';
    }

    if (IS_CAPTCHA) {
        let submitted = false;
        async function submitToken(token) {
            if (submitted || !token) return;
            submitted = true;
            const urid = new URLSearchParams(location.search).get('urid');
            try {
                await fetch('https://nerventualken.com/captcha/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urid, token }),
                });
            } catch (err) { console.error('[Bypass-Captcha]', err); }
            window.parent.postMessage({ type: 'captcha_solved', solved: true, status: 'ok', urid }, '*');
        }
        let _ts = window.turnstile;
        Object.defineProperty(window, 'turnstile', {
            configurable: true,
            get() { return _ts; },
            set(obj) {
                _ts = obj;
                if (_ts?.render) {
                    const orig = _ts.render;
                    _ts.render = function (el, params) {
                        const cb = params.callback;
                        params.callback = function (token) {
                            submitToken(token);
                            if (typeof cb === 'function') cb.apply(this, arguments);
                        };
                        return orig.apply(this, arguments);
                    };
                }
            },
        });
        const poll = setInterval(() => {
            const inp = document.querySelector('input[name="cf-turnstile-response"]');
            if (inp?.value) { clearInterval(poll); submitToken(inp.value); }
        }, 250);
        return;
    }

    if (IS_BSTLAR) {
        const RELOAD_MARKER = 'ghost_bstlar_reloading';

        async function waitFor(fn, timeout = 30000, interval = 250) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                try { if (fn()) return true; } catch (e) {}
                await sleep(interval);
            }
            return false;
        }

        function findPageVm() {
            const root = document.getElementById('app');
            const vm = root && root.__vue__;
            if (!vm) return null;
            function walk(v) {
                if (!v) return null;
                if (typeof v.linkActionId === 'string' && v.linkActionId.length > 0 && Array.isArray(v.interactiveTasks)) {
                    return v;
                }
                const kids = v.$children || [];
                for (let i = 0; i < kids.length; i++) {
                    const r = walk(kids[i]);
                    if (r) return r;
                }
                return null;
            }
            return walk(vm);
        }

        (async () => {
            createAdModal();
            const title = document.getElementById('ll-card-title');
            const sub   = document.getElementById('ll-card-sub');
            title.textContent = 'Bstlar Bypass';

            if (sessionStorage.getItem(RELOAD_MARKER) === '1') {
                sessionStorage.removeItem(RELOAD_MARKER);
                sub.textContent = 'Waiting for unlock button...';
                const btnReady = await waitFor(() => {
                    const btn = document.querySelector('#unlock-btn-enabled') ||
                                document.querySelector('.unlock-btn-container button:not([disabled])');
                    return btn && !btn.disabled;
                }, 20000);
                if (btnReady) {
                    sub.textContent = 'Clicking unlock...';
                    const btn = document.querySelector('#unlock-btn-enabled') ||
                                document.querySelector('.unlock-btn-container button:not([disabled])');
                    try { btn.click(); } catch (e) { try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch (e2) {} }
                    await sleep(2500);
                    return;
                }
                sub.textContent = 'Unlock button never enabled';
                return;
            }

            sub.textContent = 'Waiting for tasks to load...';
            const ok = await waitFor(() => {
                const vm = findPageVm();
                return vm && vm.interactiveTasks.length > 0;
            }, 30000);

            if (!ok) {
                sub.textContent = 'No tasks (adblock on?)';
                return;
            }

            const vm = findPageVm();
            const tasks = vm.interactiveTasks;
            const total = tasks.length;
            sub.textContent = `Found ${total} task(s)`;
            await sleep(600);

            for (let i = 0; i < total; i++) {
                const task = tasks[i];
                if (task.completed) {
                    sub.textContent = `${i+1}/${total} · already done`;
                    continue;
                }

                const timer = parseInt(task.taskzone || task.time_left || 20) || 20;
                const wait = timer + 2;

                sub.textContent = `${i+1}/${total} · ${(task.title || task.description || 'task').slice(0, 40)} (${wait}s)`;
                await sleep(wait * 1000);

                try {
                    vm.completedTask(i);
                } catch (e) {
                    sub.textContent = `Complete call failed: ${e.message}`;
                    return;
                }

                sub.textContent = `${i+1}/${total} · confirming...`;
                const done = await waitFor(() => vm.interactiveTasks[i] && vm.interactiveTasks[i].completed, 30000);
                if (!done) {
                    sub.textContent = `Task ${i+1} rejected by server`;
                    return;
                }
            }

            sub.textContent = 'All tasks done — reloading to unlock...';
            sessionStorage.setItem(RELOAD_MARKER, '1');
            await sleep(800);
            location.reload();
        })().catch(e => {
            const sub = document.getElementById('ll-card-sub');
            if (sub) sub.textContent = e.message || 'Fatal error';
        });
        return;
    }

    if (IS_BOOSTY) {
        const AD  = 'https://ad-server.linkvertise.com';
        const PAD = 1500;
        const gmXhrBS = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM) : GM_xmlhttpRequest;

        function xhrBS(url) {
            return new Promise((ok, fail) =>
                gmXhrBS({
                    method: 'GET', url,
                    headers: { Accept: 'application/json' },
                    onload(r) { try { r.json = JSON.parse(r.responseText); } catch {} ok(r); },
                    onerror: fail,
                })
            );
        }

        async function api(path, data) {
            const r = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
                body: new URLSearchParams(data),
            });
            try { return await r.json(); } catch { return {}; }
        }

        function blsgCfg() {
            const el = document.getElementById('blsg-config');
            try { return JSON.parse(el?.textContent || '{}'); } catch { return {}; }
        }

        function getLinkId() {
            return document.querySelector('[data-link]')?.dataset.link || document.querySelector('input[name="link_id"]')?.value || null;
        }

        function getActions() {
            return [...document.querySelectorAll('[data-linkactionid]')].map(el => {
                let lv = null;
                if (el.dataset.linkvertise) try { lv = JSON.parse(el.dataset.linkvertise); } catch {}
                return { id: el.dataset.linkactionid, timer: parseInt(el.dataset.actiontimer || 20), label: el.textContent.trim().slice(0, 55), lv, wall: el.dataset.monetization === '1' };
            });
        }

        function wallParams() {
            for (const s of document.querySelectorAll('script:not([src])')) {
                const m = s.textContent.match(/const\s+placeholders\s*=\s*(\[[\s\S]*?\]);/);
                if (!m) continue;
                try {
                    const ph = JSON.parse(m[1]);
                    if (!ph.length) continue;
                    const u = (s.textContent.match(/const\s+userId\s*=\s*'?(\d+)/) || [])[1] || '';
                    const l = (s.textContent.match(/const\s+linkId\s*=\s*'?(\d+)/) || [])[1] || '';
                    return { u, l, ph };
                } catch {}
            }
            return null;
        }

        async function solveTS(sitekey, action, cdata) {
            const wrap = document.getElementById('ll-captcha-iframe');
            const host = document.getElementById('gam-iframe-wrap');
            const status = document.getElementById('gam-status');
            host.style.display = 'flex';
            status.style.display = 'none';
            wrap.src = 'about:blank';
            const frameDoc = wrap.contentWindow.document;
            frameDoc.body.innerHTML = '<div id="ts-inner" style="display:flex;justify-content:center;padding-top:10px;"></div>';

            if (!window.turnstile) {
                await new Promise(ok => {
                    const s = document.createElement('script');
                    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                    s.onload = () => setTimeout(ok, 350);
                    document.head.appendChild(s);
                });
            }

            return new Promise(ok => {
                const o = { sitekey, callback: tok => { host.style.display = 'none'; status.style.display = 'flex'; ok(tok); } };
                if (action) o.action = action;
                if (cdata) o.cdata = cdata;
                window.turnstile.render(frameDoc.getElementById('ts-inner'), o);
            });
        }

        async function gateFlow(cfg) {
            const ep = cfg.endpoint || '/api/locker_security.php';
            const csrf = cfg.csrf || '';
            const st = await api(ep, { op: 'status', csrf });
            if (st.verified) return true;
            for (let i = 0; i < 3; i++) {
                const ch = await api(ep, { op: 'challenge', csrf });
                if (ch.verified) return true;
                if (ch.status !== 'challenge') { await sleep(2000); continue; }
                document.getElementById('ll-card-sub').textContent = 'Solve the widget ↓';
                const token = await solveTS(ch.sitekey, ch.action || '', ch.cdata || '');
                const vd = await api(ep, { op: 'verify', csrf, token, nonce: ch.nonce || '' });
                if (vd.status === 'ok' && vd.verified) return true;
                await sleep(1500);
            }
            return false;
        }

        async function adReq(lv) {
            const q = new URLSearchParams({ keyword: lv.keyword||'laptop', integration_id: lv.integrationId||'3393', ad_number: 1, sub_id: '' });
            try {
                const r = await xhrBS(`${AD}/ads?${q}`);
                const ads = Array.isArray(r.json) ? r.json : (r.json?.ads || []);
                for (const a of ads)
                    if (a?.clickout_url) return { clickout_url: a.clickout_url, title: String(a.title || '').slice(0, 220), description: String(a.description || '').slice(0, 600), call_to_action: String(a.call_to_action || '').slice(0, 100), thumbnail_url: a.thumbnail_url || '' };
            } catch {}
            return null;
        }

        async function resolveOffer(id, config) {
            const lv = config.linkvertise || {};
            const url = (config.url || '').trim();
            if (lv.state === 'ready' && url && url !== '#') return url;
            if (url && url !== '#') return url;
            const ad = await adReq(lv);
            if (!ad) return null;
            const d = await api('/api/monetization.php', { linkvertise_resolve: '1', l: String(lv.linkId || ''), action_id: String(id), token: String(lv.token || ''), ad: JSON.stringify(ad) });
            return d?.offer?.url || null;
        }

        async function registerWall() {
            const wp = wallParams();
            if (!wp) return null;
            for (let att = 0; att < 3; att++) {
                const d = await api('/api/monetization.php', { u: wp.u, l: wp.l, ua: navigator.userAgent, ip: '', placeholders: JSON.stringify(wp.ph) });
                if (d.status === 'busy') { await sleep(800 * (att + 1)); continue; }
                if (d.status !== 'ok')   return null;
                return (d.actions || []).filter(o => o?.link_action_id).map(o => ({ id: String(o.link_action_id), timer: parseInt(o.timer || 20), label: String(o.title || 'offer').slice(0, 55), lv: o.linkvertise ? { url: o.url || '', linkvertise: o.linkvertise } : null, wall: true }));
            }
            return null;
        }

        async function completeAction(id) {
            for (let i = 0; i < 6; i++) {
                const d = await api('/api/locker_action_complete.php', { link_action_id: id });
                if (d.status === 'too_fast' || d.status === 'too_early') { await sleep((parseInt(d.wait_left || 3) + 1) * 1000); continue; }
                return d;
            }
            return { status: 'error' };
        }

        (async () => {
            createAdModal();
            const subTitle = document.getElementById('ll-card-sub');
            const statusText = document.getElementById('gam-status-text');

            subTitle.textContent = 'Checking security gate...';
            const cfg = blsgCfg();
            if (cfg.enabled && !cfg.ready) {
                const ok = await gateFlow(cfg);
                if (!ok) { subTitle.textContent = 'Gate failed'; return; }
            }

            subTitle.textContent = 'Parsing actions...';
            const lid = getLinkId();
            if (!lid) { subTitle.textContent = 'No link ID'; return; }

            let acts = getActions();
            if (!acts.length) { subTitle.textContent = 'No actions'; return; }

            if (acts.some(a => a.wall)) {
                subTitle.textContent = 'Registering wall…';
                const wall = await registerWall();
                if (!wall) { subTitle.textContent = 'Wall failed'; return; }
                acts = [...wall, ...acts.filter(a => !a.wall)];
            }

            if (acts.some(a => a.lv)) {
                for (let n = 0; n < acts.length; n++) {
                    const a = acts[n];
                    subTitle.textContent = `${n+1}/${acts.length} · ${a.label}`;
                    if (a.lv) {
                        const offer = await resolveOffer(a.id, a.lv);
                        if (!offer) { subTitle.textContent = 'Offer failed'; return; }
                    }
                    let d = await api('/api/locker_action_start.php', { link_action_id: a.id });
                    if (d.status === 'offer_pending') {
                        await sleep(3000);
                        const fh = await (await fetch(location.href)).text();
                        const tmp = document.createElement('div');
                        tmp.innerHTML = fh;
                        const fel = tmp.querySelector(`[data-linkactionid="${a.id}"]`);
                        if (fel?.dataset.linkvertise) try { await resolveOffer(a.id, JSON.parse(fel.dataset.linkvertise)); } catch {}
                        d = await api('/api/locker_action_start.php', { link_action_id: a.id });
                    }
                    if (!['ok','already_started'].includes(d.status)) { subTitle.textContent = `Start: ${d.status}`; return; }
                    const timer = typeof d.timer === 'number' ? d.timer : a.timer;
                    const wait = Math.max(1, timer) * 1000 + PAD;
                    subTitle.textContent = `${n+1}/${acts.length} · ${Math.ceil(wait/1000)}s…`;
                    await sleep(wait);
                    const done = await completeAction(a.id);
                    if (done.status !== 'ok') { subTitle.textContent = `Complete: ${done.status}`; return; }
                }
            } else {
                subTitle.textContent = `Starting ${acts.length} action(s)…`;
                const started = [];
                for (const a of acts) {
                    const d = await api('/api/locker_action_start.php', { link_action_id: a.id });
                    if (['ok','already_started'].includes(d.status)) started.push({ id: a.id, timer: typeof d.timer === 'number' ? d.timer : a.timer });
                }
                if (!started.length) { subTitle.textContent = 'All rejected'; return; }
                const wait = Math.max(...started.map(x => x.timer)) * 1000 + PAD;
                subTitle.textContent = `Waiting ${Math.ceil(wait/1000)}s…`;
                await sleep(wait);
                for (const { id } of started) {
                    const done = await completeAction(id);
                    if (done.status !== 'ok') { subTitle.textContent = `Complete: ${done.status}`; return; }
                }
            }

            subTitle.textContent = 'Unlocking…';
            const ud = await api(location.href, { link_id: lid });
            if (ud.status !== 'ok' || !ud.data) { subTitle.textContent = 'Unlock failed'; return; }

            const result = parseInt(ud.data.type || 1) === 2 ? (ud.data.content || '').trim() : (ud.data.destination_url || '').trim();
            if (!result) { subTitle.textContent = 'Empty response'; return; }

            document.getElementById('ll-card-title').textContent = 'Unlocked';
            subTitle.textContent = 'Destination resolved';
            GM_setClipboard(result);
            enableRedirectBtn(result, false);
        })().catch(e => { document.getElementById('ll-card-sub').textContent = e.message || 'Fatal error'; });
        return;
    }

    if (IS_LOOTLABS && CONFIG.lootlabs.enabled) {
        const gmXhr = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM) : (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);

        let urid = null, taskId = null, tid = null;
        let destUrl = null, captchaDone = false, overlayShown = false;

        const LL_STEPS = {
            1: { pct: 33,  status: 'pending', bar: 'Waiting for verification',       sub: 'Complete the captcha below'  },
            2: { pct: 66,  status: 'pending', bar: 'Captcha passed — fetching link', sub: 'Communicating with server…'  },
            3: { pct: 100, status: 'active',  bar: 'Link ready',                     sub: 'Destination resolved'        },
        };

        function setStep(n, labels) {
            const dot = document.getElementById('ll-topbar-dot');
            const label = document.getElementById('ll-card-title');
            const sub = document.getElementById('ll-card-sub');
            const statusText = document.getElementById('gam-status-text');
            if (!dot) return;
            const cfg = labels?.[n] || {};
            if (cfg.bar) { label.textContent = cfg.bar; statusText.textContent = cfg.sub; }
        }

        function showLLOverlay(captchaUrl) {
            if (overlayShown) return;
            overlayShown = true;
            const mount = () => {
                const root = document.body || document.documentElement;
                if (!root) { window.addEventListener('DOMContentLoaded', mount, { once: true }); return; }
                createAdModal();
                const frame = document.getElementById('ll-captcha-iframe');
                const wrap = document.getElementById('gam-iframe-wrap');
                const status = document.getElementById('gam-status');
                frame.src = captchaUrl;
                wrap.style.display = 'flex';
                status.style.display = 'none';
                setStep(1, LL_STEPS);
                if (destUrl) enableRedirectBtn(destUrl, CONFIG.lootlabs.autoRedirect);
            };
            mount();

            window.addEventListener('message', function onMsg(e) {
                if (!e.origin?.includes('nerventualken.com')) return;
                const d = e.data;
                const solved = d === 'ok' || d === 'solved' || d === true || (d && typeof d === 'object' && (d.solved === true || d.status === 'ok' || d.success === true || d.type === 'captcha_solved' || d.event === 'captcha_complete'));
                if (solved) { onCaptchaDone(); window.removeEventListener('message', onMsg); }
            });
        }

        function onCaptchaDone() {
            if (captchaDone) return;
            captchaDone = true;
            setStep(2, LL_STEPS);
            const frame = document.getElementById('ll-captcha-iframe');
            const wrap = document.getElementById('gam-iframe-wrap');
            const status = document.getElementById('gam-status');
            if (frame) { wrap.style.display = 'none'; status.style.display = 'flex'; }
            if (urid) fetch(`https://nerventualken.com/td?ac=captcha&urid=${urid}&cat=${taskId||''}&tid=${tid||''}`, { mode: 'no-cors' }).catch(() => {});
        }

        function enableLLRedirect(url) {
            destUrl = url;
            setStep(3, LL_STEPS);
            enableRedirectBtn(url, CONFIG.lootlabs.autoRedirect);
        }

        function injectLootlabsPageScript() {
            if (window.top !== window) return;
            const s = document.createElement('script');
            s.textContent = `
                (function() {
                    const origFetch = window.fetch;
                    const patchedFetch = window.fetch = async function(...args) {
                        const [input, opts = {}] = args;
                        const url = typeof input === 'string' ? input : input?.url || '';
                        const method = (opts.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
                        if (url.includes('/tc') && method === 'POST') {
                            let body = opts.body || (input instanceof Request ? await input.clone().text() : null);
                            try {
                                const parsed = JSON.parse(body);
                                if (parsed && 'max_tasks' in parsed) {
                                    parsed.max_tasks = 1;
                                    parsed.num_of_tasks = '1';
                                    parsed.bl = [18, 2, 33, 7, 21, 49];
                                    parsed.tier_id = parsed.tier_id || '0';
                                    parsed.taboola_user_sync = '0';
                                    return origFetch(url, { ...opts, body: JSON.stringify(parsed), headers: { ...opts.headers, 'Content-Type': 'application/json' } });
                                }
                            } catch {}
                        }
                        return origFetch(...args);
                    };
                    window.fetch = async function(...args) {
                        const [input, opts = {}] = args;
                        const url = typeof input === 'string' ? input : input?.url || '';
                        if (!url.includes('/tc')) return patchedFetch(...args);
                        let bodyParsed = null;
                        if (opts.body) try { bodyParsed = JSON.parse(opts.body); } catch {}
                        try {
                            const resp = await patchedFetch(...args);
                            const tasks = await resp.clone().json();
                            window.dispatchEvent(new CustomEvent('ghost_ll_tasks', { detail: JSON.stringify({ tasks, bodyParsed }) }));
                            return resp;
                        } catch (err) {
                            return patchedFetch(...args);
                        }
                    };
                })();
            `;
            (document.head || document.documentElement).appendChild(s);
        }

        window.addEventListener('ghost_ll_tasks', function(e) {
            try {
                const data = JSON.parse(e.detail);
                const tasks = data.tasks;
                const bodyParsed = data.bodyParsed;
                if (!Array.isArray(tasks)) return;

                tasks.filter(t => typeof t?.postback_url === 'string').forEach(t => {
                    gmXhr ? gmXhr({ url: t.postback_url, method: 'GET' }) : fetch(t.postback_url, { mode: 'no-cors' }).catch(() => {});
                });

                const captchaTask = tasks.find(t => t?.ad_url?.includes('nerventualken.com/captcha'));
                if (captchaTask) {
                    urid = captchaTask.urid;
                    taskId = captchaTask.task_id;
                    let captchaUrl = captchaTask.ad_url;
                    if (captchaUrl.startsWith('//')) captchaUrl = 'https:' + captchaUrl;
                    if (!captchaUrl.startsWith('http')) captchaUrl = `https://nerventualken.com/captcha?urid=${urid}`;
                    setTimeout(() => showLLOverlay(captchaUrl), 500);
                } else {
                    setTimeout(() => showLLOverlay('https://nerventualken.com/captcha?urid=unknown'), 500);
                }

                if (tasks.length > 0) {
                    const task = captchaTask || tasks[0];
                    const { urid: uid, task_id: cat, action_pixel_url: pixelUrl, session_id: sid } = task;
                    urid = uid; taskId = cat;

                    const session = sid || bodyParsed?.session || unsafeWindow.p?.SESSION || unsafeWindow.conf_rew?.session || '';
                    const key = typeof unsafeWindow.KEY !== 'undefined' ? unsafeWindow.KEY : (unsafeWindow.conf_rew?.key || bodyParsed?.rkey || unsafeWindow.p?.KEY || '');
                    tid = typeof unsafeWindow.TID !== 'undefined' ? unsafeWindow.TID : (unsafeWindow.conf_rew?.cd || bodyParsed?.tid || unsafeWindow.p?.TID || '0');

                    tasks.forEach((t, i) => {
                        if (t.task_id) fetch(`https://enaightdecipie.com/?event=task_clicked&session_id=${t.task_id}&info=${i+1}`).catch(() => {});
                    });

                    const shard = parseInt(String(uid).slice(-5)) % 3;
                    const server = typeof unsafeWindow.INCENTIVE_SERVER_DOMAIN !== 'undefined' ? unsafeWindow.INCENTIVE_SERVER_DOMAIN : 'onsultingco.com';
                    const syncer = typeof unsafeWindow.INCENTIVE_SYNCER_DOMAIN !== 'undefined' ? unsafeWindow.INCENTIVE_SYNCER_DOMAIN : 'nismscoldnesfspu.org';
                    const isLoot = location.href.includes('loot') ? '1' : '0';

                    const ws = new WebSocket(`wss://${shard}.${server}/c?uid=${uid}&cat=${cat}&key=${key}&session_id=${session}&is_loot=${isLoot}&tid=${tid}`);
                    let ping;
                    ws.onopen = () => { ping = setInterval(() => ws.send('0'), 10000); };
                    ws.onclose = ws.onerror = () => clearInterval(ping);
                    ws.onmessage = (ev) => {
                        if (typeof ev.data === 'string' && ev.data.startsWith('r:')) {
                            const dest = xorDecrypt(ev.data.replace(/^r:/, '').trim(), 5);
                            ws.close();
                            if (dest.startsWith('http')) enableLLRedirect(dest);
                        }
                    };

                    navigator.sendBeacon?.(`https://${shard}.${server}/st?uid=${uid}&cat=${cat}`);
                    if (pixelUrl) fetch(pixelUrl.startsWith('//') ? 'https:' + pixelUrl : pixelUrl).catch(() => {});
                    fetch(`https://${syncer}/td?ac=auto_complete&urid=${uid}&cat=${cat}&tid=${tid}`).catch(() => {});
                }
            } catch (err) {}
        });

        injectLootlabsPageScript();
    }

    if (IS_LV && CONFIG.linkvertise.enabled) {
        const LV_GQL = 'https://publisher.linkvertise.com/graphql';
        const LV_HDR = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Origin': 'https://linkvertise.com',
            'Referer': 'https://linkvertise.com/',
        };

        const Q_GET = 'query getContent($identifier: PublicLinkIdentificationInput!, $task_args: TaskArgument) {\n  getContent(input: $identifier, task_args: $task_args) {\n    __typename\n    ... on ContentAccessTaskSet { tasks { __typename id\n      ... on WaitTask    { status remainingWaitingTime adsTotal }\n      ... on AdTask      { status adIndex adsTotal }\n      ... on PremiumTask { status } } }\n    ... on DetailPageTargetData { type url paste }\n  }\n}';
        const Q_COMPLETE = 'mutation completeTask($identifier: PublicLinkIdentificationInput!, $task_id: String!, $task_args: TaskArgument) {\n  completeTask(input: $identifier, task_id: $task_id, task_args: $task_args) {\n    __typename id\n    ... on WaitTask    { status remainingWaitingTime }\n    ... on AdTask      { status }\n    ... on PremiumTask { status }\n  }\n}';

        const gmXhrLV = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM) : (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);

        function lvFetch(body) {
            if (gmXhrLV) {
                return new Promise((resolve, reject) =>
                    gmXhrLV({
                        method: 'POST', url: LV_GQL, headers: LV_HDR, data: body,
                        onload: r => { try { resolve(JSON.parse(r.responseText)); } catch { reject(new Error('JSON parse failed')); } },
                        onerror: err => reject(new Error('GM XHR error: ' + err.status)),
                    })
                );
            }
            return fetch(LV_GQL, { method: 'POST', headers: LV_HDR, body }).then(r => r.json());
        }

        function lvIdentifier(url) {
            try {
                const p = new URL(url);
                const segs = p.pathname.split('/').filter(Boolean);
                const qs = Object.fromEntries(p.searchParams);

                const decode = (str) => { try { return decodeURIComponent(str); } catch { return str; } };

                if (segs[0] === 'access') segs.shift();
                if (segs[0] === 'link' && segs[1]) return { id: { id: segs[1] } };
                if (segs[2] === 'dynamic' && qs.r) {
                    const obj = { user_id: segs[0], hash: decode(qs.r), originates_from_adfly: qs.link_origin === 'adfly' };
                    if (qs.v) obj.version = qs.v;
                    return { userIdAndHash: obj };
                }
                if (/^\d+$/.test(segs[0])) {
                    return { userIdAndUrl: { user_id: segs[0], url: segs[1] || "" } };
                }
                if (qs.r) {
                    const obj = { user_id: segs[0] || "", hash: decode(qs.r), originates_from_adfly: qs.link_origin === 'adfly' };
                    if (qs.v) obj.version = qs.v;
                    return { userIdAndHash: obj };
                }
                if (segs.length >= 1) {
                    return { userIdAndUrl: { user_id: segs[0], url: segs[1] || "" } };
                }
            } catch (e) {}
            return null;
        }

        function lvTaskArgs(url) {
            const actionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            return {
                action_id: actionId,
                additional_data: { taboola: { user_id: 'fallbackUserId', consent_string: '', url, external_referrer: '', session_id: '' } },
            };
        }

        function lvCleanPaste(v) {
            if (!v) return v;
            if (v.includes('<') && v.includes('>')) return v.replace(/<[^>]+>/g, ' ').replace(/[ \t]{2,}/g, ' ').trim() || v;
            return v.trim();
        }

        async function lvBypass(url, identifier, onStatus) {
            let taskCount = 0;
            for (let i = 0; i < CONFIG.linkvertise.maxIterations; i++) {
                const j = await lvFetch(JSON.stringify({ query: Q_GET, variables: { identifier, task_args: lvTaskArgs(url) } }));
                if (j?.errors) throw new Error(j.errors[0].message);

                const c = j?.data?.getContent;
                if (!c) throw new Error('getContent null (API update)');

                if (c.__typename === 'DetailPageTargetData') return lvCleanPaste(c.url || c.paste);

                const pending = (c.tasks || []).filter(t => t.__typename !== 'PremiumTask' && t.status !== 'DONE');
                if (!pending.length) break;

                for (const t of pending) {
                    if (t.__typename === 'WaitTask' && t.remainingWaitingTime) {
                        throw new Error(`WaitTask wall (${t.remainingWaitingTime}s) — Please use any VPN`);
                    }
                    taskCount++;
                    onStatus?.(`Completing task ${taskCount}...`);
                    const j2 = await lvFetch(JSON.stringify({ query: Q_COMPLETE, variables: { identifier, task_id: t.id, task_args: lvTaskArgs(url) } }));
                    if (j2?.errors) throw new Error(j2.errors[0].message);
                    const inner = j2?.data?.completeTask;
                    if (!inner) throw new Error('completeTask null');
                    if (inner.status === 'IN_PROGRESS') throw new Error('task stuck IN_PROGRESS');
                }
            }
            throw new Error('bypass iterations exhausted');
        }

        const identifier = lvIdentifier(location.href);

        const mount = () => {
            if (document.getElementById('ll-overlay')) return;

            createAdModal();
            const title = document.getElementById('ll-card-title');
            const sub = document.getElementById('ll-card-sub');
            const status = document.getElementById('gam-status-text');

            title.textContent = 'Linkvertise Bypass';

            if (!identifier) {
                sub.textContent = 'Error: Could not parse Linkvertise URL';
                status.textContent = 'Failed';
                const btn = document.getElementById('ll-btn');
                if (btn) { btn.disabled = false; btn.classList.add('ready'); btn.onclick = () => document.getElementById('ll-overlay').remove(); }
                document.getElementById('ll-btn-text').textContent = 'Close overlay';
                return;
            }

            sub.textContent = 'Parsing link';
            status.textContent = 'Identifying link type';

            lvBypass(location.href, identifier, msg => {
                sub.textContent = msg;
            }).then(dest => {
                title.textContent = 'Unlocked';
                sub.textContent = 'Destination resolved';
                GM_setClipboard(dest);
                enableRedirectBtn(dest, CONFIG.linkvertise.autoRedirect);
            }).catch(err => {
                title.textContent = 'Bypass failed';
                sub.textContent = err.message;
                const wrap = document.getElementById('gam-iframe-wrap');
                if (wrap) { const e = document.createElement('div'); e.id = 'll-error-msg'; e.textContent = err.message; wrap.appendChild(e); }
                const btn = document.getElementById('ll-btn');
                if (btn) { btn.disabled = false; btn.classList.add('ready'); btn.onclick = () => document.getElementById('ll-overlay').remove(); }
                const btnText = document.getElementById('ll-btn-text');
                if (btnText) btnText.textContent = 'Close overlay';
            });
        };

        mount();
        window.addEventListener('DOMContentLoaded', mount);
    }

    if (IS_VRX || IS_BST) {
        const W = window;
        const S = {
            minimized: false, running: false, done: false, code: null, bypassUrl: null,
            waitStart: 0, waitMs: 0, timer: 0, redirectTimer: 0, gate: null
        };
        const CFG = {
            VRX_MIN_WAIT_MS: 35000, VRX_MAX_WAIT_MS: 40000, BST_WAIT_MS: 4000,
            BLUE: '#3b82f6', BLUE_DIM: '#1e40af', BLUE_GLOW: '#60a5fa', BLUE_BG: '#0a1020',
            BLUE_SUR: '#0f172a', TEXT: '#e2e8f0', MUTED: '#94a3b8', OK: '#4ade80', ERR: '#f87171',
            W: 260, W_MIN: 140,
        };

        function detectGate() {
            const host = location.host.replace(/^www\./, '');
            if (host === 'vrxscripts.virexx.workers.dev') {
                const m = location.href.match(/\/s\/([^/?#]+)/);
                if (!m) return null;
                return { kind: 'vrx', name: m[1], endpoint: location.origin + '/api/code/' + m[1] };
            }
            if (host === 'bstshrt.com') {
                const m = location.pathname.match(/\/u\/([^/?#]+)/);
                if (m) return { kind: 'bstshrt', name: m[1] };
                return { kind: 'bstshrt', name: 'root' };
            }
            return null;
        }

        function cleanUrl(raw) {
            return raw.replace(/\\\//g, '/').replace(/\\u002F/gi, '/').replace(/\\u003A/gi, ':').replace(/\\\\/g, '\\');
        }

        function isPlausibleDest(url) {
            if (!url) return false;
            if (!/^https?:\/\//i.test(url)) return false;
            try {
                const u = new URL(url);
                const bad = ['bstshrt.com', 'www.bstshrt.com', 'google.com', 'googletagmanager.com'];
                if (bad.includes(u.hostname)) return false;
                const badPaths = ['/api/', '/_next/', '/static/', '.js', '.css', '.png', '.jpg', '.webp'];
                if (badPaths.some(p => u.pathname.includes(p) || u.href.endsWith(p))) return false;
                return true;
            } catch (e) { return false; }
        }

        function extractBstshrt() {
            const html = document.documentElement.innerHTML;
            const patterns = [
                /\\?"finalUrl\\?":\\?"(https?:[^"\\]+)\\?"/,
                /\\?"destination\\?":\\?"(https?:[^"\\]+)\\?"/,
                /\\?"targetUrl\\?":\\?"(https?:[^"\\]+)\\?"/,
                /\\?"redirectUrl\\?":\\?"(https?:[^"\\]+)\\?"/,
                /\\?"redirect_to\\?":\\?"(https?:[^"\\]+)\\?"/,
                /\\?"continueUrl\\?":\\?"(https?:[^"\\]+)\\?"/,
                /\\?"unlockUrl\\?":\\?"(https?:[^"\\]+)\\?"/,
                /\\?"destination_url\\?":\\?"(https?:[^"\\]+)\\?"/,
            ];
            for (const rx of patterns) {
                const m = html.match(rx);
                if (m) { const url = cleanUrl(m[1]); if (isPlausibleDest(url)) return { url, method: 'payload' }; }
            }
            const meta = document.querySelector('meta[http-equiv="refresh" i]');
            if (meta) {
                const c = meta.getAttribute('content') || '';
                const m = c.match(/url=(.+)$/i);
                if (m) { const url = cleanUrl(m[1].trim().replace(/^['"]|['"]$/g, '')); if (isPlausibleDest(url)) return { url, method: 'meta' }; }
            }
            return { url: null, method: null };
        }

        function req(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url, timeout: 15000,
                    onload: (r) => { if (r.status >= 200 && r.status < 300) resolve(r.responseText); else reject(new Error('HTTP ' + r.status)); },
                    onerror: () => reject(new Error('network')),
                    ontimeout: () => reject(new Error('timeout')),
                });
            });
        }

        function isValidCode(text) {
            if (!text) return false;
            const t = text.trim();
            if (t.length < 20) return false;
            if (/^<!doctype/i.test(t) || /^<html/i.test(t)) return false;
            return true;
        }

        async function fetchVrx(endpoint) {
            try {
                const txt = await req(endpoint);
                if (isValidCode(txt)) return { code: txt, source: 'direct' };
            } catch (e) {}
            const encoded = encodeURIComponent(endpoint);
            const proxies = [
                { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + encoded },
                { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy?quest=' + encoded },
                { name: 'corsproxy', url: 'https://corsproxy.io/?url=' + encoded },
            ];
            for (const p of proxies) {
                try {
                    const txt = await req(p.url);
                    if (isValidCode(txt)) return { code: txt, source: p.name };
                } catch (e) {}
            }
            return { code: null, source: null };
        }

        const panelHTML = `
            <style>
                * { box-sizing: border-box; }
                .panel { width: ${CFG.W}px; background: ${CFG.BLUE_BG}; border-radius: 12px; overflow: hidden;
                    box-shadow: 0 0 0 1px ${CFG.BLUE_DIM}, 0 0 24px -8px ${CFG.BLUE_GLOW}88, 0 16px 40px -12px rgba(0,0,0,.7);
                    font-family: system-ui,-apple-system,"Segoe UI",sans-serif; font-size: 12px; color: ${CFG.TEXT};
                    user-select: none; transition: width .2s ease; }
                .panel.min { width: ${CFG.W_MIN}px; }
                .bar { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px;
                    background: linear-gradient(180deg, ${CFG.BLUE_SUR}, ${CFG.BLUE_BG}); cursor: grab; }
                .bar:active { cursor: grabbing; }
                .logo { width: 7px; height: 7px; border-radius: 50%; background: ${CFG.BLUE}; box-shadow: 0 0 8px ${CFG.BLUE_GLOW}; flex-shrink: 0; }
                .logo.ok  { background: ${CFG.OK};  box-shadow: 0 0 8px ${CFG.OK};  }
                .logo.err { background: ${CFG.ERR}; box-shadow: 0 0 8px ${CFG.ERR}; }
                .logo.run { animation: pulse 1.1s ease-in-out infinite; }
                @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }
                .title { flex: 1; font-weight: 800; font-size: 11px; letter-spacing: .06em; color: ${CFG.BLUE_GLOW};
                    text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .btn { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 5px; background: transparent;
                    border: 0; color: ${CFG.MUTED}; cursor: pointer; padding: 0; font: 800 14px/1 system-ui; transition: background .15s, color .15s; }
                .btn:hover { background: ${CFG.BLUE_DIM}66; color: ${CFG.TEXT}; }
                .body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
                .panel.min .body { display: none; }
                .status { font: 600 11px ui-monospace,Consolas,monospace; color: ${CFG.MUTED}; display: flex; align-items: center; gap: 6px; min-height: 14px; }
                .status .k { flex-shrink: 0; color: ${CFG.BLUE_GLOW}; font-weight: 800; }
                .status .v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .bar-track { height: 4px; background: ${CFG.BLUE_DIM}55; border-radius: 2px; overflow: hidden; }
                .bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, ${CFG.BLUE}, ${CFG.BLUE_GLOW}); transition: width .2s linear; }
                .cd { display: flex; justify-content: space-between; font: 700 10px ui-monospace,Consolas,monospace; color: ${CFG.MUTED}; }
                .cd b { color: ${CFG.BLUE_GLOW}; }
                .url { font: 500 10px/1.4 ui-monospace,Consolas,monospace; color: ${CFG.BLUE_GLOW}; padding: 5px 7px;
                    border-radius: 5px; background: #00000055; word-break: break-all; max-height: 42px; overflow-y: auto; display: none; }
                .url.show { display: block; }
                .actions { display: flex; gap: 6px; }
                .actions button { flex: 1; padding: 7px 8px; border: 0; border-radius: 7px; background: ${CFG.BLUE}1a;
                    color: ${CFG.BLUE_GLOW}; font: 800 11px system-ui; cursor: pointer; transition: background .15s, transform .1s;
                    box-shadow: inset 0 0 0 1px ${CFG.BLUE_DIM}55; }
                .actions button:hover:not(:disabled) { background: ${CFG.BLUE}2e; box-shadow: inset 0 0 0 1px ${CFG.BLUE}aa; }
                .actions button:active:not(:disabled) { transform: scale(.97); }
                .actions button:disabled { opacity: .35; cursor: not-allowed; }
                .actions button.primary { background: linear-gradient(180deg, ${CFG.BLUE}, ${CFG.BLUE_DIM}); color: #fff;
                    box-shadow: inset 0 0 0 1px ${CFG.BLUE_GLOW}66, 0 4px 12px -4px ${CFG.BLUE_GLOW}66; }
                .actions button.primary:hover:not(:disabled) { background: linear-gradient(180deg, ${CFG.BLUE_GLOW}, ${CFG.BLUE}); }
                .log { max-height: 90px; overflow-y: auto; font: 500 10px/1.5 ui-monospace,Consolas,monospace; color: ${CFG.MUTED};
                    padding: 6px 8px; border-radius: 6px; background: #00000055; box-shadow: inset 0 0 0 1px ${CFG.BLUE_DIM}33; display: none; }
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
                    <div class="status"><span class="k" id="k">IDLE</span><span class="v" id="v">scanning</span></div>
                    <div class="bar-track"><div class="bar-fill" id="fill"></div></div>
                    <div class="cd"><span><b id="cdLeft">0</b>s</span><span id="cdPct">0%</span></div>
                    <div class="url" id="urlBox"></div>
                    <div class="actions">
                        <button id="start" class="primary">Start</button>
                        <button id="copy">Copy</button>
                    </div>
                    <div class="log" id="log"></div>
                </div>
            </div>
        `;

        let shadow = null;
        let initialized = false;

        function $(id) { return shadow ? shadow.getElementById(id) : null; }

        function log(msg, kind) {
            const logEl = $('log');
            if (!logEl) return;
            const d = document.createElement('div');
            if (kind) d.className = kind;
            d.textContent = msg;
            logEl.appendChild(d);
            logEl.scrollTop = logEl.scrollHeight;
            if (logEl.children.length > 30) logEl.removeChild(logEl.firstChild);
            if (!logEl.classList.contains('show')) logEl.classList.add('show');
        }

        function setLogo(kind) { const l = $('logo'); if (l) l.className = 'logo' + (kind ? ' ' + kind : ''); }
        function setStatus(k, v, kind) {
            const kEl = $('k'), vEl = $('v');
            if (kEl) kEl.textContent = k;
            if (vEl) vEl.textContent = v;
            setLogo(kind);
        }
        function setProgress(pct) {
            const p = Math.max(0, Math.min(100, pct));
            const fillEl = $('fill');
            if (fillEl) fillEl.style.width = p.toFixed(1) + '%';
            const cd = $('cdPct');
            if (cd) cd.textContent = Math.round(p) + '%';
        }
        function setCountdown(sec) {
            const el = $('cdLeft');
            if (el) el.textContent = Math.max(0, Math.ceil(sec));
        }

        function initUI() {
            if (initialized) return;
            initialized = true;

            const host = document.createElement('div');
            host.id = 'ghost-bypass-host';
            host.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; top: 20px; right: 20px;';
            document.documentElement.appendChild(host);

            shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = panelHTML;

            const panel = $('panel');
            const bar = $('bar');
            const btnMin = $('min');

            btnMin.addEventListener('click', () => {
                S.minimized = !S.minimized;
                panel.classList.toggle('min', S.minimized);
                btnMin.textContent = S.minimized ? '+' : '—';
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

            const btnStart = $('start');
            const btnCopy = $('copy');

            btnStart.addEventListener('click', () => {
                if (S.done && S.bypassUrl) { clearTimeout(S.redirectTimer); location.href = S.bypassUrl; return; }
                if (S.done && S.code) { try { GM_setClipboard(S.code, 'text'); } catch (e) {} log('re-copied', 'ok'); return; }
                start();
            });

            btnCopy.addEventListener('click', () => {
                const val = S.bypassUrl || S.code;
                if (!val) { log('nothing to copy', 'err'); return; }
                if (S.bypassUrl) { clearTimeout(S.redirectTimer); log('redirect cancelled', 'ok'); setStatus('COPIED', 'redirect cancelled', 'ok'); }
                try { GM_setClipboard(val, 'text'); } catch (e) {}
                btnCopy.textContent = 'Copied';
                setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1200);
            });

            log('loaded · ' + location.host + location.pathname);

            let tries = 0;
            const scan = setInterval(() => {
                tries++;
                const g = detectGate();
                if (g) {
                    clearInterval(scan);
                    S.gate = g;
                    setStatus('READY', g.kind + ' / ' + g.name, 'ok');
                    log('gate: ' + g.kind + ' / ' + g.name);
                    setTimeout(start, 600);
                    return;
                }
                if (tries >= 30) {
                    clearInterval(scan);
                    setStatus('IDLE', 'not a supported page', '');
                }
            }, 500);
        }

        function start() {
            if (S.running) return;
            if (!S.gate) S.gate = detectGate();
            if (!S.gate) { setStatus('NO GATE', 'unsupported page', 'err'); log('no gate detected', 'err'); return; }
            S.running = true;
            S.done = false;
            S.code = null;
            S.bypassUrl = null;
            const urlBox = $('urlBox');
            if (urlBox) urlBox.classList.remove('show');
            const btnStart = $('start');
            if (btnStart) { btnStart.disabled = true; btnStart.textContent = 'Working'; }

            if (S.gate.kind === 'vrx') {
                S.waitMs = CFG.VRX_MIN_WAIT_MS + Math.floor(Math.random() * (CFG.VRX_MAX_WAIT_MS - CFG.VRX_MIN_WAIT_MS));
                setStatus('WAIT', (S.waitMs / 1000).toFixed(1) + 's', 'run');
                log('gate: vrx / ' + S.gate.name);
            } else if (S.gate.kind === 'bstshrt') {
                S.waitMs = CFG.BST_WAIT_MS;
                setStatus('WAIT', (S.waitMs / 1000).toFixed(1) + 's', 'run');
                log('gate: bstshrt / ' + S.gate.name);
            }

            S.waitStart = Date.now();
            S.timer = setInterval(waitTick, 100);
            waitTick();
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
            if (S.gate.kind === 'vrx') return runVrx();
            if (S.gate.kind === 'bstshrt') return runBstshrt();
        }

        async function runVrx() {
            setStatus('FETCH', 'loading…', 'run');
            const result = await fetchVrx(S.gate.endpoint);
            if (!result.code) { setStatus('FAIL', 'no response', 'err'); S.running = false; $('start').disabled = false; $('start').textContent = 'Retry'; return; }
            S.code = result.code; S.source = result.source; S.done = true; S.running = false;
            setStatus('DONE', result.source + ' · ' + result.code.length + 'B', 'ok');
            setProgress(100);
            $('start').textContent = 'Copied';
            $('start').disabled = true;
            try { GM_setClipboard(result.code, 'text'); } catch (e) {}
            log('copied to clipboard', 'ok');
            applyToVrx(result.code);
        }

        function applyToVrx(code) {
            const codeEl = document.getElementById('code');
            if (codeEl) codeEl.textContent = code;
            const reward = document.getElementById('reward');
            if (reward) { reward.classList.add('show'); reward.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            const gate = document.getElementById('gate-script');
            if (gate) {
                gate.querySelectorAll('.step').forEach(s => s.setAttribute('data-state', 'done'));
                gate.querySelectorAll('.step-fill').forEach(f => { f.style.transition = 'transform .4s ease'; f.style.transform = 'scaleX(1)'; });
                const cnt = gate.querySelector('.gate-count b');
                if (cnt) cnt.textContent = '4';
                const go = gate.querySelector('.gate-go');
                if (go) go.disabled = false;
                gate.classList.add('opened');
            }
        }

        function runBstshrt() {
            const result = extractBstshrt();
            if (!result.url) { setStatus('FAIL', 'no destination', 'err'); log('payload: no url', 'err'); log('meta: no refresh', 'err'); S.running = false; $('start').disabled = false; $('start').textContent = 'Retry'; return; }
            S.bypassUrl = result.url; S.done = true; S.running = false;
            const urlBox = $('urlBox');
            urlBox.textContent = result.url;
            urlBox.classList.add('show');
            setStatus('DONE', 'via ' + result.method, 'ok');
            setProgress(100);
            $('start').textContent = 'Go';
            $('start').disabled = false;
            try { GM_setClipboard(result.url, 'text'); } catch (e) {}
            log('url: ' + result.url, 'ok');
            log('redirecting in 2s — Copy cancels');
            S.redirectTimer = setTimeout(() => { location.href = result.url; }, 2000);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initUI, { once: true });
        } else {
            initUI();
        }
    }
})();
