# Tasks

## Phase 1: 后端基础设施

- [x] Task 1: 搭建项目骨架与数据库
  - [x] 初始化 Node.js 项目，安装依赖（express, prisma, socket.io, jsonwebtoken, bcrypt, cors, dotenv 等）
  - [x] 编写 Prisma Schema（User, Room, PairCode, WallEntry, Wish, Anniversary, Mood, Location 等模型）
  - [x] 运行 `prisma migrate` 生成数据库表结构
  - [x] 创建 `src/db.js` 导出 Prisma Client 单例
  - **验证**: 运行 `npx prisma studio` 确认数据库表结构正确

- [x] Task 2: 实现 JWT 认证中间件
  - [x] 创建 `src/middleware/auth.js`：解析 Authorization header、验证 JWT、将 user 注入 req
  - [x] 创建 `src/middleware/roomGuard.js`：验证当前用户是否有权访问指定 room 数据
  - [x] 编写 `src/utils/jwt.js`：sign / verify / refresh 工具函数
  - **验证**: 单元测试 JWT 签发和验证

- [x] Task 3: 实现 QQ / 微信 OAuth 登录
  - [x] 创建 `src/routes/auth.js`：QQ 登录回调、微信登录回调、refresh token 端点
  - [x] 实现 QQ OAuth 流程：构造授权 URL → 接收 code → 换取 access_token → 获取 openid → 创建/查找用户 → 签发 JWT
  - [x] 实现微信 OAuth 流程：同上流程（支持微信内网页授权和微信开放平台扫码登录）
  - [x] 实现 refresh token 端点：验证 refresh token → 签发新 access token
  - **验证**: 手动测试 QQ/微信登录流程，确认返回 JWT

- [x] Task 4: 实现配对绑定系统
  - [x] 创建 `src/routes/pair.js`：生成配对码、加入配对、解除配对
  - [x] 生成配对码端点：创建 PairCode 记录（6 位随机码，24 小时过期）
  - [x] 加入配对端点：验证配对码 → 创建 Room 并将双方关联 → 复制初始数据
  - [x] 解除配对端点：解除 Room 关联，双方各自保留数据快照
  - **验证**: 单元测试配对码生成/验证/过期逻辑

- [x] Task 5: 实现核心数据 API（CRUD）
  - [x] 创建 `src/routes/wall.js`：时光墙留言的增删查（GET /room/:id/wall, POST, DELETE /:entryId）
  - [x] 创建 `src/routes/wish.js`：心愿的增删改查（GET /room/:id/wishes, POST, PATCH /:id, DELETE /:id）
  - [x] 创建 `src/routes/anniversary.js`：纪念日的增删查
  - [x] 创建 `src/routes/mood.js`：心情打卡增查（同一天覆盖）
  - [x] 创建 `src/routes/settings.js`：房间设置（昵称、纪念日、见面日期、位置）
  - [x] 创建 `src/routes/export.js`：数据导出 JSON 端点
  - [x] 所有路由统一使用 `auth` + `roomGuard` 中间件
  - **验证**: 用 Postman/curl 测试所有 CRUD 端点

## Phase 2: 实时同步

- [x] Task 6: 实现 WebSocket 实时同步
  - [x] 创建 `src/sync.js`：Socket.IO 服务端逻辑
  - [x] 用户连接时加入对应 room 的 Socket.IO room
  - [x] 数据变更时（CRUD 操作后）广播到同 room 的另一个用户
  - [x] 定义事件类型：`wall:new`, `wall:delete`, `wish:new`, `wish:update`, `wish:delete`, `anniv:new`, `anniv:delete`, `mood:update`, `settings:update`, `location:update`
  - [x] 实现心跳检测和断线自动重连（指数退避）
  - **验证**: 用两个浏览器窗口模拟双方用户，确认实时推送

## Phase 3: 前端重构

- [x] Task 7: 前端基础架构重构
  - [x] 创建 `src/frontend/` 目录，将前端代码模块化
  - [x] 创建 `src/frontend/api.js`：统一封装 fetch 请求（自动附带 JWT、401 自动刷新、错误处理）
  - [x] 创建 `src/frontend/store.js`：前端状态管理（替代当前全局 state）
  - [x] 创建 `src/frontend/socket.js`：Socket.IO 客户端连接管理、事件监听、重连逻辑
  - [x] 创建 `src/frontend/utils.js`：迁移现有 Utils 工具函数
  - [x] 更新 `index.html`：引用新的模块化脚本
  - **验证**: 确保前端能正常启动并与后端通信

- [x] Task 8: 实现 Onboarding 引导页
  - [x] 设计 3 屏引导页 UI（品牌映入 → 核心功能 → 登录）
  - [x] 实现登录选择页：QQ 登录按钮、微信登录按钮
  - [x] 实现 OAuth 回调处理：解析 URL 参数获取 token，存储到 localStorage
  - [x] 实现首次使用判断：检查 localStorage 中是否有 token，无则显示引导页
  - [x] 添加引导页插画和动画（使用 CSS 动画 + SVG 图形）
  - **验证**: 清除 localStorage 后刷新页面，确认引导页正常展示

- [x] Task 9: 重构首页「在一起的日子」
  - [x] 从后端 API 加载房间数据
  - [x] 监听 WebSocket `settings:update` 事件实时刷新
  - [x] 添加骨架屏加载状态
  - [x] 添加错误状态和重试按钮
  - [x] 保留原有视觉风格和心跳动画
  - **验证**: 修改纪念日日期后确认首页实时刷新

- [x] Task 10: 重构时光墙
  - [x] 从后端 API 加载留言列表
  - [x] 移除「我说/ta 说」选择器，自动根据当前用户身份标记
  - [x] 添加留言删除功能（长按或点击删除按钮 + 确认对话框）
  - [x] 监听 WebSocket `wall:new` / `wall:delete` 实时更新
  - [x] 添加加载骨架屏和空状态
  - **验证**: 双方同时添加留言，确认实时同步

- [x] Task 11: 重构心愿清单
  - [x] 从后端 API 加载心愿列表
  - [x] 添加复选框交互：点击切换完成状态
  - [x] 添加删除功能
  - [x] 监听 WebSocket `wish:new` / `wish:update` / `wish:delete` 实时更新
  - [x] 保留完成统计文案
  - **验证**: 勾选心愿后确认对方界面同步更新

- [x] Task 12: 重构「之间」页面
  - [x] 从后端 API 加载位置、纪念日数据
  - [x] 新增对方今日心情显示
  - [x] 电池电量改为通过 WebSocket 实时推送
  - [x] 监听 WebSocket 事件实时更新距离、纪念日、心情
  - **验证**: 对方更新位置后确认距离实时刷新

- [x] Task 13: 重构心情打卡
  - [x] 从后端 API 加载心情数据
  - [x] 心情笔记支持编辑（点击已有笔记可修改）
  - [x] 监听 WebSocket `mood:update` 实时更新
  - [x] 新增「对方今日心情」展示
  - **验证**: 打卡心情后确认对方页面实时显示

- [x] Task 14: 重构设置页
  - [x] 显示登录状态（QQ/微信头像 + 昵称）或登录按钮
  - [x] 添加「生成配对码」按钮和配对码展示区
  - [x] 添加「解除配对」按钮 + 确认对话框
  - [x] 添加「导出数据」按钮 + 下载 JSON
  - [x] 添加「隐私政策」和「服务条款」链接
  - [x] 保留昵称、纪念日、位置输入字段
  - **验证**: 生成配对码后在另一设备输入配对码完成绑定

- [x] Task 15: 实现离线支持
  - [x] 创建 `src/frontend/offline.js`：离线队列管理
  - [x] 监听 `navigator.onLine` 事件，切换离线指示条
  - [x] 离线时写操作暂存 IndexedDB / localStorage 队列
  - [x] 恢复网络后逐条同步并清空队列
  - [x] 更新 Service Worker 缓存策略：API 请求走网络优先，静态资源走缓存优先
  - **验证**: 断网后添加留言，恢复网络后确认自动同步

## Phase 4: UI 打磨与发布准备

- [x] Task 16: UI 全局状态打磨
  - [x] 统一 Toast 通知组件（成功/错误/加载/离线提示）
  - [x] 统一确认对话框组件
  - [x] 统一骨架屏组件
  - [x] 统一空状态占位图
  - [x] 统一错误状态 + 重试按钮
  - **验证**: 视觉审查所有页面状态

- [x] Task 17: 隐私政策和服务条款页面
  - [x] 创建隐私政策页面（HTML）
  - [x] 创建服务条款页面（HTML）
  - [x] 设置页添加链接跳转
  - **验证**: 确认两个页面可正常访问

- [x] Task 18: Capacitor 原生集成
  - [x] 更新 Capacitor 配置，绑定 QQ/微信 SDK
  - [x] 实现原生 QQ 登录（通过 Capacitor 插件跳转 QQ App 授权）
  - [x] 实现原生微信登录（通过 Capacitor 插件跳转微信 App 授权）
  - [x] 配置 Android 的 URL Scheme 回调
  - **验证**: 在 Android 设备上测试 QQ/微信原生登录

- [x] Task 19: 更新 PWA 配置
  - [x] 更新 `manifest.json`：新的应用图标、描述
  - [x] 创建新的 SVG 图标（icon.svg、icon-maskable.svg）
  - [x] 更新 `sw.js`：新的缓存策略（网络优先 API + 缓存优先静态资源）
  - **验证**: Lighthouse PWA 评分 > 90

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 2
- Task 5 依赖 Task 2, Task 4
- Task 6 依赖 Task 5
- Task 7 依赖 Task 5
- Task 8 依赖 Task 7
- Task 9-14 依赖 Task 7, Task 8（可并行）
- Task 15 依赖 Task 7
- Task 16 依赖 Task 9-14
- Task 17 依赖 Task 14
- Task 18 依赖 Task 8
- Task 19 可独立进行