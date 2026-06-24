/* =========================================================
   goodnight api.js
   统一 API 模块，封装 fetch 请求、Token 管理和自动刷新
   ========================================================= */
const API = {
  // 获取服务器地址：全局配置 → 浏览器同源 → 默认公网后端
  BASE: null,

  _initBase() {
    if (this._baseInited) return;
    this._baseInited = true;

    // 1. 全局配置（config.js / 打包时注入）
    const cfg = (typeof window !== 'undefined' && (window.__GOODNIGHT_CONFIG__ || window.__WANAN_CONFIG__)) || null;
    if (cfg && cfg.API_BASE && !cfg.API_BASE.startsWith('__API_BASE')) {
      this.BASE = cfg.API_BASE;
      return;
    }

    // 2. 浏览器同源（PC 端测试时自动走当前地址）
    if (typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.startsWith('file://')) {
      this.BASE = window.location.origin;
      return;
    }

    // 3. 用户端固定默认公网后端
    this.BASE = 'https://wanan-8kqw.onrender.com';
  },

  _ensureBase() {
    this._initBase();
    if (!this.BASE) throw new Error('服务器地址不可用');
  },

  setServer(url) {
    this.BASE = url;
    localStorage.setItem('goodnight_server', url);
    localStorage.setItem('wanan_server', url);
  },

  getToken() {
    return localStorage.getItem('goodnight_token') || localStorage.getItem('wanan_token');
  },

  getRefreshToken() {
    return localStorage.getItem('goodnight_refresh_token') || localStorage.getItem('wanan_refresh_token');
  },

  setTokens(accessToken, refreshToken) {
    localStorage.setItem('goodnight_token', accessToken);
    localStorage.setItem('goodnight_refresh_token', refreshToken);
    localStorage.setItem('wanan_token', accessToken);
    localStorage.setItem('wanan_refresh_token', refreshToken);
  },

  clearTokens() {
    localStorage.removeItem('goodnight_token');
    localStorage.removeItem('goodnight_refresh_token');
    localStorage.removeItem('goodnight_user');
    localStorage.removeItem('wanan_token');
    localStorage.removeItem('wanan_refresh_token');
    localStorage.removeItem('wanan_user');
  },

  async _req(url, opts, skipContentType) {
    this._ensureBase();
    const headers = {};
    if (!skipContentType) headers['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fullUrl = this.BASE + url;
    const fetchOpts = { ...opts, headers };

    let res = await fetch(fullUrl, fetchOpts);

    // 401 自动刷新 Token
    if (res.status === 401) {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        const refreshRes = await fetch(this.BASE + '/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          this.setTokens(data.accessToken, data.refreshToken);
          headers['Authorization'] = `Bearer ${data.accessToken}`;
          res = await fetch(fullUrl, { ...fetchOpts, headers });
        }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '网络错误' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  },

  request(method, url, body) {
    this._ensureBase();
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fullUrl = this.BASE + url;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    return this._req(url, opts, false);
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  patch(url, body) { return this.request('PATCH', url, body); },
  delete(url) { return this.request('DELETE', url); },
  upload(path, formData) {
    return this._req(path, { method: 'POST', body: formData }, true);
  },
};
