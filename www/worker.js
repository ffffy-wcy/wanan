// 晚安 · Cloudflare Workers 版
// 数据存储在 KV（键值存储），结构：room:<roomcode> => JSON
//
// 使用说明：
// 1. 在 Cloudflare 控制台创建一个 KV 命名空间，名字：WANAN_STORAGE
// 2. 在 Worker 的 Variables → KV Namespace Bindings 绑定：
//    变量名：WANAN_STORAGE  →  选择你创建的命名空间
// 3. 把此文件粘贴到 Worker 编辑器
// 4. 部署后，App 的「服务器地址」填 https://<你的worker>.workers.dev

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 健康检查
    if (path === '/api/health' && method === 'GET') {
      return json({ ok: true, t: Date.now() });
    }

    // ========== 房间数据（整体 CRUD） ==========
    // GET    /api/data/:room    读取房间
    // PUT    /api/data/:room    覆盖写入
    // PATCH  /api/data/:room    增量更新

    const roomMatch = path.match(/^\/api\/data\/([^/]+)$/);
    if (roomMatch) {
      const room = decodeURIComponent(roomMatch[1]);
      if (!validRoom(room)) return json({ error: 'bad room' }, 400);
      const key = `room:${room}`;
      const data = await env.WANAN_STORAGE.get(key, 'json');

      if (method === 'GET') {
        if (!data) return json({ error: 'not found' }, 404);
        return json(data);
      }

      if (method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        const merged = { ...defaultData(), ...body, updatedAt: Date.now() };
        await env.WANAN_STORAGE.put(key, JSON.stringify(merged));
        return json({ ok: true, updatedAt: merged.updatedAt });
      }

      if (method === 'PATCH') {
        const body = await request.json().catch(() => ({}));
        const current = data || defaultData();
        Object.keys(body).forEach((k) => { current[k] = body[k]; });
        current.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(current));
        return json({ ok: true, updatedAt: current.updatedAt });
      }

      if (method === 'DELETE') {
        await env.WANAN_STORAGE.delete(key);
        return json({ ok: true });
      }

      return json({ error: 'method not allowed' }, 405);
    }

    // ========== 时光墙 ==========
    // POST   /api/wall/:room    新增一条
    // DELETE /api/wall/:room/:id

    const wallMatch = path.match(/^\/api\/wall\/([^/]+)(?:\/(.+))?$/);
    if (wallMatch) {
      const room = decodeURIComponent(wallMatch[1]);
      if (!validRoom(room)) return json({ error: 'bad room' }, 400);
      const key = `room:${room}`;
      const data = (await env.WANAN_STORAGE.get(key, 'json')) || defaultData();
      data.wall = data.wall || [];

      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const entry = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          who: String(body.who || 'me'),
          text: String(body.text || '').slice(0, 500),
          date: String(body.date || new Date().toISOString().slice(0, 10)),
          createdAt: Date.now(),
        };
        data.wall.unshift(entry);
        data.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(data));
        return json({ ok: true, entry });
      }

      if (method === 'DELETE' && wallMatch[2]) {
        const id = wallMatch[2];
        data.wall = data.wall.filter((x) => x.id !== id);
        data.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(data));
        return json({ ok: true });
      }

      return json({ error: 'method not allowed' }, 405);
    }

    // ========== 心愿清单 ==========
    // POST   /api/wishes/:room
    // PATCH  /api/wishes/:room/:id   （标记完成 / 编辑）
    // DELETE /api/wishes/:room/:id

    const wishMatch = path.match(/^\/api\/wishes\/([^/]+)(?:\/(.+))?$/);
    if (wishMatch) {
      const room = decodeURIComponent(wishMatch[1]);
      if (!validRoom(room)) return json({ error: 'bad room' }, 400);
      const key = `room:${room}`;
      const data = (await env.WANAN_STORAGE.get(key, 'json')) || defaultData();
      data.wishes = data.wishes || [];

      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const wish = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          text: String(body.text || '').slice(0, 200),
          done: !!body.done,
          createdAt: Date.now(),
        };
        data.wishes.push(wish);
        data.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(data));
        return json({ ok: true, wish });
      }

      if (method === 'PATCH' && wishMatch[2]) {
        const id = wishMatch[2];
        const body = await request.json().catch(() => ({}));
        const wish = data.wishes.find((x) => x.id === id);
        if (!wish) return json({ error: 'not found' }, 404);
        if (typeof body.done === 'boolean') wish.done = body.done;
        if (typeof body.text === 'string') wish.text = body.text.slice(0, 200);
        data.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(data));
        return json({ ok: true, wish });
      }

      if (method === 'DELETE' && wishMatch[2]) {
        const id = wishMatch[2];
        data.wishes = data.wishes.filter((x) => x.id !== id);
        data.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(data));
        return json({ ok: true });
      }

      return json({ error: 'method not allowed' }, 405);
    }

    // ========== 纪念日 ==========
    // POST   /api/anniv/:room
    // DELETE /api/anniv/:room/:id

    const annivMatch = path.match(/^\/api\/anniv\/([^/]+)(?:\/(.+))?$/);
    if (annivMatch) {
      const room = decodeURIComponent(annivMatch[1]);
      if (!validRoom(room)) return json({ error: 'bad room' }, 400);
      const key = `room:${room}`;
      const data = (await env.WANAN_STORAGE.get(key, 'json')) || defaultData();
      data.anniversaries = data.anniversaries || [];

      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const anniv = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: String(body.name || '纪念日').slice(0, 40),
          date: String(body.date || new Date().toISOString().slice(0, 10)),
          createdAt: Date.now(),
        };
        data.anniversaries.push(anniv);
        data.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(data));
        return json({ ok: true, anniv });
      }

      if (method === 'DELETE' && annivMatch[2]) {
        const id = annivMatch[2];
        data.anniversaries = data.anniversaries.filter((x) => x.id !== id);
        data.updatedAt = Date.now();
        await env.WANAN_STORAGE.put(key, JSON.stringify(data));
        return json({ ok: true });
      }

      return json({ error: 'method not allowed' }, 405);
    }

    // ========== 心情打卡 ==========
    // POST   /api/mood/:room

    const moodMatch = path.match(/^\/api\/mood\/([^/]+)$/);
    if (moodMatch && method === 'POST') {
      const room = decodeURIComponent(moodMatch[1]);
      if (!validRoom(room)) return json({ error: 'bad room' }, 400);
      const key = `room:${room}`;
      const data = (await env.WANAN_STORAGE.get(key, 'json')) || defaultData();
      data.moods = data.moods || [];
      const body = await request.json().catch(() => ({}));
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        level: Number(body.level) || 3,
        date: String(body.date || new Date().toISOString().slice(0, 10)),
        note: String(body.note || '').slice(0, 200),
        createdAt: Date.now(),
      };
      const idx = data.moods.findIndex((m) => m.date === entry.date);
      if (idx >= 0) data.moods[idx] = entry;
      else data.moods.unshift(entry);
      data.moods = data.moods.slice(0, 90);
      data.updatedAt = Date.now();
      await env.WANAN_STORAGE.put(key, JSON.stringify(data));
      return json({ ok: true, entry });
    }

    // 首页（测试用）
    if (path === '/' || path === '') {
      return new Response(
        `<!doctype html><title>晚安 · 同步服务</title>
         <h1>晚安 · 数据同步服务已上线</h1>
         <p>API 健康检查：<a href="/api/health">/api/health</a></p>
         <p>房间示例：GET/PUT/PATCH <code>/api/data/test-room</code></p>`,
        { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
      );
    }

    return json({ error: 'not found' }, 404);
  },
};

// ========== 工具函数 ==========

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function validRoom(room) {
  return typeof room === 'string' && room.length >= 2 && room.length <= 80;
}

function defaultData() {
  return {
    meName: 'LH',
    taName: 'WCY',
    sinceDate: '2026-04-25',
    nextMeetDate: '',
    meLat: '',
    meLng: '',
    taLat: '',
    taLng: '',
    wall: [],
    wishes: [],
    anniversaries: [],
    moods: [],
    updatedAt: Date.now(),
  };
}
