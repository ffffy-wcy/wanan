/* =========================================================
   goodnight utils.js
   通用工具函数模块
   ========================================================= */
const Utils = {
  daysBetween(start, end) {
    if (!start || !end) return 0;
    const s = new Date(start); const e = new Date(end);
    if (isNaN(s) || isNaN(e)) return 0;
    const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const ed = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    return Math.max(0, Math.round((ed - sd) / 86400000));
  },

  breakdownDays(d) {
    return { months: Math.floor(d / 30), weeks: Math.floor(d / 7), hours: d * 24 };
  },

  nextAnniversary(dateStr, today) {
    if (!dateStr) return null;
    const base = new Date(dateStr);
    if (isNaN(base)) return null;
    const t = today || new Date();
    const year = t.getFullYear();
    let next = new Date(year, base.getMonth(), base.getDate());
    const today0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    if (next < today0) next = new Date(year + 1, base.getMonth(), base.getDate());
    return { nextDate: next, daysLeft: Math.max(0, Math.round((next - today0) / 86400000)), year: next.getFullYear() };
  },

  distanceKm(lat1, lng1, lat2, lng2) {
    const nums = [lat1, lng1, lat2, lng2].map(Number);
    if (nums.some(isNaN)) return null;
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  },

  fmtDate(date) {
    const d = new Date(date);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  todayStr() {
    return Utils.fmtDate(new Date());
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  pickNextAnniv(annivs, today) {
    if (!annivs || !annivs.length) return null;
    const computed = annivs.map((a) => ({ ...a, next: Utils.nextAnniversary(a.date, today) })).filter((x) => x.next);
    if (!computed.length) return null;
    computed.sort((a, b) => a.next.daysLeft - b.next.daysLeft);
    return computed[0];
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  fmtRelative(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    return Utils.fmtDate(d);
  }
};
