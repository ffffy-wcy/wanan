# Tasks

## Phase 1: 账号认证改造

- [x] Task 1: 移除微博登录
  - [x] SubTask 1.1: 从 `src/routes/auth.js` 删除微博 OAuth 端点与回调
  - [x] SubTask 1.2: 从 `index.html` 删除微博登录按钮
  - [x] SubTask 1.3: 从 `app.js` 删除微博登录相关处理与状态跳转
  - [x] SubTask 1.4: 从 `styles.css` 删除微博按钮样式（若独立存在）
  - **验证**: 登录页不再出现微博入口，源码中无 `weibo`/`weibo.com` 引用 ✅

- [x] Task 2: 新增手机号短信验证码登录
  - [x] SubTask 2.1: 在 `prisma/schema.prisma` 的 User 模型添加 `phone String? @unique` 字段
  - [x] SubTask 2.2: 创建 `src/routes/sms-auth.js`：实现 `/api/auth/sms/send` 发送验证码、`/api/auth/sms/login` 验证码登录
  - [x] SubTask 2.3: 使用内存/Redis 存储验证码（开发期允许内存），设置 5 分钟过期与 60 秒重发限制
  - [x] SubTask 2.4: 在 `src/server.js` 注册 sms-auth 路由
  - [x] SubTask 2.5: 在 `index.html` 登录页新增手机号输入框、验证码输入框、获取验证码按钮
  - [x] SubTask 2.6: 在 `app.js` 实现短信登录 UI 交互与倒计时
  - [x] SubTask 2.7: 登录成功后保存 JWT 与 refresh token，进入个人信息填写页
  - **验证**: 使用任意手机号可收到模拟验证码（开发期控制台输出），输入正确后登录成功 ✅

- [x] Task 3: 统一登录后状态判断
  - [x] SubTask 3.1: 定义用户首次使用标志：`hasProfile`（是否填写个人信息）、`hasPartner`（是否完成配对）
  - [x] SubTask 3.2: 在 `app.js` 启动时按 token → profile → partner 的顺序判断下一步展示页面
  - **验证**: 清除 localStorage 后首次打开依次进入品牌页→登录→个人信息→配对 ✅

## Phase 2: 数据模型与用户体系调整

- [x] Task 4: 改造 User / Room / Pair 模型
  - [x] SubTask 4.1: 在 `prisma/schema.prisma` 中新增/调整字段：`gender String?`、`anniversary DateTime?`、`phone String? @unique`、`partnerId String?`
  - [x] SubTask 4.2: 确保 Room 模型支持按 partner 双向绑定后的数据隔离
  - [x] SubTask 4.3: 运行 `npx prisma migrate dev` 或 `npx prisma db push` 同步数据库
  - [x] SubTask 4.4: 创建/更新 `src/routes/profile.js`：支持更新昵称、性别、在一起日期
  - **验证**: Prisma Studio 中可见新字段，profile API 可正常更新 ✅

- [x] Task 5: 个人信息填写页
  - [x] SubTask 5.1: 在 `index.html` 新增/重制「个人信息填写」视图，包含昵称输入、性别单选（Boy-男 / Girl-女）、在一起日期选择
  - [x] SubTask 5.2: 在 `app.js` 实现表单校验与提交，调用 `/api/auth/profile` 或 `/api/profile`
  - [x] SubTask 5.3: 保存成功后标记 `hasProfile=true`，进入配对页
  - **验证**: 登录后未填写资料时强制停留在该页，填写完成后才能进入配对页 ✅

## Phase 3: 配对机制重构

- [x] Task 6: 移除旧配对模式
  - [x] SubTask 6.1: 删除 `src/frontend/webrtc.js`、`src/frontend/pairing.js`、P2P 相关 IndexedDB 同步逻辑
  - [x] SubTask 6.2: 删除 `src/frontend/localdb.js` 中 P2P 专用的 syncMeta / pendingSync
  - [x] SubTask 6.3: 删除本地局域网服务器发现相关代码与 UI
  - [x] SubTask 6.4: 删除旧 6 位配对码表/逻辑（原 PairCode 模型），改为基于 user_id 映射
  - **验证**: 源码中无 WebRTC、P2P、LAN、PIN、旧 PairCode 的残留引用 ✅

- [x] Task 7: 实现基于 user_id 的匹配码与双向绑定
  - [x] SubTask 7.1: 设计 user_id → 6~8 位可读数字的映射算法（保证同一用户固定码，避免冲突检测）
  - [x] SubTask 7.2: 创建/更新 `src/routes/pair.js`：
    - `GET /api/pair/code` 返回当前用户的匹配码与二维码 token
    - `POST /api/pair/join` 接收匹配码，查找对方 user_id 并建立双向 partner_id 绑定
    - `DELETE /api/pair` 解除配对
  - [x] SubTask 7.3: 在 `src/server.js` 注册 pair 路由
  - [x] SubTask 7.4: 实现匹配码二维码生成（使用 qrcode 库或 Canvas）
  - **验证**: 用户 A 生成匹配码，用户 B 输入后双方 partner_id 互相关联 ✅

- [x] Task 8: 配对页 UI 重制
  - [x] SubTask 8.1: 在 `index.html` 新增/重制「配对页」，展示当前用户匹配码、二维码、输入对方匹配码入口、扫一扫按钮
  - [x] SubTask 8.2: 在 `app.js` 实现生成匹配码、展示二维码、输入匹配码绑定的事件绑定
  - [x] SubTask 8.3: 配对成功后跳转权限引导页（或主页）
  - **验证**: 配对页风格统一，扫码/输入码均可完成绑定 ✅

## Phase 4: 权限、地图与状态页

- [x] Task 9: 权限引导页
  - [x] SubTask 9.1: 在 `index.html` 新增「必要权限设置」页面，列出实时定位、允许后台运行、开启通知权限三项
  - [x] SubTask 9.2: 在 `app.js` 实现点击跳转系统设置（Capacitor AppLauncher / 浏览器降级提示）
  - [x] SubTask 9.3: 进入主页前检查定位/通知授权状态，未授权则停留在权限页
  - **验证**: 权限页风格统一，点击项可跳转系统设置 ✅

- [x] Task 10: 实时定位与地图页
  - [x] SubTask 10.1: 在 `app.js` 进入主页后自动调用 `navigator.geolocation.watchPosition` 持续上报位置
  - [x] SubTask 10.2: 更新 `src/routes/location.js`：保存/读取用户位置，计算双方距离
  - [x] SubTask 10.3: 在「之间」页面保留/新增 Leaflet 地图，显示双方头像标记、连线、距离标签
  - [x] SubTask 10.4: 删除设置页中的经纬度显示与城市字段
  - **验证**: 双方授权定位后，地图显示两个标记与距离；仅一方有位置时显示「—」 ✅

- [x] Task 11: 手机状态页
  - [x] SubTask 11.1: 在 `index.html` 新增/重制「状态」视图
  - [x] SubTask 11.2: 展示今日使用时长、WiFi/数据流量、实时网速、电量、存储占用、通话记录等
  - [x] SubTask 11.3: 从 Battery API、Network Information API、Device Memory API 等获取数据并适配浏览器/App
  - **验证**: 状态页可展示主要信息，无报错 ✅

## Phase 5: 设置与前端整体重设计

- [x] Task 12: 设置页精简
  - [x] SubTask 12.1: 在 `index.html` 重制设置页，仅保留：昵称、个人中心、退出登录、配对码
  - [x] SubTask 12.2: 删除设置页中纪念日、经纬度、城市、同步模式切换、数据导出等不再需要的项
  - [x] SubTask 12.3: 点击「退出登录」清除 token 并返回登录页
  - **验证**: 设置页仅显示四项，功能正常 ✅

- [x] Task 13: 品牌页与整体 UI 重设计
  - [x] SubTask 13.1: 重制品牌页（App 启动页），展示 Logo/品牌名/标语
  - [x] SubTask 13.2: 重制登录页、个人信息页、配对页、权限页、主页、之间页、状态页、设置页
  - [x] SubTask 13.3: 更新 `styles.css`，统一配色、圆角、阴影、字体、按钮样式
  - [x] SubTask 13.4: 确保底部 TabBar 在 320px-428px 宽度下正常显示
  - **验证**: 各页面视觉风格统一，无明显错位 ✅

## Phase 6: 构建与端到端验证

- [x] Task 14: 清理与同步
  - [x] SubTask 14.1: 运行 `npm run sync:www` 将最新源码同步到 `www/`
  - [x] SubTask 14.2: 修复 `sw.js` 离线缓存列表，移除已删除的 `offline.js`
  - [x] SubTask 14.3: 运行 `npx cap sync android`
  - **验证**: 同步无报错 ✅

- [x] Task 15: 浏览器端到端测试
  - [x] SubTask 15.1: 启动本地服务器，访问 `http://localhost:3000`
  - [x] SubTask 15.2: 完整走一遍：品牌页 → 手机号登录 → 个人信息 → 生成匹配码 → 另一浏览器输入匹配码 → 权限页 → 主页
  - [x] SubTask 15.3: 验证 QQ 登录入口存在且能进入 OAuth 流程（可测试到跳转）
  - [x] SubTask 15.4: 验证设置页、地图、状态页无报错
  - **验证**: 浏览器端完整流程通过，控制台无报错 ✅

- [x] Task 16: APK 构建与安装测试
  - [x] SubTask 16.1: 运行 `./gradlew assembleRelease` 构建 APK
  - [ ] SubTask 16.2: 在 Android 设备/模拟器上安装并启动（当前环境无 adb/模拟器，无法执行）
  - [ ] SubTask 16.3: 验证首次启动流程、登录、配对、主页显示正常（待真机/模拟器补充）
  - **验证**: APK 构建成功，路径 `android/app/build/outputs/apk/release/app-release.apk`

# Task Dependencies

- Task 2 依赖 Task 1（先清理微博，再新增手机号登录）
- Task 3 依赖 Task 2
- Task 5 依赖 Task 4
- Task 6 可和 Task 1-5 并行（删除旧逻辑）
- Task 7 依赖 Task 4（需要 User/Room 模型）
- Task 8 依赖 Task 7
- Task 9 依赖 Task 8
- Task 10 依赖 Task 9（定位权限）
- Task 12 依赖 Task 6（删除旧设置项）
- Task 13 依赖 Task 3, Task 5, Task 8, Task 9, Task 10, Task 12
- Task 14 依赖 Task 13
- Task 15 依赖 Task 14
- Task 16 依赖 Task 15

# Parallelizable

- Task 1 与 Task 4 可并行
- Task 6 与 Task 2-5 可并行
- Task 9-12 在 Task 7-8 完成后可并行
