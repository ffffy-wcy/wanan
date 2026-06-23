/* =========================================================
   晚安 store.js
   简单前端状态管理模块
   ========================================================= */
const Store = {
  state: {
    user: null,
    room: null,
    settings: { meName: '', taName: '', sinceDate: '', nextMeetDate: '' },
    wishes: [],
    anniversaries: [],
    moods: [],
    moments: [],
    locations: [],
    loading: false,
    error: null,
  },

  listeners: [],

  getState() { return this.state; },

  setState(partial) {
    Object.assign(this.state, partial);
    this.listeners.forEach(fn => fn(this.state));
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(f => f !== fn); };
  },

  loadUser() {
    try {
      const raw = localStorage.getItem('wanan_user');
      if (raw) this.state.user = JSON.parse(raw);
    } catch(e) {}
  },

  saveUser(user) {
    this.state.user = user;
    localStorage.setItem('wanan_user', JSON.stringify(user));
  },

  clearUser() {
    this.state.user = null;
    localStorage.removeItem('wanan_user');
  }
};
