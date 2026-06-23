# Checklist

## 后端基础设施
- [x] Prisma Schema 包含 User、Room、PairCode、WallEntry、Wish、Anniversary、Mood、Location 模型
- [ ] 数据库迁移成功执行，表结构正确
- [x] Prisma Client 单例正确导出

## 认证系统
- [x] JWT 签发和验证逻辑正确（sign / verify / refresh）
- [x] auth 中间件正确解析 Authorization header 并注入 req.user
- [x] roomGuard 中间件正确校验用户对 room 的访问权限
- [x] QQ OAuth 登录流程完整可用（授权 URL → code → access_token → openid → JWT）
- [x] 微信 OAuth 登录流程完整可用
- [x] refresh token 端点正常刷新 access token
- [x] 401 响应时前端自动尝试刷新 token
- [x] 未登录用户访问受保护页面时跳转登录页

## 配对绑定
- [x] 生成配对码返回 6 位唯一码
- [x] 配对码 24 小时后自动过期
- [x] 输入有效配对码后双方绑定到同一 Room
- [x] 已配对用户无法再次生成配对码（需先解绑）
- [x] 解除配对后双方各自保留数据快照

## 数据 CRUD API
- [x] 时光墙留言增删查接口正常
- [x] 心愿增删改查接口正常
- [x] 纪念日增删查接口正常
- [x] 心情打卡（同一天覆盖）接口正常
- [x] 房间设置更新接口正常
- [x] 数据导出 JSON 接口正常
- [x] 所有数据接口均通过 auth + roomGuard 中间件保护

## 实时同步（WebSocket）
- [x] Socket.IO 服务端正确将用户加入对应 room
- [x] 数据变更时正确广播到同 room 的另一用户
- [x] 所有事件类型（wall/wish/anniv/mood/settings/location）均正确触发
- [x] 断线后自动重连（指数退避）
- [x] 重连后自动拉取增量数据

## 前端 Onboarding
- [x] 首次使用显示 3 屏引导页
- [x] QQ 登录按钮可点击并跳转 OAuth
- [x] 微信登录按钮可点击并跳转 OAuth
- [x] OAuth 回调正确解析 token 并存储
- [x] 已登录用户跳过引导页直接进入主页

## 前端页面重构
- [x] 首页从 API 加载数据并正确渲染
- [x] 首页监听 WebSocket 实时刷新
- [x] 首页有骨架屏加载状态
- [x] 首页有错误状态和重试按钮
- [x] 时光墙自动根据用户身份标记 who
- [x] 时光墙支持删除留言
- [x] 时光墙实时同步新留言
- [x] 心愿清单支持复选框勾选完成/取消
- [x] 心愿清单支持删除
- [x] 心愿清单实时同步状态变更
- [x] 之间页面显示对方今日心情
- [x] 之间页面实时更新距离和纪念日
- [x] 电池电量通过 WebSocket 实时推送
- [x] 心情打卡支持编辑已有笔记
- [x] 心情打卡实时同步对方心情
- [x] 设置页显示登录状态
- [x] 设置页可生成配对码
- [x] 设置页可解除配对
- [x] 设置页可导出数据
- [x] 设置页有隐私政策和服务条款链接

## 离线支持
- [x] 离线时显示「当前离线」指示条
- [x] 离线时写操作暂存本地队列
- [x] 恢复网络后自动同步离线队列
- [x] Service Worker 缓存策略正确（网络优先 API + 缓存优先静态资源）

## UI 全局状态
- [x] Toast 通知组件统一（成功/错误/加载/离线）
- [x] 确认对话框组件统一
- [x] 骨架屏组件统一
- [x] 空状态占位图统一
- [x] 错误状态 + 重试按钮统一

## 隐私政策
- [x] 隐私政策页面可正常访问
- [x] 服务条款页面可正常访问

## PWA
- [x] manifest.json 配置正确
- [x] 应用图标正确
- [x] Service Worker 正确注册和缓存
- [ ] Lighthouse PWA 评分 > 90

## 安全
- [x] 前端源码中不存在任何硬编码密钥
- [x] 所有 API 请求均附带 JWT
- [x] 越权访问返回 403
- [x] 密码/密钥等敏感信息不记录到日志