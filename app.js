(function() {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ========== TOAST ========== */
  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.textContent = msg;
    el.className = 'toast ' + type;
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: '110px',
      transform: 'translateX(-50%)',
      background: type === 'error' ? 'rgba(180,60,60,0.9)' : 'rgba(42,24,16,0.9)',
      color: '#f5ecdc', padding: '10px 20px', borderRadius: '10px',
      fontSize: '13px', letterSpacing: '1px', zIndex: 99999, opacity: 0,
      transition: 'opacity 300ms ease', maxWidth: '90%', textAlign: 'center'
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.style.opacity = '1');
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2000);
  }

  /* ========== CONFIRM DIALOG ========== */
  function confirmDialog(msg) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `<div class="confirm-box"><p>${msg}</p><div class="confirm-btns"><button class="confirm-cancel">取消</button><button class="confirm-ok">确认</button></div></div>`;
      Object.assign(overlay.style, {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100000
      });
      overlay.querySelector('.confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('.confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
      overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
      document.body.appendChild(overlay);
    });
  }

  function showEmpty(container, msg) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--ink-mute);">${msg}</div>`;
  }

  /* ========== LOCATION TRACKING ========== */
  let locationWatchId = null;
  let locationStatus = 'idle';
  let liveMap = null;
  let mapMarkers = { me: null, ta: null };
  let mapLine = null;
  let mapDistanceLabel = null;

  function getConnectionInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return null;
    return {
      effectiveType: conn.effectiveType || '',
      downlink: typeof conn.downlink === 'number' ? conn.downlink : null,
      rtt: typeof conn.rtt === 'number' ? conn.rtt : null,
      saveData: !!conn.saveData,
    };
  }

  function getDeviceLabel() {
    const ua = navigator.userAgent || '';
    const androidMatch = ua.match(/Android\s+[^;]+;\s*([^;)]+)\s+Build/i);
    if (androidMatch && androidMatch[1]) return androidMatch[1].trim();
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac OS X/i.test(ua)) return 'Mac';
    return navigator.platform || '设备';
  }

  function buildDeviceStatus() {
    return {
      label: getDeviceLabel(),
      platform: navigator.platform || '',
      online: navigator.onLine,
      network: getConnectionInfo(),
      screen: window.screen ? `${window.screen.width}x${window.screen.height}` : '',
      language: navigator.language || '',
      updatedAt: Date.now(),
    };
  }

  function syncPresence(payload = {}) {
    const room = Store.getState().room;
    if (!room) return Promise.resolve();
    return API.put(`/api/room/${room.id}/location`, {
      ...payload,
      device: buildDeviceStatus(),
    }).then((data) => {
      if (data && data.location) {
        const locations = Store.getState().locations;
        const idx = locations.findIndex(l => l.id === data.location.id || l.userId === data.location.userId);
        if (idx >= 0) locations[idx] = data.location;
        else locations.push(data.location);
        Store.setState({ locations: [...locations] });
      }
    }).catch(() => {});
  }

  function startLocationTracking() {
    if (!navigator.geolocation) {
      locationStatus = 'unsupported';
      renderMeta();
      return;
    }

    locationStatus = 'locating';
    renderMeta();

    locationWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        locationStatus = 'located';

        syncPresence({ lat: String(lat), lng: String(lng) });

        renderMeta();
      },
      (err) => {
        locationStatus = err.code === 1 ? 'denied' : 'error';
        renderMeta();
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );
  }

  function initMap() {
    const container = $('#liveMap');
    if (!container) return;
    if (liveMap) return;

    liveMap = L.map('liveMap', {
      center: [35, 105],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(liveMap);
    setTimeout(() => liveMap.invalidateSize(), 300);
  }

  function updateMap() {
    if (!liveMap) initMap();
    if (!liveMap) return;

    const user = Store.getState().user;
    const locations = Store.getState().locations;
    const meLoc = locations.find(l => l.userId === (user && user.id)) || {};
    const otherLoc = locations.find(l => l.userId !== (user && user.id)) || {};

    const hasMe = meLoc.lat && meLoc.lng;
    const hasTa = otherLoc.lat && otherLoc.lng;
    const mapStatus = $('#mapStatus');

    if (mapMarkers.me) { liveMap.removeLayer(mapMarkers.me); mapMarkers.me = null; }
    if (mapMarkers.ta) { liveMap.removeLayer(mapMarkers.ta); mapMarkers.ta = null; }
    if (mapLine) { liveMap.removeLayer(mapLine); mapLine = null; }
    if (mapDistanceLabel) { liveMap.removeLayer(mapDistanceLabel); mapDistanceLabel = null; }

    if (!hasMe && !hasTa) {
      if (mapStatus) mapStatus.textContent = '等待双方开启定位';
      return;
    }
    if (mapStatus) mapStatus.textContent = '';

    const s = Store.getState().settings;
    const meName = (s.meName || '我')[0];
    const taName = (s.taName || 'TA')[0];

    function createIcon(name, color) {
      return L.divIcon({
        className: 'map-avatar-icon',
        html: `<div class="map-avatar-marker" style="background:${color};"><span>${name}</span><div class="map-pulse"></div></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    }

    const meLat = hasMe ? Number(meLoc.lat) : null;
    const meLng = hasMe ? Number(meLoc.lng) : null;
    const taLat = hasTa ? Number(otherLoc.lat) : null;
    const taLng = hasTa ? Number(otherLoc.lng) : null;
    const points = [];

    if (hasMe) {
      mapMarkers.me = L.marker([meLat, meLng], { icon: createIcon(meName, '#b76e79') })
        .addTo(liveMap).bindPopup(meLoc.city || '我的位置');
      points.push([meLat, meLng]);
    }

    if (hasTa) {
      mapMarkers.ta = L.marker([taLat, taLng], { icon: createIcon(taName, '#4a90d9') })
        .addTo(liveMap).bindPopup(otherLoc.city || 'ta 的位置');
      points.push([taLat, taLng]);
    }

    if (points.length === 2) {
      mapLine = L.polyline(points, { color: '#b76e79', weight: 2, dashArray: '8 6', opacity: 0.7 }).addTo(liveMap);
      const km = Utils.distanceKm(meLat, meLng, taLat, taLng);
      const midLat = (meLat + taLat) / 2;
      const midLng = (meLng + taLng) / 2;
      mapDistanceLabel = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'map-dist-label',
          html: `<div class="map-dist-badge">${km} km</div>`,
          iconSize: [80, 28],
          iconAnchor: [40, 14],
        }),
      }).addTo(liveMap);
    }

    if (points.length > 0) {
      liveMap.fitBounds(points, { padding: [40, 40], maxZoom: 12 });
    }
  }

  /* ========== NAVIGATION ========== */
  function bindNav() {
    $$('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        $$('.tab').forEach(t => t.classList.toggle('active', t === btn));
        $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === target));
        if (target === 'status') renderStatus();
      });
    });
  }

  /* ========== NEW FLOW VIEWS ========== */
  function clearFlowViews() {
    $$('.flow-view').forEach(el => el.remove());
  }

  function hideMainApp() {
    $$('.topbar, .content, .tabbar').forEach(el => el.style.display = 'none');
  }

  function showMainApp() {
    $$('.topbar, .content, .tabbar').forEach(el => el.style.display = '');
  }

  function createFlowView(id, html) {
    clearFlowViews();
    hideMainApp();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'flow-view';
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  function showBrand(onDone) {
    const slides = [
      {
        mark: 'goodnight',
        title: '在很远的地方，也能靠近一点',
        sub: '看见彼此的位置、电量和今日状态，少一点担心，多一点安心。',
      },
      {
        mark: 'always with you',
        title: '把日常留下来',
        sub: '纪念日、心愿、心情和照片，会慢慢变成你们自己的时间线。',
      },
      {
        mark: 'only two',
        title: '先找到亲密的 ta',
        sub: '登录后完善资料，用配对码或二维码建立只属于你们的空间。',
      },
    ];

    const el = createFlowView('brandView', `
      <div class="brand-flow">
        <div class="brand-art">
          <div class="brand-orbit">
            <span class="brand-dot one"></span>
            <span class="brand-dot two"></span>
            <span class="brand-heart">❤</span>
          </div>
        </div>
        <div class="brand-copy">
          <p class="brand-mark" id="brandMark"></p>
          <h1 class="brand-title" id="brandFlowTitle"></h1>
          <p class="brand-sub" id="brandFlowSub"></p>
        </div>
        <div class="brand-dots" id="brandDots"></div>
        <div class="brand-actions">
          <button type="button" class="brand-skip" id="brandSkip">跳过</button>
          <button type="button" class="brand-next" id="brandNext">下一页</button>
        </div>
      </div>
    `);

    let idx = 0;
    const dots = $('#brandDots');
    dots.innerHTML = slides.map((_, i) => `<span class="brand-dot-step" data-i="${i}"></span>`).join('');

    const paint = () => {
      const item = slides[idx];
      $('#brandMark').textContent = item.mark;
      $('#brandFlowTitle').textContent = item.title;
      $('#brandFlowSub').textContent = item.sub;
      $$('.brand-dot-step').forEach((dot, i) => dot.classList.toggle('active', i === idx));
      $('#brandNext').textContent = idx === slides.length - 1 ? '开始' : '下一页';
    };

    const next = () => {
      if (idx < slides.length - 1) {
        idx += 1;
        paint();
      } else {
        onDone();
      }
    };

    $('#brandNext').addEventListener('click', next);
    $('#brandSkip').addEventListener('click', onDone);
    $$('.brand-dot-step').forEach(dot => dot.addEventListener('click', () => {
      idx = Number(dot.dataset.i) || 0;
      paint();
    }));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'ArrowRight') next();
    });
    paint();
  }

  function showLogin() {
    const el = createFlowView('loginView', `
      <div class="flow-center" style="padding:40px 28px;">
        <div class="flow-heart" style="margin-bottom:16px;">❤</div>
        <h1 class="flow-title" style="font-size:32px;">欢迎回来</h1>
        <p class="flow-sub" style="margin-bottom:28px;">用邮箱验证码或 QQ 登录</p>

        <div class="flow-form">
          <div class="server-config-row" id="serverConfigRow" style="display:none;">
            <input type="text" id="serverUrlInput" class="sw-input" placeholder="输入服务器地址，如 https://xxx.onrender.com" value="" />
            <button type="button" class="sw-btn ghost" id="saveServerBtn">保存</button>
          </div>
          <p class="sw-form-hint" id="serverHint" style="display:none;color:var(--ink-mute);font-size:12px;text-align:left;"></p>

          <div class="phone-row">
            <input type="email" id="loginEmail" class="sw-input" placeholder="邮箱" />
            <button type="button" class="sw-btn ghost" id="sendEmailCodeBtn">获取验证码</button>
          </div>
          <input type="tel" id="emailCode" class="sw-input" placeholder="6 位验证码" maxlength="6" inputmode="numeric" pattern="[0-9]*" />
          <p class="sw-form-err" id="loginErr"></p>
          <button type="button" class="sw-btn primary" id="emailLoginBtn">登录</button>

          <!-- 短信登录入口已注释，等短信资质下来后恢复 -->
          <!--
          <div class="flow-divider"><span>或</span></div>
          <div class="phone-row">
            <input type="tel" id="loginPhone" class="sw-input" placeholder="手机号" maxlength="11" inputmode="numeric" pattern="[0-9]*" />
            <button type="button" class="sw-btn ghost" id="sendCodeBtn">获取验证码</button>
          </div>
          <input type="tel" id="loginCode" class="sw-input" placeholder="6 位验证码" maxlength="6" inputmode="numeric" pattern="[0-9]*" />
          <button type="button" class="sw-btn primary" id="smsLoginBtn">短信登录</button>
          -->

          <div class="flow-divider"><span>或</span></div>

          <button type="button" class="sw-btn qq" id="qqLoginBtn">QQ 登录</button>

          <button type="button" class="sw-btn text" id="toggleServerBtn" style="margin-top:12px;background:transparent;color:var(--ink-mute);font-size:12px;">设置服务器地址</button>
        </div>
      </div>
    `);

    let countdown = 0;
    const sendBtn = $('#sendEmailCodeBtn');
    const emailEl = $('#loginEmail');
    const codeEl = $('#emailCode');
    const errEl = $('#loginErr');

    // 服务器地址配置
    API._initBase();
    const serverRow = $('#serverConfigRow');
    const serverInput = $('#serverUrlInput');
    const serverHint = $('#serverHint');
    const toggleBtn = $('#toggleServerBtn');

    serverInput.value = API.BASE || '';
    serverHint.textContent = API.BASE ? '当前: ' + API.BASE : '尚未设置服务器地址';

    toggleBtn.addEventListener('click', () => {
      const visible = serverRow.style.display !== 'none';
      serverRow.style.display = visible ? 'none' : 'block';
      serverHint.style.display = visible ? 'none' : 'block';
      toggleBtn.textContent = visible ? '设置服务器地址' : '收起';
    });

    $('#saveServerBtn').addEventListener('click', () => {
      const url = serverInput.value.trim();
      if (!url) {
        errEl.textContent = '请输入服务器地址';
        return;
      }
      API.setServer(url);
      serverHint.textContent = '当前: ' + url;
      serverHint.style.display = 'block';
      errEl.textContent = '';
      toast('服务器地址已保存');
      serverRow.style.display = 'none';
      toggleBtn.textContent = '设置服务器地址';
    });

    function setCountdown(n) {
      countdown = n;
      if (n > 0) {
        sendBtn.textContent = `${n}s`;
        sendBtn.disabled = true;
        setTimeout(() => setCountdown(n - 1), 1000);
      } else {
        sendBtn.textContent = '获取验证码';
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', async () => {
      const email = emailEl.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = '请输入正确的邮箱';
        return;
      }
      errEl.textContent = '';
      sendBtn.disabled = true;
      sendBtn.textContent = '发送中…';
      try {
        await API.post('/api/auth/email/send', { email });
        toast('验证码已发送');
        setCountdown(60);
      } catch (e) {
        errEl.textContent = e.message || '发送失败';
        sendBtn.disabled = false;
        sendBtn.textContent = '获取验证码';
      }
    });

    $('#emailLoginBtn').addEventListener('click', async () => {
      const email = emailEl.value.trim();
      const code = codeEl.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = '请输入正确的邮箱'; return; }
      if (!/^\d{6}$/.test(code)) { errEl.textContent = '请输入 6 位验证码'; return; }
      errEl.textContent = '';
      try {
        const data = await API.post('/api/auth/email/login', { email, code });
        API.setTokens(data.accessToken, data.refreshToken);
        Store.saveUser(data.user);
        toast('登录成功');
        showProfile();
      } catch (e) {
        errEl.textContent = e.message || '登录失败';
      }
    });

    $('#qqLoginBtn').addEventListener('click', () => {
      API.get('/api/auth/qq/url').then(data => {
        window.location.href = data.url;
      }).catch(() => toast('获取登录链接失败', 'error'));
    });
  }

  function showLogin() {
    const el = createFlowView('loginView', `
      <div class="login-shell">
        <div class="login-ambient" aria-hidden="true"></div>
        <section class="login-card" aria-label="goodnight 登录">
          <div class="login-heart" id="loginHeart" aria-hidden="true">❤</div>
          <h1 class="login-title">欢迎回到我们的小世界</h1>
          <p class="login-sub">用邮箱验证码登录，进入只属于你们的晚安时刻</p>

          <div class="login-form">
            <div class="login-email-row">
              <div class="email-field">
                <input type="email" id="loginEmail" class="login-input login-email" placeholder="输入邮箱" autocomplete="email" />
                <div class="email-suggestions" id="emailSuggestions" role="listbox" aria-label="常用邮箱后缀"></div>
              </div>
              <button type="button" class="login-send-btn" id="sendEmailCodeBtn">获取验证码</button>
            </div>

            <div class="login-code-group" id="emailCodeBoxes" aria-label="6 位验证码">
              <input class="code-box" inputmode="numeric" maxlength="1" aria-label="验证码第 1 位" />
              <input class="code-box" inputmode="numeric" maxlength="1" aria-label="验证码第 2 位" />
              <input class="code-box" inputmode="numeric" maxlength="1" aria-label="验证码第 3 位" />
              <input class="code-box" inputmode="numeric" maxlength="1" aria-label="验证码第 4 位" />
              <input class="code-box" inputmode="numeric" maxlength="1" aria-label="验证码第 5 位" />
              <input class="code-box" inputmode="numeric" maxlength="1" aria-label="验证码第 6 位" />
            </div>
            <input type="hidden" id="emailCode" />

            <p class="login-error" id="loginErr" aria-live="polite"></p>
            <button type="button" class="login-primary" id="emailLoginBtn">登录</button>

            <div class="login-divider"><span>或</span></div>
            <button type="button" class="login-qq" id="qqLoginBtn"><span class="qq-mark">Q</span><span>QQ 登录</span></button>
          </div>
        </section>
      </div>
    `);

    const sendBtn = $('#sendEmailCodeBtn');
    const emailEl = $('#loginEmail');
    const codeEl = $('#emailCode');
    const errEl = $('#loginErr');
    const codeBoxes = $$('.code-box', el);
    const heartEl = $('#loginHeart');
    const emailSuggestions = $('#emailSuggestions');
    const emailSuffixes = ['@qq.com', '@163.com', '@126.com', '@outlook.com', '@hotmail.com', '@gmail.com', '@icloud.com', '@foxmail.com', '@sina.com', '@yeah.net'];

    API._initBase();

    function showLoginError(message) {
      errEl.textContent = message || '';
      if (!message) return;
      errEl.classList.remove('show');
      void errEl.offsetWidth;
      errEl.classList.add('show');
      el.classList.remove('login-shake');
      void el.offsetWidth;
      el.classList.add('login-shake');
    }

    function syncCodeValue() {
      const code = codeBoxes.map(input => input.value).join('');
      codeEl.value = code;
      if (code.length === 6) {
        heartEl.classList.remove('code-complete');
        void heartEl.offsetWidth;
        heartEl.classList.add('code-complete');
      }
    }

    function hideEmailSuggestions() {
      emailSuggestions.classList.remove('show');
      emailSuggestions.innerHTML = '';
    }

    function renderEmailSuggestions() {
      const raw = emailEl.value.trim();
      if (!raw || raw.startsWith('@') || raw.includes(' ')) {
        hideEmailSuggestions();
        return;
      }

      const atIndex = raw.indexOf('@');
      const local = atIndex >= 0 ? raw.slice(0, atIndex) : raw;
      const typedDomain = atIndex >= 0 ? raw.slice(atIndex) : '';
      if (!local) {
        hideEmailSuggestions();
        return;
      }

      const matches = emailSuffixes
        .filter(suffix => !typedDomain || suffix.startsWith(typedDomain.toLowerCase()))
        .slice(0, 5);
      if (!matches.length) {
        hideEmailSuggestions();
        return;
      }

      emailSuggestions.innerHTML = matches
        .map(suffix => `<button type="button" class="email-suggestion" role="option" data-email="${Utils.escapeHtml(local + suffix)}">${Utils.escapeHtml(local + suffix)}</button>`)
        .join('');
      emailSuggestions.classList.add('show');
    }

    emailEl.addEventListener('input', renderEmailSuggestions);
    emailEl.addEventListener('focus', renderEmailSuggestions);
    emailEl.addEventListener('blur', () => setTimeout(hideEmailSuggestions, 120));
    emailSuggestions.addEventListener('mousedown', (e) => e.preventDefault());
    emailSuggestions.addEventListener('click', (e) => {
      const option = e.target.closest('.email-suggestion');
      if (!option) return;
      emailEl.value = option.dataset.email || option.textContent.trim();
      hideEmailSuggestions();
      sendBtn.focus();
    });

    codeBoxes.forEach((input, idx) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        syncCodeValue();
        if (input.value && idx < codeBoxes.length - 1) codeBoxes[idx + 1].focus();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) codeBoxes[idx - 1].focus();
      });
      input.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
        if (!text) return;
        e.preventDefault();
        codeBoxes.forEach((box, i) => { box.value = text[i] || ''; });
        syncCodeValue();
        const next = Math.min(text.length, codeBoxes.length) - 1;
        if (next >= 0) codeBoxes[next].focus();
      });
    });

    function setCountdown(n) {
      if (n > 0) {
        sendBtn.textContent = n + 's';
        sendBtn.disabled = true;
        setTimeout(() => setCountdown(n - 1), 1000);
      } else {
        sendBtn.textContent = '获取验证码';
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', async () => {
      const email = emailEl.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showLoginError('请先输入正确的邮箱地址');
        return;
      }
      showLoginError('');
      sendBtn.disabled = true;
      sendBtn.textContent = '发送中';
      try {
        await API.post('/api/auth/email/send', { email });
        toast('验证码已发送');
        codeBoxes[0].focus();
        setCountdown(60);
      } catch (e) {
        showLoginError(e.message || '邮件暂时发不出去，请稍后再试');
        sendBtn.disabled = false;
        sendBtn.textContent = '获取验证码';
      }
    });

    $('#emailLoginBtn').addEventListener('click', async () => {
      const email = emailEl.value.trim();
      const code = codeEl.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showLoginError('请先输入正确的邮箱地址'); return; }
      if (!/^\d{6}$/.test(code)) { showLoginError('请输入 6 位验证码'); return; }
      showLoginError('');
      try {
        const data = await API.post('/api/auth/email/login', { email, code });
        API.setTokens(data.accessToken, data.refreshToken);
        Store.saveUser(data.user);
        toast('登录成功');
        showProfile();
      } catch (e) {
        showLoginError(e.message || '登录失败，请稍后再试');
      }
    });

    $('#qqLoginBtn').addEventListener('click', () => {
      API.get('/api/auth/qq/url').then(data => {
        window.location.href = data.url;
      }).catch(() => toast('QQ 登录暂未开放', 'error'));
    });
  }

  function showProfile() {
    const user = Store.getState().user || {};
    const el = createFlowView('profileView', `
      <div class="flow-center" style="padding:40px 28px;">
        <h1 class="flow-title" style="font-size:28px;">完善资料</h1>
        <p class="flow-sub" style="margin-bottom:28px;">让 goodnight 更了解你们</p>

        <div class="flow-form">
          <label class="sw-label"><span>昵称</span>
            <input type="text" id="profileNickname" class="sw-input" placeholder="2-20 个字符" maxlength="20" value="${Utils.escapeHtml(user.nickname || '')}" />
          </label>

          <label class="sw-label"><span>性别</span></label>
          <div class="gender-row">
            <button type="button" class="gender-btn" data-gender="boy">Boy · 男</button>
            <button type="button" class="gender-btn" data-gender="girl">Girl · 女</button>
          </div>

          <label class="sw-label"><span>在一起的日期</span>
            <input type="date" id="profileAnniversary" class="sw-input" />
          </label>

          <p class="sw-form-err" id="profileErr"></p>
          <button type="button" class="sw-btn primary" id="profileSubmitBtn">继续配对</button>
        </div>
      </div>
    `);

    let selectedGender = user.gender || '';
    const genderBtns = $$('.gender-btn');
    genderBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.gender === selectedGender);
      btn.addEventListener('click', () => {
        selectedGender = btn.dataset.gender;
        genderBtns.forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    if (user.anniversary) {
      try {
        $('#profileAnniversary').value = Utils.fmtDate(new Date(user.anniversary));
      } catch(e) {}
    }

    $('#profileSubmitBtn').addEventListener('click', async () => {
      const nickname = $('#profileNickname').value.trim();
      const anniversary = $('#profileAnniversary').value;
      const errEl = $('#profileErr');

      if (!nickname || nickname.length < 2 || nickname.length > 20) {
        errEl.textContent = '昵称需在 2-20 个字符之间'; return;
      }
      if (!selectedGender) { errEl.textContent = '请选择性别'; return; }
      if (!anniversary) { errEl.textContent = '请选择在一起的日期'; return; }

      errEl.textContent = '';
      try {
        const data = await API.patch('/api/profile', { nickname, gender: selectedGender, anniversary });
        Store.saveUser({ ...Store.getState().user, ...data.user });
        toast('资料已保存');
        showPair();
      } catch (e) {
        errEl.textContent = e.message || '保存失败';
      }
    });
  }

  function showPair() {
    const el = createFlowView('pairView', `
      <div class="flow-center" style="padding:36px 24px;">
        <h1 class="flow-title" style="font-size:28px;">添加亲密的 Ta</h1>
        <p class="flow-sub" style="margin-bottom:24px;">把配对码或二维码发给 ta，或输入 ta 的配对码</p>

        <div class="pair-card linkup-card">
          <div class="pair-download">↓</div>
          <div class="pair-symbol">+=</div>
          <div class="pair-code-label">匹配码</div>
          <div class="pair-code" id="pairCodeValue">—</div>
          <div class="pair-qr-wrap" id="pairQrWrap"></div>
          <p class="pair-hint">goodnight 扫码添加我吧</p>
        </div>

        <div class="pair-options">
          <button type="button" class="pair-option" id="scanPairBtn"><span class="pair-option-icon blue">⌗</span><span><b>扫一扫</b><em>扫描 ta 的二维码加好友</em></span><i>›</i></button>
          <button type="button" class="pair-option" id="contactsPairBtn"><span class="pair-option-icon purple">●</span><span><b>手机联系人</b><em>添加手机通讯录中的好友</em></span><i>›</i></button>
          <button type="button" class="pair-option" id="qqPairBtn"><span class="pair-option-icon qq">Q</span><span><b>添加 QQ 好友</b><em>审核通过后开放分享</em></span><i>›</i></button>
        </div>

        <div class="flow-divider"><span>输入对方配对码</span></div>

        <div class="flow-form">
          <input type="tel" id="joinCodeInput" class="sw-input" placeholder="6-8 位配对码" maxlength="8" inputmode="numeric" pattern="[0-9]*" />
          <p class="sw-form-err" id="pairErr"></p>
          <button type="button" class="sw-btn primary" id="joinPairBtn">绑定</button>
        </div>
      </div>
    `);

    async function loadCode() {
      try {
        const data = await API.get('/api/pair/code');
        $('#pairCodeValue').textContent = data.matchCode;
        const user = Store.getState().user || {};
        Store.saveUser({ ...user, matchCode: data.matchCode });
        const qr = qrcode(0, 'M');
        qr.addData(data.qrToken || data.matchCode);
        qr.make();
        $('#pairQrWrap').innerHTML = qr.createImgTag(6, 2);
      } catch (e) {
        $('#pairErr').textContent = e.message || '获取配对码失败';
      }
    }
    loadCode();

    $('#scanPairBtn').addEventListener('click', () => toast('扫码能力已预留，当前请先输入配对码'));
    $('#contactsPairBtn').addEventListener('click', () => toast('联系人能力已预留，当前请先输入配对码'));
    $('#qqPairBtn').addEventListener('click', () => toast('QQ 分享等审核通过后开放'));

    $('#joinPairBtn').addEventListener('click', async () => {
      const matchCode = $('#joinCodeInput').value.trim();
      const errEl = $('#pairErr');
      if (!/^\d{6,8}$/.test(matchCode)) { errEl.textContent = '请输入 6-8 位配对码'; return; }
      errEl.textContent = '';
      try {
        const data = await API.post('/api/pair/join', { matchCode });
        Store.setState({ room: data.room });
        // sync profile anniversary to room settings
        const user = Store.getState().user;
        if (user && (user.nickname || user.anniversary)) {
          try {
            await API.put(`/api/room/${data.room.id}/settings`, {
              meName: user.nickname || '',
              taName: data.partner ? (data.partner.nickname || '') : '',
              sinceDate: user.anniversary ? Utils.fmtDate(new Date(user.anniversary)) : '',
              nextMeetDate: ''
            });
          } catch(e) {}
        }
        toast('配对成功');
        await loadRoomData();
        showPermissions();
      } catch (e) {
        errEl.textContent = e.message || '配对失败';
      }
    });
  }

  function showPermissions() {
    const el = createFlowView('permissionsView', `
      <div class="flow-center" style="padding:36px 24px;align-items:flex-start;">
        <h1 class="flow-title" style="font-size:28px;text-align:left;">最后一步</h1>
        <p class="flow-sub" style="text-align:left;margin-bottom:28px;">开启以下权限，让彼此始终在线</p>

        <div class="perm-list">
          <div class="perm-item">
            <div class="perm-icon">📍</div>
            <div class="perm-body">
              <div class="perm-title">实时定位权限</div>
              <div class="perm-desc">在地图上看见彼此的距离</div>
            </div>
            <button type="button" class="perm-btn" data-perm="location">去设置</button>
          </div>
          <div class="perm-item">
            <div class="perm-icon">🔋</div>
            <div class="perm-body">
              <div class="perm-title">允许后台运行</div>
              <div class="perm-desc">锁屏时也能持续同步位置</div>
            </div>
            <button type="button" class="perm-btn" data-perm="background">去设置</button>
          </div>
          <div class="perm-item">
            <div class="perm-icon">🔔</div>
            <div class="perm-body">
              <div class="perm-title">开启通知权限</div>
              <div class="perm-desc">不错过对方的每一次心动</div>
            </div>
            <button type="button" class="perm-btn" data-perm="notification">去设置</button>
          </div>
        </div>

        <button type="button" class="sw-btn primary" id="enterMainBtn" style="margin-top:auto;width:100%;">进入主页</button>
      </div>
    `);

    $$('.perm-btn').forEach(btn => {
      btn.addEventListener('click', () => openPermissionSettings(btn.dataset.perm));
    });

    $('#enterMainBtn').addEventListener('click', async () => {
      try {
        let locationReady = false;
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          locationReady = result.state === 'granted';
        } else if (navigator.geolocation) {
          locationReady = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false), { timeout: 5000 });
          });
        }
        if (!locationReady) toast('定位权限稍后也可以在系统设置中开启');
        localStorage.setItem('goodnight_permissions_done', '1');
        localStorage.setItem('wanan_permissions_done', '1');
        enterMainApp();
      } catch (e) {
        toast('权限稍后也可以在系统设置中开启');
        localStorage.setItem('goodnight_permissions_done', '1');
        localStorage.setItem('wanan_permissions_done', '1');
        enterMainApp();
      }
    });
  }

  function openPermissionSettings(type) {
    const appLauncher = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppLauncher;
    if (appLauncher && appLauncher.open) {
      let url = 'app-settings:';
      if (type === 'location') url = 'app-settings:';
      if (type === 'notification') url = 'app-settings:';
      appLauncher.open({ url }).catch(() => toast('无法打开系统设置'));
      return;
    }

    const guide = {
      location: '请在系统设置中打开「定位」权限',
      background: '请在系统设置中允许本 App「后台运行」或「自启动」',
      notification: '请在系统设置中打开「通知」权限'
    };
    toast(guide[type] || '请在系统设置中手动开启');
  }

  /* ========== AUTH CALLBACK ========== */
  function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const user = params.get('user');

    if (token && refreshToken) {
      API.setTokens(token, refreshToken);
      if (user) {
        try { Store.saveUser(JSON.parse(decodeURIComponent(user))); } catch(e) {}
      }
      window.history.replaceState({}, '', '/');
      return true;
    }
    return false;
  }

  /* ========== DATA LOADING ========== */
  async function loadRoomData() {
    const state = Store.getState();
    if (!state.room) return;

    Store.setState({ loading: true, error: null });
    try {
      const [wishData, annivData, moodData, momentData, settingsData, locationData] = await Promise.all([
        API.get(`/api/room/${state.room.id}/wishes`),
        API.get(`/api/room/${state.room.id}/anniversaries`),
        API.get(`/api/room/${state.room.id}/moods`),
        API.get(`/api/room/${state.room.id}/moments`),
        API.get(`/api/room/${state.room.id}/settings`),
        API.get(`/api/room/${state.room.id}/location`),
      ]);

      Store.setState({
        wishes: wishData.wishes || [],
        anniversaries: annivData.anniversaries || [],
        moods: moodData.moods || [],
        moments: momentData.moments || [],
        settings: settingsData.settings || {},
        locations: locationData.locations || [],
        loading: false,
      });
    } catch (e) {
      Store.setState({ loading: false, error: e.message });
    }
  }

  /* ========== RENDER FUNCTIONS ========== */
  function getSinceDate() {
    const s = Store.getState().settings;
    const user = Store.getState().user;
    return s.sinceDate || (user && user.anniversary ? Utils.fmtDate(new Date(user.anniversary)) : '');
  }

  function renderHome() {
    const s = Store.getState().settings;
    const user = Store.getState().user;
    const today = new Date();
    const sinceDate = getSinceDate();
    const days = sinceDate ? Utils.daysBetween(sinceDate, today) : 0;

    const daysEl = $('#daysNumber');
    if (daysEl && daysEl.textContent !== String(days)) {
      daysEl.textContent = days;
      daysEl.classList.remove('pulse-in');
      void daysEl.offsetWidth;
      daysEl.classList.add('pulse-in');
    }

    const sdEl = $('#sinceDate');
    if (sdEl) sdEl.textContent = sinceDate ? `自 ${sinceDate} 起` : '还没设置在一起的日子';

    const b = Utils.breakdownDays(days);
    const bdMonths = $('#bdMonths'); if (bdMonths) bdMonths.textContent = b.months;
    const bdWeeks = $('#bdWeeks'); if (bdWeeks) bdWeeks.textContent = b.weeks;
    const bdHours = $('#bdHours'); if (bdHours) bdHours.textContent = b.hours;

    const box = $('#nextAnnivBox');
    if (box) {
      const annivs = Store.getState().anniversaries;
      const candidates = [...annivs];
      if (sinceDate) candidates.push({ id: '__since', name: '在一起的日子', date: sinceDate });
      const next = Utils.pickNextAnniv(candidates, today);
      const naName = $('#naName');
      const naDays = $('#naDays');
      const naUnit = box.querySelector('.na-unit');
      if (next) {
        if (naName) naName.textContent = next.name;
        if (naDays) naDays.textContent = next.next.daysLeft === 0 ? '今天' : next.next.daysLeft;
        if (naUnit) naUnit.textContent = next.next.daysLeft === 0 ? ' 🎉' : '天后';
      } else {
        if (naName) naName.textContent = '下一个纪念日？';
        if (naDays) naDays.textContent = '—';
        if (naUnit) naUnit.textContent = '天后';
      }
    }

    const brandTitle = $('#brandTitle');
    if (brandTitle) {
      const taName = s.taName || (user && user.partner && user.partner.nickname) || 'ta';
      brandTitle.textContent = `${s.meName || (user && user.nickname) || '我'} & ${taName}`;
    }
    const subTitle = $('#subTitle');
    if (subTitle) subTitle.textContent = Store.getState().room ? '同步中' : '还没配对';
  }

  function renderWish() {
    const list = $('#wishList');
    if (!list) return;
    list.innerHTML = '';
    const wishes = Store.getState().wishes;

    if (!wishes.length) {
      showEmpty(list, '加上你们的第一个心愿 ✦');
    } else {
      wishes.forEach(w => {
        const li = document.createElement('li');
        li.className = 'wish-item' + (w.done ? ' done' : '');
        li.innerHTML = `<input type="checkbox" class="w-check" ${w.done ? 'checked' : ''} /><span class="w-text"></span><button class="w-del" title="删除">×</button>`;
        li.querySelector('.w-text').textContent = w.text;
        li.querySelector('.w-check').addEventListener('change', async () => {
          try {
            const updated = await API.patch(`/api/room/${Store.getState().room.id}/wishes/${w.id}`, { done: !w.done });
            const wishes = Store.getState().wishes.map(ww => ww.id === w.id ? updated.wish : ww);
            Store.setState({ wishes });
            renderWish();
          } catch (e) { toast('更新失败', 'error'); }
        });
        li.querySelector('.w-del').addEventListener('click', async () => {
          const ok = await confirmDialog('确定删除这个心愿？');
          if (!ok) return;
          try {
            await API.delete(`/api/room/${Store.getState().room.id}/wishes/${w.id}`);
            Store.setState({ wishes: Store.getState().wishes.filter(ww => ww.id !== w.id) });
            renderWish();
            toast('已删除');
          } catch (e) { toast('删除失败', 'error'); }
        });
        list.appendChild(li);
      });
    }

    const total = wishes.length;
    const done = wishes.filter(w => w.done).length;
    const stat = $('#wishStat');
    if (stat) stat.textContent = total ? `已完成 ${done} / ${total}` : '';
  }

  function renderMeta() {
    const s = Store.getState().settings;
    const locations = Store.getState().locations;
    const user = Store.getState().user;
    const moods = Store.getState().moods;

    const meLoc = locations.find(l => l.userId === (user && user.id)) || {};
    const otherLoc = locations.find(l => l.userId !== (user && user.id)) || {};

    const cityMe = $('#cityMe');
    if (cityMe) {
      const statusTexts = {
        idle: '待定位',
        locating: '定位中...',
        located: meLoc.city || '已定位',
        denied: '定位权限被拒绝',
        error: '定位失败',
        unsupported: '设备不支持定位'
      };
      cityMe.textContent = statusTexts[locationStatus] || '待定位';
    }

    const locStatusEl = $('#locStatus');
    if (locStatusEl) {
      const statusMap = {
        idle: '',
        locating: '正在获取位置...',
        located: '✓ 位置已自动同步',
        denied: '请在系统设置中开启定位权限',
        error: '定位服务暂不可用',
        unsupported: '当前设备不支持定位'
      };
      locStatusEl.textContent = statusMap[locationStatus] || '';
    }

    const cityTa = $('#cityTa');
    if (cityTa) cityTa.textContent = otherLoc.city || '待对方开启';

    const km = meLoc.lat && meLoc.lng && otherLoc.lat && otherLoc.lng
      ? Utils.distanceKm(Number(meLoc.lat), Number(meLoc.lng), Number(otherLoc.lat), Number(otherLoc.lng))
      : null;
    const distKm = $('#distanceKm');
    if (distKm) distKm.textContent = km != null ? km : '—';
    const distNote = $('#distanceNote');
    if (distNote) distNote.textContent = km != null ? '地球表面最短距离（Haversine）' : '对方开启定位后自动显示';

    function parseJsonField(loc, key) {
      if (!loc || !loc[key]) return null;
      try {
        return typeof loc[key] === 'string' ? JSON.parse(loc[key]) : loc[key];
      } catch(e) {
        return null;
      }
    }

    function batLine(loc) {
      if (!loc || !loc.battery) return '—';
      try {
        const b = parseJsonField(loc, 'battery');
        if (!b) return '—';
        const icon = b.charging ? '⚡' : '🔋';
        const mins = Math.round((Date.now() - (b.updatedAt || Date.now())) / 60000);
        const timeDesc = mins < 1 ? '刚刚' : mins + ' 分钟前';
        return `${icon} ${b.level}% · ${timeDesc}`;
      } catch(e) { return '—'; }
    }
    const meBat = $('#meBattery');
    if (meBat) meBat.textContent = batLine(meLoc);
    const taBat = $('#taBattery');
    if (taBat) taBat.textContent = batLine(otherLoc);

    const meDevice = $('#meDevice');
    if (meDevice) {
      const meDeviceData = parseJsonField(meLoc, 'device');
      meDevice.textContent = meDeviceData ? `${meDeviceData.label || '设备'} · ${meDeviceData.online ? '在线' : '离线'}` : '同步中';
    }
    const taNetwork = $('#taNetwork');
    if (taNetwork) {
      const taDeviceData = parseJsonField(otherLoc, 'device');
      const network = taDeviceData && taDeviceData.network;
      if (network && (network.effectiveType || network.downlink)) {
        taNetwork.textContent = `${network.effectiveType || '网络'}${network.downlink ? ` · ${network.downlink}Mbps` : ''}`;
      } else {
        taNetwork.textContent = taDeviceData ? '在线' : '等待同步';
      }
    }

    const today = Utils.todayStr();
    const otherMood = moods.find(m => m.userId !== (user && user.id) && m.date === today);
    const taMood = $('#taMood');
    if (taMood) {
      if (otherMood) {
        taMood.textContent = `ta 今天: ${['', '😢', '😔', '😐', '🙂', '😊'][otherMood.level] || ''}`;
        taMood.style.display = '';
      } else {
        taMood.textContent = '';
        taMood.style.display = 'none';
      }
    }

    const list = $('#annivList');
    if (!list) return;
    list.innerHTML = '';
    const annivs = Store.getState().anniversaries;
    const todayDate = new Date();
    const displayList = [];
    annivs.forEach(a => {
      const next = Utils.nextAnniversary(a.date, todayDate);
      displayList.push({ id: a.id, name: a.name, date: a.date, daysLeft: next ? next.daysLeft : null, year: next ? next.year : null });
    });
    displayList.sort((a, b) => (a.daysLeft ?? 9e9) - (b.daysLeft ?? 9e9));

    if (!displayList.length) {
      showEmpty(list, '还没有，去添加一个吧');
    } else {
      displayList.forEach(a => {
        const li = document.createElement('li');
        li.className = 'anniv-item';
        const daysText = a.daysLeft === 0 ? '今天' : (a.daysLeft != null && a.daysLeft >= 0 ? a.daysLeft + ' 天' : '已过');
        const dateLine = `${a.date} · ${a.year ? `${a.year} 年还有 ${daysText}` : ''}`;
        li.innerHTML = `<div class="a-main"><span class="a-name"></span><span class="a-date"></span></div><span class="a-days">${daysText}</span>`;
        li.querySelector('.a-name').textContent = a.name;
        li.querySelector('.a-date').textContent = dateLine;
        const delBtn = document.createElement('button');
        delBtn.className = 'a-del';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', async () => {
          const ok = await confirmDialog('确定删除这个纪念日？');
          if (!ok) return;
          try {
            await API.delete(`/api/room/${Store.getState().room.id}/anniversaries/${a.id}`);
            Store.setState({ anniversaries: Store.getState().anniversaries.filter(aa => aa.id !== a.id) });
            renderMeta();
            renderHome();
            toast('已删除');
          } catch (e) { toast('删除失败', 'error'); }
        });
        li.appendChild(delBtn);
        list.appendChild(li);
      });
    }
    updateMap();
  }

  function renderMood() {
    const today = Utils.todayStr();
    const moods = Store.getState().moods;
    const user = Store.getState().user;
    const current = moods.find(m => m.userId === (user && user.id) && m.date === today);

    $$('#moodPicker button').forEach(b => b.classList.toggle('selected', current && String(current.level) === b.dataset.mood));
    const moodToday = $('#moodToday');
    if (moodToday) moodToday.textContent = current ? `今天是 ${['', '很难过', '有点低落', '平常', '不错', '非常开心'][current.level] || ''}` : '今天还没有打卡';

    const otherMood = moods.find(m => m.userId !== (user && user.id) && m.date === today);
    const taMoodEl = $('#taMoodDisplay');
    if (taMoodEl) {
      if (otherMood) {
        taMoodEl.textContent = `ta 今天: ${['', '😢', '😔', '😐', '🙂', '😊'][otherMood.level] || ''}`;
        taMoodEl.style.display = '';
      } else {
        taMoodEl.style.display = 'none';
      }
    }

    const strip = $('#moodStrip');
    if (strip) {
      strip.innerHTML = '';
      const today0 = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - i);
        const key = Utils.fmtDate(d);
        const cell = document.createElement('div');
        cell.className = 'mood-cell';
        const m = moods.find(mo => mo.userId === (user && user.id) && mo.date === key);
        if (m) cell.dataset.mood = m.level;
        cell.title = `${key} ${m ? '· ' + ['', '很难过', '有点低落', '平常', '不错', '非常开心'][m.level] : ''}`;
        strip.appendChild(cell);
      }
    }

    const log = $('#moodLog');
    if (log) {
      log.innerHTML = '';
      const myMoods = moods.filter(m => m.userId === (user && user.id));
      const withNote = myMoods.filter(m => m.note).sort((a, b) => b.date.localeCompare(a.date));
      if (!withNote.length) {
        showEmpty(log, '还没有心情笔记～');
      } else {
        withNote.slice(0, 20).forEach(m => {
          const li = document.createElement('li');
          li.innerHTML = `<div class="d">${m.date} · ${['', '很难过', '有点低落', '平常', '不错', '非常开心'][m.level] || ''}</div><div></div>`;
          li.querySelectorAll('div')[1].textContent = m.note;
          log.appendChild(li);
        });
      }
    }
  }

  function renderMoments() {
    const timeline = $('#momentTimeline');
    const empty = $('#momentEmpty');
    if (!timeline) return;

    const moments = Store.getState().moments;
    const user = Store.getState().user;
    const s = Store.getState().settings;

    timeline.querySelectorAll('.moment-card').forEach(el => el.remove());

    if (!moments.length) {
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';

    moments.forEach(m => {
      const isMe = m.userId === (user && user.id);
      const authorName = isMe ? (s.meName || user.nickname || '我') : (s.taName || 'ta');

      const card = document.createElement('div');
      card.className = 'moment-card' + (isMe ? ' me' : ' ta');
      card.dataset.momentId = m.id;
      const timeStr = Utils.fmtRelative(m.createdAt);

      card.innerHTML = `
        <div class="mc-avatar">${authorName[0]}</div>
        <div class="mc-body">
          <div class="mc-image-wrap">
            <img src="${m.imageUrl}" alt="" loading="lazy" />
          </div>
          <p class="mc-text">${Utils.escapeHtml(m.text || '')}</p>
          <div class="mc-footer">
            <span class="mc-location">${m.city || m.location || ''}</span>
            <span class="mc-time">${timeStr}</span>
            ${isMe ? '<button class="mc-del" title="删除">×</button>' : ''}
          </div>
        </div>
      `;

      card.querySelector('.mc-image-wrap').addEventListener('click', () => showMomentDetail(m, isMe));
      const delBtn = card.querySelector('.mc-del');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await confirmDialog('确定删除这个瞬间？');
          if (!ok) return;
          try {
            await API.delete(`/api/room/${Store.getState().room.id}/moments/${m.id}`);
            const moments = Store.getState().moments.filter(mm => mm.id !== m.id);
            Store.setState({ moments });
            renderMoments();
            toast('已删除');
          } catch (e) { toast('删除失败', 'error'); }
        });
      }

      timeline.appendChild(card);
    });
  }

  function showMomentDetail(moment, isMe) {
    const detail = $('#momentDetail');
    if (!detail) return;

    $('#mdImage').src = moment.imageUrl;
    $('#mdText').textContent = moment.text;
    $('#mdMeta').textContent = `${moment.city || moment.location || ''} · ${Utils.fmtRelative(moment.createdAt)}`;
    $('#mdDelete').style.display = isMe ? '' : 'none';
    detail.dataset.momentId = moment.id;
    detail.style.display = '';

    detail.querySelector('.md-backdrop').onclick = () => { detail.style.display = 'none'; };
    $('#mdClose').onclick = () => { detail.style.display = 'none'; };

    $('#mdDelete').onclick = async () => {
      const ok = await confirmDialog('确定删除这个瞬间？');
      if (!ok) return;
      try {
        await API.delete(`/api/room/${Store.getState().room.id}/moments/${moment.id}`);
        const moments = Store.getState().moments.filter(mm => mm.id !== moment.id);
        Store.setState({ moments });
        renderMoments();
        detail.style.display = 'none';
        toast('已删除');
      } catch (e) { toast('删除失败', 'error'); }
    };
  }

  function renderSettings() {
    const s = Store.getState().settings;
    const user = Store.getState().user;

    const sMeName = $('#sMeName');
    if (sMeName) sMeName.value = user && user.nickname ? user.nickname : (s.meName || '');

    const pairCodeDisplay = $('#pairCodeDisplay');
    if (pairCodeDisplay) {
      if (Store.getState().room) {
        // matchCode is on user, fetch if missing
        const code = user && user.matchCode ? user.matchCode : '已配对';
        pairCodeDisplay.textContent = code;
      } else {
        pairCodeDisplay.textContent = '未配对';
      }
    }

    const unpairBtn = $('#unpairBtn');
    if (unpairBtn) unpairBtn.style.display = Store.getState().room ? '' : 'none';
  }

  function renderAll() {
    renderHome();
    renderWish();
    renderMeta();
    renderMood();
    renderMoments();
    renderSettings();
  }

  /* ========== PHONE STATUS ========== */
  const statusState = {
    appOpenedAt: Date.now(),
    lastDownlink: null,
    batteryLevel: null,
    batteryCharging: null,
  };

  function startStatusUpdates() {
    updateBatteryStatus();
    updateNetworkStatus();
    updateStorageStatus();

    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        b.addEventListener('levelchange', updateBatteryStatus);
        b.addEventListener('chargingchange', updateBatteryStatus);
      }).catch(() => {});
    }

    if (navigator.connection) {
      navigator.connection.addEventListener('change', () => {
        updateNetworkStatus();
        syncPresence();
      });
    }

    setInterval(() => {
      updateNetworkStatus();
      renderStatus();
    }, 3000);
  }

  function updateBatteryStatus() {
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        statusState.batteryLevel = Math.round(b.level * 100);
        statusState.batteryCharging = b.charging;
      }).catch(() => {});
    }
  }

  function updateNetworkStatus() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.downlink) {
      statusState.lastDownlink = conn.downlink;
    }
  }

  async function updateStorageStatus() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        statusState.storage = est;
      } catch(e) {}
    }
  }

  function formatDuration(ms) {
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    return hours > 0 ? `${hours}小时${m}分` : `${m}分钟`;
  }

  function formatBytes(bytes) {
    if (!bytes) return '—';
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  }

  function renderStatus() {
    const usage = Date.now() - statusState.appOpenedAt;
    const usageEl = $('#stUsage');
    if (usageEl) usageEl.textContent = formatDuration(usage);

    const speedEl = $('#stSpeed');
    if (speedEl) {
      if (statusState.lastDownlink != null) {
        speedEl.textContent = `${statusState.lastDownlink} Mbps · ${navigator.connection.effectiveType || ''}`;
      } else {
        speedEl.textContent = '本设备暂不支持';
      }
    }

    const batEl = $('#stBattery');
    if (batEl) {
      if (statusState.batteryLevel != null) {
        const icon = statusState.batteryCharging ? '⚡' : '🔋';
        batEl.textContent = `${icon} ${statusState.batteryLevel}%`;
      } else {
        batEl.textContent = '本设备暂不支持';
      }
    }

    const storageEl = $('#stStorage');
    if (storageEl) {
      if (statusState.storage) {
        const used = statusState.storage.usage;
        const total = statusState.storage.quota;
        storageEl.textContent = total ? `${formatBytes(used)} / ${formatBytes(total)}` : formatBytes(used);
      } else {
        storageEl.textContent = '本设备暂不支持';
      }
    }

    const partnerEl = $('#stPartnerDevice');
    if (partnerEl) {
      const user = Store.getState().user;
      const otherLoc = Store.getState().locations.find(l => l.userId !== (user && user.id));
      const parse = (value) => {
        if (!value) return null;
        try { return typeof value === 'string' ? JSON.parse(value) : value; } catch(e) { return null; }
      };
      const b = parse(otherLoc && otherLoc.battery);
      const d = parse(otherLoc && otherLoc.device);
      if (b || d) {
        const bat = b ? `${b.charging ? '充电中' : '电量'} ${b.level}%` : '电量待同步';
        const net = d && d.network ? (d.network.effectiveType || '在线') : (d && d.online ? '在线' : '网络待同步');
        partnerEl.textContent = `${d && d.label ? d.label + ' · ' : ''}${bat} · ${net}`;
      } else {
        partnerEl.textContent = '等待 ta 开启 App 后同步';
      }
    }

    const trafficEl = $('#stTraffic');
    if (trafficEl) trafficEl.textContent = '需原生插件授权';

    const callsEl = $('#stCalls');
    if (callsEl) callsEl.textContent = '系统限制，暂不读取';
  }

  /* ========== EVENT BINDINGS ========== */
  function bindWish() {
    const form = $('#wishForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = $('#wishText').value.trim();
      if (!text) return;
      const room = Store.getState().room;
      if (!room) { toast('请先配对', 'error'); return; }
      try {
        const data = await API.post(`/api/room/${room.id}/wishes`, { text });
        Store.setState({ wishes: [...Store.getState().wishes, data.wish] });
        $('#wishText').value = '';
        renderWish();
        toast('心愿已添加 ✦');
      } catch (e) { toast('添加失败', 'error'); }
    });
  }

  function bindMeta() {
    const form = $('#annivForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#annivName').value.trim();
      const date = $('#annivDate').value;
      if (!name || !date) return;
      const room = Store.getState().room;
      if (!room) { toast('请先配对', 'error'); return; }
      try {
        const data = await API.post(`/api/room/${room.id}/anniversaries`, { name, date });
        Store.setState({ anniversaries: [...Store.getState().anniversaries, data.anniversary] });
        $('#annivName').value = '';
        $('#annivDate').value = '';
        renderMeta();
        renderHome();
        toast('纪念日已添加');
      } catch (e) { toast('添加失败', 'error'); }
    });
  }

  function bindMood() {
    const picker = $('#moodPicker');
    if (!picker) return;
    picker.addEventListener('click', async (e) => {
      const level = Number(e.target.dataset.mood);
      if (!level) return;
      const room = Store.getState().room;
      if (!room) { toast('请先配对', 'error'); return; }
      try {
        const data = await API.post(`/api/room/${room.id}/moods`, { level, date: Utils.todayStr(), note: '' });
        const moods = Store.getState().moods;
        const idx = moods.findIndex(m => m.date === Utils.todayStr() && m.userId === Store.getState().user.id);
        if (idx >= 0) moods[idx] = data.mood;
        else moods.push(data.mood);
        Store.setState({ moods: [...moods] });
        renderMood();
      } catch (e) { toast('打卡失败', 'error'); }
    });

    const noteForm = $('#moodNoteForm');
    if (!noteForm) return;
    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = $('#moodNoteText').value.trim();
      const room = Store.getState().room;
      if (!room) { toast('请先配对', 'error'); return; }
      const today = Utils.todayStr();
      const existing = Store.getState().moods.find(m => m.date === today && m.userId === (Store.getState().user && Store.getState().user.id));
      try {
        const data = await API.post(`/api/room/${room.id}/moods`, { level: (existing && existing.level) || 3, date: today, note });
        const moods = Store.getState().moods;
        const idx = moods.findIndex(m => m.date === today && m.userId === (Store.getState().user && Store.getState().user.id));
        if (idx >= 0) moods[idx] = data.mood;
        else moods.push(data.mood);
        Store.setState({ moods: [...moods] });
        $('#moodNoteText').value = '';
        renderMood();
        toast('笔记已保存');
      } catch (e) { toast('保存失败', 'error'); }
    });
  }

  function bindMoments() {
    const createBtn = $('#momentCreateBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const room = Store.getState().room;
        if (!room) { toast('请先配对', 'error'); return; }
        showMomentModal();
      });
    }

    const modal = $('#momentModal');
    if (!modal) return;

    $('#mmClose').addEventListener('click', () => { modal.style.display = 'none'; });
    $('#mmCancel').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.querySelector('.moment-modal-backdrop').addEventListener('click', () => { modal.style.display = 'none'; });

    $('#mmImageArea').addEventListener('click', () => { $('#mmImageInput').click(); });

    let selectedFile = null;
    $('#mmImageInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (ev) => {
        $('#mmImagePreview').src = ev.target.result;
        $('#mmImagePreview').style.display = '';
        $('#mmImagePlaceholder').style.display = 'none';
      };
      reader.readAsDataURL(file);
    });

    $('#mmSubmit').addEventListener('click', async () => {
      if (!selectedFile) { $('#mmErr').textContent = '请选择一张照片'; return; }
      const text = $('#mmText').value.trim();
      const btn = $('#mmSubmit');
      btn.disabled = true;
      btn.textContent = '发布中...';
      $('#mmErr').textContent = '';

      try {
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('text', text);
        formData.append('location', $('#mmLocText').textContent === '正在获取位置...' ? '' : $('#mmLocText').textContent);
        formData.append('city', '');
        formData.append('lat', '');
        formData.append('lng', '');

        const room = Store.getState().room;
        const data = await API.upload(`/api/room/${room.id}/moments`, formData);
        Store.setState({ moments: [data.moment, ...Store.getState().moments] });
        renderMoments();
        modal.style.display = 'none';
        toast('瞬间已记录 ✦');
      } catch (e) {
        $('#mmErr').textContent = e.message || '发布失败';
      } finally {
        btn.disabled = false;
        btn.textContent = '发布';
      }
    });
  }

  function showMomentModal() {
    const modal = $('#momentModal');
    if (!modal) return;
    modal.style.display = '';

    $('#mmImageInput').value = '';
    $('#mmImagePreview').style.display = 'none';
    $('#mmImagePlaceholder').style.display = '';
    $('#mmText').value = '';
    $('#mmErr').textContent = '';
    $('#mmSubmit').disabled = false;
    $('#mmSubmit').textContent = '发布';

    if (navigator.geolocation) {
      $('#mmLocText').textContent = '正在获取位置...';
      navigator.geolocation.getCurrentPosition(
        (pos) => { $('#mmLocText').textContent = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`; },
        () => { $('#mmLocText').textContent = '无法获取位置'; },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    } else {
      $('#mmLocText').textContent = '设备不支持定位';
    }
  }

  function bindSettings() {
    const sMeName = $('#sMeName');
    if (sMeName) {
      const saveNickname = async () => {
        const nickname = sMeName.value.trim();
        if (!nickname || nickname.length < 2 || nickname.length > 20) {
          $('#sNameErr').textContent = '昵称需在 2-20 个字符之间';
          return;
        }
        $('#sNameErr').textContent = '';
        try {
          const data = await API.patch('/api/profile', { nickname });
          Store.saveUser({ ...Store.getState().user, ...data.user });
          toast('昵称已保存');
          renderHome();
        } catch (e) { toast('保存失败', 'error'); }
      };
      sMeName.addEventListener('change', saveNickname);
      sMeName.addEventListener('blur', saveNickname);
    }

    const profileCenterBtn = $('#profileCenterBtn');
    if (profileCenterBtn) {
      profileCenterBtn.addEventListener('click', () => {
        const user = Store.getState().user;
        if (!user) return;
        const genderText = { boy: '男', girl: '女' }[user.gender] || user.gender || '未设置';
        const anniversary = user.anniversary ? Utils.fmtDate(new Date(user.anniversary)) : '未设置';
        const phone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '—';
        showProfileModal({
          title: '个人资料',
          rows: [
            { label: '昵称', value: user.nickname || '—' },
            { label: '性别', value: genderText },
            { label: '在一起', value: anniversary },
            { label: '手机号', value: phone }
          ]
        });
      });
    }

    const unpairBtn = $('#unpairBtn');
    if (unpairBtn) {
      unpairBtn.addEventListener('click', async () => {
        const ok = await confirmDialog('确定解除配对？共享数据将被清除。');
        if (!ok) return;
        try {
          await API.post('/api/pair/unpair');
          Socket.leaveRoom(Store.getState().room && Store.getState().room.id);
          Store.setState({ room: null, wishes: [], anniversaries: [], moods: [], locations: [], settings: {} });
          renderAll();
          toast('已解除配对');
          setTimeout(() => { clearFlowViews(); showPair(); }, 800);
        } catch (e) { toast('解除失败', 'error'); }
      });
    }

    const logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const ok = await confirmDialog('确定退出登录？');
        if (!ok) return;
        API.clearTokens();
        Store.clearUser();
        Socket.disconnect();
        Store.setState({ room: null, wishes: [], anniversaries: [], moods: [], moments: [], locations: [], settings: { meName: '', taName: '', sinceDate: '', nextMeetDate: '' } });
        localStorage.removeItem('goodnight_permissions_done');
        localStorage.removeItem('wanan_permissions_done');
        location.reload();
      });
    }
  }

  function showProfileModal({ title, rows }) {
    const overlay = document.createElement('div');
    overlay.className = 'profile-modal';
    overlay.innerHTML = `
      <div class="profile-modal-backdrop"></div>
      <div class="profile-modal-card">
        <div class="profile-modal-header"><h3>${title}</h3><button class="profile-modal-close">×</button></div>
        <div class="profile-modal-body">
          ${rows.map(r => `<div class="profile-modal-row"><span>${r.label}</span><span>${r.value}</span></div>`).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.profile-modal-backdrop').onclick = close;
    overlay.querySelector('.profile-modal-close').onclick = close;
  }

  /* ========== BATTERY MONITOR (sync to server) ========== */
  function startBatteryMonitor() {
    const pushDeviceOnly = () => syncPresence();
    pushDeviceOnly();
    window.addEventListener('online', pushDeviceOnly);
    window.addEventListener('offline', pushDeviceOnly);
    if (!navigator.getBattery) return;
    navigator.getBattery().then(b => {
      const updateBat = () => {
        syncPresence({
          battery: { level: Math.round(b.level * 100), charging: b.charging, updatedAt: Date.now() }
        });
      };
      updateBat();
      ['chargingchange', 'levelchange'].forEach(evt => b.addEventListener(evt, updateBat));
      setInterval(updateBat, 5 * 60 * 1000);
    }).catch(() => {});
  }

  /* ========== WEBSOCKET SETUP ========== */
  function setupSocket() {
    const token = API.getToken();
    if (!token) return;

    Socket.connect(token);
    const room = Store.getState().room;
    if (room) Socket.joinRoom(room.id);

    Socket.on('wish:new', (data) => {
      if (!Store.getState().wishes.find(w => w.id === data.wish.id)) {
        Store.setState({ wishes: [...Store.getState().wishes, data.wish] });
        renderWish();
      }
    });
    Socket.on('wish:update', (data) => {
      Store.setState({ wishes: Store.getState().wishes.map(w => w.id === data.wish.id ? data.wish : w) });
      renderWish();
    });
    Socket.on('wish:delete', (data) => {
      Store.setState({ wishes: Store.getState().wishes.filter(w => w.id !== data.wishId) });
      renderWish();
    });
    Socket.on('anniv:new', (data) => {
      if (!Store.getState().anniversaries.find(a => a.id === data.anniversary.id)) {
        Store.setState({ anniversaries: [...Store.getState().anniversaries, data.anniversary] });
        renderMeta();
        renderHome();
      }
    });
    Socket.on('anniv:delete', (data) => {
      Store.setState({ anniversaries: Store.getState().anniversaries.filter(a => a.id !== data.annivId) });
      renderMeta();
      renderHome();
    });
    Socket.on('mood:update', (data) => {
      const moods = Store.getState().moods;
      const idx = moods.findIndex(m => m.date === data.mood.date && m.userId === data.mood.userId);
      if (idx >= 0) moods[idx] = data.mood;
      else moods.push(data.mood);
      Store.setState({ moods: [...moods] });
      renderMood();
      renderMeta();
      toast('对方更新了心情');
    });
    Socket.on('settings:update', (data) => {
      Store.setState({ settings: data.settings });
      renderHome();
      renderSettings();
      toast('对方更新了设置');
    });
    Socket.on('location:update', (data) => {
      const locations = Store.getState().locations;
      const idx = locations.findIndex(l => l.userId === data.location.userId);
      if (idx >= 0) locations[idx] = data.location;
      else locations.push(data.location);
      Store.setState({ locations: [...locations] });
      renderMeta();
    });
    Socket.on('moment:new', (data) => {
      if (!Store.getState().moments.find(m => m.id === data.moment.id)) {
        Store.setState({ moments: [data.moment, ...Store.getState().moments] });
        renderMoments();
        toast('对方记录了一个新瞬间 ✦');
      }
    });
    Socket.on('moment:delete', (data) => {
      Store.setState({ moments: Store.getState().moments.filter(m => m.id !== data.momentId) });
      renderMoments();
    });
  }

  /* ========== MAIN APP ENTRY ========== */
  function enterMainApp() {
    clearFlowViews();
    showMainApp();
    bindNav();
    bindWish();
    bindMeta();
    bindMood();
    bindMoments();
    bindSettings();
    renderAll();
    startBatteryMonitor();
    startLocationTracking();
    startStatusUpdates();
    setupSocket();
    setInterval(() => renderHome(), 60 * 1000);
  }

  async function doInit() {
    handleAuthCallback();

    const token = API.getToken();
    Store.loadUser();

    if (!token) {
      showBrand(() => showLogin());
      return;
    }

    let meData;
    try {
      meData = await API.get('/api/auth/me');
      if (meData.user) Store.saveUser(meData.user);
    } catch (e) {
      // token invalid, go to login
      API.clearTokens();
      Store.clearUser();
      showBrand(() => showLogin());
      return;
    }

    const user = meData.user;

    if (!user.hasProfile) {
      showProfile();
      return;
    }

    if (!user.room) {
      showPair();
      return;
    }

    Store.setState({ room: user.room });
    await loadRoomData();

    const permissionsDone = localStorage.getItem('goodnight_permissions_done') || localStorage.getItem('wanan_permissions_done');
    if (!permissionsDone) {
      showPermissions();
      return;
    }

    enterMainApp();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doInit);
  else doInit();
})();
