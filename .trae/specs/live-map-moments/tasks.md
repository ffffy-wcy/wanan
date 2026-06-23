# Tasks

- [x] Task 1: 数据库 & 后端：新增 Moment 模型和图片上传 API
  - [x] SubTask 1.1: 在 `prisma/schema.prisma` 中新增 Moment 模型（id, roomId, userId, imageUrl, text, location, city, lat, lng, createdAt）
  - [x] SubTask 1.2: 运行 `npx prisma db push` 同步数据库
  - [x] SubTask 1.3: 安装 Multer，创建 `src/routes/moments.js`（GET 列表, POST 创建含图片上传, DELETE 删除）
  - [x] SubTask 1.4: 在 `src/server.js` 中注册 `/api/room/:roomId/moments` 路由
  - [x] SubTask 1.5: 在 `src/frontend/socket.js` 中添加 `moment:new` 和 `moment:delete` 事件监听

- [x] Task 2: 前端：之间页面嵌入 Leaflet 实时小地图
  - [x] SubTask 2.1: 在 `index.html` 中引入 Leaflet CSS/JS CDN，在之间页面 distance-card 下方添加 `<div id="liveMap">` 容器
  - [x] SubTask 2.2: 在 `app.js` 中实现 `initMap()` 函数：初始化 Leaflet 地图、创建双方标记（圆形头像标记）、连线（虚线）、距离标签
  - [x] SubTask 2.3: 在 `renderMeta()` 中调用地图更新逻辑，根据双方位置数据更新标记和连线
  - [x] SubTask 2.4: 在 WebSocket `location:update` 回调中触发地图更新
  - [x] SubTask 2.5: 在 `styles.css` 中添加地图容器和标记样式（圆形头像、脉动动画、连线样式）

- [x] Task 3: 前端：相册"瞬"页面
  - [x] SubTask 3.1: 在 `index.html` 中添加"瞬"视图 section（view-moments）和底部 tab 按钮
  - [x] SubTask 3.2: 在 `app.js` 中实现 `renderMoments()` 函数：时间线列表渲染（照片缩略图、文字摘要、位置、时间），含空状态、加载态、错误态
  - [x] SubTask 3.3: 实现创建瞬间功能：上传按钮 → 文件选择 → 文字输入 → 自动获取当前位置 → 提交
  - [x] SubTask 3.4: 实现瞬间详情查看：点击放大图片、完整文字和位置
  - [x] SubTask 3.5: 实现删除瞬间：长按或点击删除按钮，确认后删除
  - [x] SubTask 3.6: 在 `bindNav()` 中注册"瞬" tab 切换逻辑
  - [x] SubTask 3.7: 在 `loadRoomData()` 中加载 moments 数据
  - [x] SubTask 3.8: 在 `styles.css` 中添加"瞬"页面样式（时间线、照片卡片、上传按钮）

- [x] Task 4: WebSocket 实时同步"瞬"
  - [x] SubTask 4.1: 后端 POST/DELETE moments 时通过 Socket.IO 广播 `moment:new` / `moment:delete` 事件
  - [x] SubTask 4.2: 前端 `socket.js` 监听 `moment:new` / `moment:delete` 事件，更新 Store 并重新渲染

- [x] Task 5: 视觉精调 & 响应式适配
  - [x] SubTask 5.1: 地图标记使用用户昵称首字圆形头像，带柔和阴影
  - [x] SubTask 5.2: "瞬"页面时间线使用左右交替布局（自己发的在右边，对方发的在左边）
  - [x] SubTask 5.3: 确保所有新增 UI 在移动端 320px-428px 宽度下显示正常
  - [x] SubTask 5.4: 暗色模式适配

- [x] Task 6: 端到端验证
  - [x] SubTask 6.1: 服务器启动正常，健康检查通过
  - [x] SubTask 6.2: 前端页面完整加载，包含地图容器和"瞬"视图
  - [x] SubTask 6.3: uploads 目录已创建，Multer 已安装

# Task Dependencies
- [Task 2] 依赖 [Task 1] 完成（需要后端 API 就绪以测试地图数据流）
- [Task 3] 依赖 [Task 1] 完成（需要后端 moments API 就绪）
- [Task 4] 依赖 [Task 1] 完成
- [Task 5] 依赖 [Task 2, Task 3] 完成
- [Task 6] 依赖 [Task 1-5] 全部完成

# Parallelizable
- [Task 2] 和 [Task 3] 可并行开发（不同的前端页面，互不依赖）
- [Task 4] 可和 [Task 2, Task 3] 并行开发