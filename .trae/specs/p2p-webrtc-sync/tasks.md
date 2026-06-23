# Tasks

## Phase 1: 本地存储与身份认证

- [x] Task 1: 实现 IndexedDB 本地数据库
  - [x] 创建 `src/frontend/localdb.js`：封装 IndexedDB 操作（CRUD、事务、版本管理）
  - [x] 定义 Object Stores：wallEntries、wishes、anniversaries、moods、locations、moments、settings、syncMeta
  - [x] 实现 `localDB.getAll(store)`、`localDB.put(store, data)`、`localDB.delete(store, id)`、`localDB.clear(store)`
  - [x] 实现 `localDB.exportAll()` 和 `localDB.importAll(data)` 方法
  - [x] 实现数据迁移：首次启动时如果 localStorage 有旧数据，自动迁移到 IndexedDB
  - **验证**: 打开浏览器 DevTools → Application → IndexedDB，确认数据库和表结构正确创建

- [x] Task 2: 实现简易本地身份认证
  - [x] 创建 `localAuth` 模块：`createIdentity(nickname, pin)`、`verifyPin(pin)`、`isLoggedIn()`、`getIdentity()`
  - [x] 修改 `index.html` 登录页：添加「本地模式」登录入口（昵称 + 4 位 PIN 码）
  - [x] 实现首次使用的身份创建流程（输入昵称 → 设置 PIN → 确认 PIN）
  - [x] 实现 PIN 码登录流程（输入 PIN → 验证 → 进入主界面）
  - [x] 在 `app.js` 的初始化流程中集成 `localAuth`：先检查本地身份，无则显示登录页
  - **验证**: 清除 localStorage 后刷新页面，确认显示本地登录界面，创建身份后能正常登录

## Phase 2: P2P WebRTC 核心

- [x] Task 3: 实现 WebRTC 连接管理模块
  - [x] 创建 `src/frontend/webrtc.js`：封装 RTCPeerConnection 生命周期
  - [x] 配置 STUN 服务器列表（使用 Google 免费 STUN: `stun:stun.l.google.com:19302` 等）
  - [x] 实现 `createOffer()`：创建 Offer → 设置本地描述 → 返回 SDP 字符串
  - [x] 实现 `handleOffer(sdp)`：设置远程描述 → 创建 Answer → 返回 Answer SDP 字符串
  - [x] 实现 `handleAnswer(sdp)`：设置远程 Answer → 完成连接
  - [x] 实现 Data Channel 创建和消息收发：`send(msg)`、`onMessage(callback)`
  - [x] 实现连接状态监听：`onConnect(callback)`、`onDisconnect(callback)`
  - [x] 实现 ICE candidate 收集和交换
  - **验证**: 两个浏览器 Tab 之间手动交换 SDP，确认 Data Channel 可收发消息

- [x] Task 4: 实现二维码配对机制
  - [x] 引入 qrcode 库（CDN 或 npm）：`qrcode-generator` 或 `qrcodejs`
  - [x] 创建 `src/frontend/pairing.js`：配对流程管理
  - [x] 实现「生成配对二维码」：创建 Offer → 将 SDP 编码为 Base64 → 生成 QR 码 → 显示在页面上
  - [x] 实现「扫描配对二维码」：使用 `getUserMedia` 获取摄像头 → 使用 jsQR 库解析 QR 码 → 提取 SDP → 调用 handleOffer
  - [x] 实现 Answer 回传：生成 Answer 后同样编码为 QR 码，显示给对方扫描（双向扫码）
  - [x] 实现配对状态持久化：配对成功后保存 peer identity 到 localStorage
  - [x] 实现自动重连：页面加载时检查是否有已配对的 peer identity，尝试自动重连
  - **验证**: 两个设备（手机 + 电脑或两个手机）通过扫码完成配对，确认连接建立

## Phase 3: 数据同步协议

- [x] Task 5: 实现 P2P 数据同步协议
  - [x] 定义同步消息格式：`{ type, store, action, payload, timestamp, syncId }`
  - [x] 实现 `syncOutgoing(change)`：本地数据变更后，通过 Data Channel 发送给对端
  - [x] 实现 `syncIncoming(msg)`：收到对端数据变更后，写入本地 IndexedDB 并触发 UI 更新
  - [x] 实现全量同步 `syncFull()`：首次配对后，双方交换全部数据
  - [x] 实现增量同步：基于 `syncMeta` 中的 `lastSyncAt` 时间戳，只同步变更数据
  - [x] 实现冲突检测：检查 `updatedAt`，保留最新版本，冲突数据存入 `_conflicts`
  - [x] 实现离线队列：发送失败时暂存到 `pendingSync` 队列，连接恢复后重发
  - **验证**: 配对后一方添加数据，确认另一方自动同步

- [x] Task 6: 集成数据同步到现有功能模块
  - [x] 修改 `src/frontend/store.js`：写操作同时写入 IndexedDB 并触发 `syncOutgoing`
  - [x] 修改 `src/frontend/store.js`：读操作优先从 IndexedDB 读取
  - [x] 修改 `app.js`：初始化时根据 `syncMode` 决定使用 P2P 还是 Server 模式
  - [x] 注册 `syncIncoming` 处理器：收到数据变更后更新 UI（时光墙、心愿、纪念日、心情、位置等）
  - [x] 适配各页面渲染逻辑：确保数据源统一为 IndexedDB
  - **验证**: 在 P2P 模式下走通所有功能流程（添加留言、打卡心情、添加心愿等）

## Phase 4: UI 与体验

- [x] Task 7: 实现同步模式选择与切换 UI
  - [x] 在设置页添加「同步模式」选项，显示当前模式和连接状态
  - [x] 实现模式切换流程：确认对话框 → 断开当前连接 → 初始化新模式
  - [x] 添加 P2P 连接状态指示器（已连接/连接中/未连接/重连中）
  - [x] 手动重连按钮
  - **验证**: 切换模式后确认功能正常

- [x] Task 8: 跨设备兼容性测试与打磨
  - [x] 处理权限请求：摄像头权限、通知权限的用户引导
  - [x] 添加 NAT 穿透失败的友好提示
  - [x] 添加数据导出/导入功能（JSON 文件），作为极端情况的兜底方案
  - **验证**: 完成所有代码层面的兼容性处理

# Task Dependencies

- Task 2 依赖 Task 1（本地登录需要本地数据库）
- Task 3 可独立进行（WebRTC 连接测试不依赖本地存储）
- Task 4 依赖 Task 3（二维码配对需要 WebRTC 连接）
- Task 5 依赖 Task 1, Task 3（数据同步需要本地数据库 + WebRTC 通道）
- Task 6 依赖 Task 5（集成到现有功能需要同步协议就绪）
- Task 7 依赖 Task 2, Task 4, Task 6（UI 需要所有核心功能就绪）
- Task 8 依赖 Task 7（真机测试需要完整 UI）