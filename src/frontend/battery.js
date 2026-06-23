const BatteryMonitor = {
  start() {
    if (!navigator.getBattery) return;
    this.stop();
    navigator.getBattery().then(b => {
      const updateBat = () => {
        const room = Store.getState().room;
        if (!room) return;
        API.put(`/api/room/${room.id}/location`, {
          battery: { level: Math.round(b.level * 100), charging: b.charging, updatedAt: Date.now() }
        }).catch(() => {});
      };
      updateBat();
      ['chargingchange', 'levelchange'].forEach(evt => b.addEventListener(evt, updateBat));
      this._pollInterval = setInterval(updateBat, 30 * 1000);
    }).catch(() => {});
  },

  stop() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }
};