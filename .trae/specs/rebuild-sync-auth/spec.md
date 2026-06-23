# 晚安 App 全新架构重构 Spec

## Why

当前「晚安」项目存在严重的架构缺陷：前后端分离不彻底（`server.js` 是死代码，前端直接裸调 Supabase REST API）、两端数据同步靠 5 秒轮询且无冲突解决、认证仅靠"配对码"（无用户身份、无安全防护）、硬编码 Supabase anon key 暴露在前端源码中。若推向市场，这会导致数据丢失、隐私泄露、无法规模化。需要一次**全新架构重构**，以支持真实用户体系（QQ/微信登录）、实时双向同步、数据安全隔离。

## What Changes

- **BREAKING**: 废弃当前 `server.js`（JSON 文件存储）和 frontend 直接调用 Supabase 的架构
- 全新 Node.js 后端：Express + Prisma + PostgreSQL，统一的 RESTful API
- 引入用户系统：支持 QQ OAuth / 微信 OAuth 登录 + JWT 认证
- 实时同步：WebSocket（Socket.IO）替代 5 秒轮询，双方数据实时双向同步
- 数据安全：用户级数据隔离，Supabase anon key 移至后端，前端不再暴露任何密钥
- 前端重构：保持温暖视觉风格，增加 onboarding 引导、加载/错误状态、离线提示
- Capcitor 层：集成微信/QQ 原生 SDK 实现一键登录
- UI 增强：心愿打卡可勾选完成、支持删除操作、增加数据导出、隐私政策页
- **BREAKING**: 数据结构从"房间号共享"改为"用户绑定配对关系"，每对用户共享一个 room

## Impact

- Affected specs: 全部模块（首页、时光墙、心愿、之间、心情、设置）
- Affected code: `server.js`（重写）、`app.js`（重写）、`index.html`（重写）、`styles.css`（大幅修改）、`package.json`（新增依赖）、`manifest.json`（更新）、`sw.js`（更新）
- 新增文件: `auth.js`、`sync.js`、`db.js`、`routes/`、`middleware/`、`prisma/schema.prisma`

---

## ADDED Requirements

### Requirement: 用户认证系统
系统 SHALL 提供 QQ 和微信 OAuth 登录，以及 JWT Token 认证机制。

#### Scenario: QQ 登录成功
- **WHEN** 用户点击「QQ 登录」按钮
- **THEN** 跳转至 QQ OAuth 授权页，用户授权后回调至 App，后端签发 JWT，前端存储 token 并进入主页

#### Scenario: 微信登录成功
- **WHEN** 用户在微信内打开 App 或点击「微信登录」
- **THEN** 通过微信 OAuth 获取 openid/unionid，后端签发 JWT，前端存储 token 并进入主页

#### Scenario: Token 过期自动刷新
- **WHEN** API 请求返回 401
- **THEN** 前端自动尝试 refresh token，若刷新失败则跳转登录页

#### Scenario: 未登录用户访问
- **WHEN** 用户未登录访问 App
- **THEN** 展示优美的 onboarding 引导页，仅显示登录按钮

### Requirement: 用户配对绑定
系统 SHALL 支持两个用户通过"配对码"互相绑定，形成共享数据空间。

#### Scenario: 创建配对码
- **WHEN** 已登录用户进入设置页点击「生成配对码」
- **THEN** 后端生成 6 位唯一配对码，有效期 24 小时，展示给用户

#### Scenario: 对方输入配对码绑定
- **WHEN** 对方输入配对码并确认
- **THEN** 后端验证配对码有效性，将两个用户绑定到同一个 room，双方数据开始同步

#### Scenario: 解绑
- **WHEN** 用户点击「解除配对」
- **THEN** 弹出确认对话框，确认后解除绑定关系，双方各自保留历史数据副本

### Requirement: 实时双向同步
系统 SHALL 通过 WebSocket 实现双方数据实时同步，替代 5 秒轮询。

#### Scenario: 一方添加时光墙留言
- **WHEN** 用户 A 提交一条时光墙留言
- **THEN** 后端通过 WebSocket 推送给用户 B，用户 B 界面实时更新

#### Scenario: 一方更新心情
- **WHEN** 用户 A 打卡今日心情
- **THEN** 用户 B 的「之间」页面实时显示对方心情变化

#### Scenario: 断线重连
- **WHEN** WebSocket 连接断开
- **THEN** 前端自动尝试重连（指数退避），重连成功后拉取增量数据

#### Scenario: 冲突解决
- **WHEN** 双方同时修改同一数据（如同时打卡心情）
- **THEN** 后端以 `updatedAt` 时间戳为准，最后写入者胜出，并通过 WebSocket 通知双方最终状态

### Requirement: 数据安全
系统 SHALL 确保用户数据仅自己及配对对象可访问。

#### Scenario: 越权访问拒绝
- **WHEN** 用户请求非自己或非配对对象的数据
- **THEN** 后端返回 403 Forbidden

#### Scenario: API Key 保护
- **WHEN** 前端发起任何请求
- **THEN** 不暴露任何第三方服务密钥（Supabase key 等），所有第三方调用均在后端完成

### Requirement: Onboarding 引导页
系统 SHALL 为新用户提供优美的 onboarding 引导流程。

#### Scenario: 首次启动
- **WHEN** 新用户首次打开 App
- **THEN** 展示 3 屏引导页（品牌介绍 → 功能亮点 → 登录），包含精美的插画和动画

### Requirement: 加载与错误状态
系统 SHALL 在所有网络操作中提供加载状态和友好的错误提示。

#### Scenario: 数据加载中
- **WHEN** 页面正在从后端拉取数据
- **THEN** 显示骨架屏（skeleton）而非空白页

#### Scenario: 网络错误
- **WHEN** API 请求失败
- **THEN** 显示 toast 提示「网络开了小差，请稍后重试」，并提供重试按钮

### Requirement: 离线支持
系统 SHALL 在无网络时提供基本可用性。

#### Scenario: 离线查看
- **WHEN** 用户处于离线状态
- **THEN** 展示本地缓存数据，顶部显示「当前离线」指示条

#### Scenario: 离线操作队列
- **WHEN** 用户在离线状态下添加留言/心愿
- **THEN** 操作暂存本地队列，恢复网络后自动同步

### Requirement: 数据导出
系统 SHALL 支持用户导出自己的数据。

#### Scenario: 导出 JSON
- **WHEN** 用户在设置页点击「导出数据」
- **THEN** 下载包含所有时光墙、心愿、纪念日、心情数据的 JSON 文件

### Requirement: 心愿勾选完成
系统 SHALL 支持用户在心愿清单中标记完成。

#### Scenario: 勾选心愿为已完成
- **WHEN** 用户点击心愿旁的复选框
- **THEN** 心愿标记为已完成（划线样式），同时同步给配对对象

### Requirement: 删除功能
系统 SHALL 支持删除时光墙留言、心愿、纪念日。

#### Scenario: 删除时光墙留言
- **WHEN** 用户长按或点击留言旁的删除按钮
- **THEN** 弹出确认对话框，确认后删除并同步

### Requirement: 隐私政策和服务条款
系统 SHALL 提供隐私政策和服务条款页面。

#### Scenario: 查看隐私政策
- **WHEN** 用户在设置页点击「隐私政策」
- **THEN** 展示隐私政策内容

---

## MODIFIED Requirements

### Requirement: 首页（在一起的日子）
原来：仅展示天数、月度/周/小时拆解、下一个纪念日倒计时。
修改后：保留原有功能，外加重构为从统一后端加载数据，支持实时同步（对方更新纪念日时首页同步刷新）。

### Requirement: 时光墙
原来：留言仅支持「我说」/「ta 说」手动选择角色。
修改后：取消角色选择，自动根据登录用户身份标记 `who` 字段；支持删除操作；支持实时同步。

### Requirement: 心愿清单
原来：仅展示心愿列表和完成统计，无勾选交互。
修改后：支持点击复选框标记完成/取消完成；支持删除操作；实时同步状态变更。

### Requirement: 之间（距离 & 纪念日）
原来：展示距离、电量、纪念日列表。
修改后：保留功能，新增心情同步显示（对方今日心情）；电量上报改为 WebSocket 实时推送。

### Requirement: 心情打卡
原来：心情打卡，14 天色谱图，心情笔记。
修改后：保留功能，新增对方心情实时显示；心情笔记支持编辑。

### Requirement: 设置
原来：配对码、昵称、纪念日、位置输入。
修改后：新增 QQ/微信登录入口（或显示已登录状态）、生成配对码、解除配对、数据导出、隐私政策；原有字段保留。

---

## REMOVED Requirements

### Requirement: 浏览器端直连 Supabase
**Reason**: 安全风险（anon key 暴露在前端），且无法实现用户级权限控制。
**Migration**: 所有 Supabase 调用迁移至后端，前端通过认证后的 API 访问。

### Requirement: Express `server.js` JSON 文件存储
**Reason**: 不可扩展，无并发控制，且当前代码中实际未被前端使用（死代码）。
**Migration**: 完全重写为 Prisma + PostgreSQL 后端，统一数据层。

### Requirement: 5 秒轮询同步
**Reason**: 资源浪费，延迟高，用户体验差。
**Migration**: 迁移至 WebSocket 实时推送。