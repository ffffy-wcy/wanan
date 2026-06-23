# Tasks

## Phase 1: 删除时光墙

- [x] Task 1: 删除时光墙后端
  - [x] 删除 `src/routes/wall.js` 文件
  - [x] 从 `src/server.js` 移除 wall 路由挂载
  - [x] 从 `src/sync.js` 移除 wall 相关 WebSocket 事件
  - **验证**: 启动服务器确认无报错 ✅

- [x] Task 2: 删除时光墙前端
  - [x] 从 `index.html` 移除时光墙 Tab 和页面内容
  - [x] 从 `app.js` 移除 wall 相关渲染和绑定逻辑
  - [x] 从 `styles.css` 移除 wall 相关样式
  - [x] 更新 TabBar 导航（去掉时光墙标签）
  - **验证**: 打开浏览器确认时光墙不再出现 ✅

- [x] Task 3: 删除时光墙数据模型
  - [x] 从 `prisma/schema.prisma` 移除 WallEntry 模型
  - [x] 移除 Room 模型中的 wallEntries 关系
  - [x] 运行迁移更新数据库
  - **验证**: `npx prisma studio` 确认 WallEntry 表已删除 ✅

## Phase 2: 引导流程重构

- [x] Task 4: 重构引导流程顺序
  - [x] 品牌页 → 登录页 → 完善个人信息 → 配对页 → 进入主界面
  - [x] 个人信息增加生日日期字段
  - [x] 登录成功后的跳转逻辑改为先进入个人信息页
  - [x] 个人信息完成后跳转配对页
  - [x] 已登录无配对用户直接进入个人信息/配对页
  - **验证**: 清除 token 后完整走通引导流程 ✅

- [x] Task 5: User 模型增加生日字段
  - [x] 在 `prisma/schema.prisma` 的 User 模型添加 `birthday String?` 字段
  - [x] 运行迁移
  - [x] 更新 `/api/auth/profile` 端点支持 birthday
  - **验证**: API 测试 profile 更新生日 ✅

## Phase 3: 电量精准读取

- [x] Task 6: 改进电量监控
  - [x] 修改 `src/frontend/battery.js`：增加 30 秒轮询作为兜底
  - [x] 同时保留 `levelchange` 和 `chargingchange` 事件监听
  - [x] 进入主界面后立即执行一次读取
  - **验证**: 手机插拔充电器确认电量即时更新，不插电也定期更新 ✅

## Phase 4: 自动实时定位

- [x] Task 7: 实现自动实时定位
  - [x] 修改 `app.js`：进入主界面后自动调用 `navigator.geolocation`
  - [x] 实现 `watchPosition` 持续监听位置变化
  - [x] 位置变化时自动上报到后端
  - [x] 删除手动"一键定位"按钮
  - [x] 定位拒绝时显示友好提示
  - **验证**: 打开 App 后自动弹出定位权限请求，授权后位置自动上报 ✅

## Phase 5: 整合验证

- [x] Task 8: 前端完整联调测试
  - [x] 测试完整引导流程
  - [x] 测试主页所有功能（天数、状态、心愿、之间、心情、设置）
  - [x] 确认时光墙已完全移除
  - [x] 确认定位自动启动
  - [x] 确认电量精准读取
  - **验证**: 所有测试用例通过 ✅