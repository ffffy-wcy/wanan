# 晚安 App 账号配对与流程重设计 Spec

## Why

当前 App 的登录方式包含微博等不再需要的第三方入口，配对机制同时存在本地局域网服务器、配对码、PIN 码、P2P WebRTC 等多种模式，导致用户流程混乱、维护成本高。需要以「手机号验证码 + QQ 登录」为核心认证方式，以「内部 user_id 双向绑定」为唯一配对机制，重构品牌页→登录→个人信息→配对→主页的完整流程，并围绕定位、后台运行、通知三大权限重新设计地图与状态页。

## What Changes

- **BREAKING**: 移除微博登录入口及相关回调逻辑
- **BREAKING**: 移除本地局域网服务器配对、PIN 码登录、P2P WebRTC 同步等所有旧配对/同步模式
- 新增手机号短信验证码登录（开发期可配置为模拟发送）
- 保留 QQ OAuth 登录接口不变
- 账号层与业务层解耦：认证仅负责生成内部 user_id；配对由服务端为两个 user_id 建立 partner_id 双向绑定
- 匹配码改为内部 user_id 的 6~8 位可读映射；二维码由匹配码/邀请 token 编码生成
- 用户流程固定为：品牌页 → 登录 → 个人信息填写 → 配对 → 主页
- 登录后强制填写个人信息：昵称、性别（男/女）、在一起的日期
- 进入主页前必须完成配对（或提供显式「跳过」但功能受限）
- 权限页新增/强化：实时定位、允许后台运行、开启通知权限
- 「之间」页面新增/保留地图可视化：双方定位、距离
- 「手机状态」页面保留使用时长、流量、网速、电量、存储、通话记录等
- 设置页仅保留：昵称、个人中心、退出登录、配对码
- 删除设置中的经纬度显示、城市选择等旧字段
- 前端整体按提供的五张设计图重新设计
- 构建 APK 并在浏览器中完成端到端验证

## Impact

- Affected specs: `rebuild-sync-auth`, `refine-ui-flow`, `live-map-moments`, `p2p-webrtc-sync`
- Affected code: `app.js`, `index.html`, `styles.css`, `src/server.js`, `src/routes/auth.js`, `src/routes/pair.js`, `src/routes/location.js`, `src/frontend/`, `prisma/schema.prisma`, `android/`

---

## ADDED Requirements

### Requirement: 手机号短信验证码登录

系统 SHALL 支持用户通过手机号 + 短信验证码完成登录/注册。

#### Scenario: 发送验证码

- **WHEN** 用户在登录页输入手机号并点击「获取验证码」
- **THEN** 后端生成 4~6 位验证码并调用短信网关（或开发期模拟发送）
- **AND** 前端进入倒计时状态，防止频繁重发

#### Scenario: 验证码登录成功

- **WHEN** 用户输入正确的验证码并点击登录
- **THEN** 后端创建/查找用户，签发 JWT，前端保存 token 并进入下一步（个人信息填写）

#### Scenario: 验证码错误

- **WHEN** 用户输入错误验证码
- **THEN** 前端提示「验证码错误，请重新输入」

#### Scenario: 未注册手机号自动注册

- **WHEN** 新手机号首次登录成功
- **THEN** 系统自动创建 User 记录，初始昵称为手机号脱敏显示

### Requirement: QQ OAuth 登录

系统 SHALL 保留现有 QQ 登录接口，登录成功后进入相同的后续流程。

#### Scenario: QQ 登录成功

- **WHEN** 用户点击「QQ 登录」并完成授权
- **THEN** 后端获取 openid，创建/查找用户，签发 JWT
- **AND** 前端保存 token 并进入个人信息填写页

### Requirement: 个人信息填写

系统 SHALL 在登录成功后强制用户填写个人信息。

#### Scenario: 填写昵称

- **WHEN** 用户输入昵称
- **THEN** 昵称保存到 User 模型，限制长度 2-20 字符

#### Scenario: 选择性别

- **WHEN** 用户选择「Boy-男」或「Girl-女」
- **THEN** 性别保存到 User 模型

#### Scenario: 选择在一起的日期

- **WHEN** 用户选择日期
- **THEN** 日期保存到 Room/User 模型，首页计算并展示「在一起 X 天」

### Requirement: 基于 user_id 的配对绑定

系统 SHALL 通过服务端为两个用户建立 partner_id 双向绑定关系。

#### Scenario: 生成匹配码

- **WHEN** 已登录用户进入配对页
- **THEN** 服务端将当前 user_id 映射为 6~8 位可读数字匹配码
- **AND** 生成邀请 token 并展示匹配码与二维码

#### Scenario: 输入匹配码绑定

- **WHEN** 用户在配对页输入对方的 6~8 位匹配码
- **THEN** 服务端解析出对方 user_id，建立双向 partner_id 绑定
- **AND** 双方进入同一 Room，可开始数据同步

#### Scenario: 扫描二维码绑定

- **WHEN** 用户扫描对方配对二维码
- **THEN** 解析匹配码/邀请 token，完成与输入匹配码等价的绑定流程

#### Scenario: 解绑

- **WHEN** 用户在设置页点击「解除配对」
- **THEN** 服务端清除双方 partner_id 关联
- **AND** 用户回到配对页，历史数据各自保留只读副本

### Requirement: 权限引导

系统 SHALL 在合适的时机引导用户授权实时定位、后台运行、通知权限。

#### Scenario: 首次进入配对后/主页前

- **WHEN** 用户完成配对并准备进入主页
- **THEN** 展示权限引导页，逐项说明并跳转系统设置

#### Scenario: 实时定位授权

- **WHEN** 用户点击「去设置」实时定位
- **THEN** 跳转系统定位权限设置，授权后返回 App 开始实时上报位置

#### Scenario: 后台运行授权

- **WHEN** 用户点击「去设置」后台运行
- **THEN** 跳转系统电池/自启动管理页，授权后 App 可在后台持续运行

#### Scenario: 通知授权

- **WHEN** 用户点击「去设置」通知
- **THEN** 跳转系统通知设置，授权后 App 可接收推送

### Requirement: 地图与距离可视化

系统 SHALL 在「之间」页面通过地图展示双方实时定位和距离。

#### Scenario: 双方都有位置

- **WHEN** 双方均已授权定位
- **THEN** 地图上显示两个头像标记、虚线连接、距离标签

#### Scenario: 仅一方有位置

- **WHEN** 仅一方授权定位
- **THEN** 地图显示该方标记，距离显示「—」

### Requirement: 手机状态页

系统 SHALL 提供手机状态页面，展示设备运行信息。

#### Scenario: 查看状态

- **WHEN** 用户进入状态页
- **THEN** 展示今日使用时长、WiFi/数据流量、实时网速、电量、存储占用、通话记录等

### Requirement: 设置页精简

系统 SHALL 仅保留必要的设置项。

#### Scenario: 进入设置页

- **WHEN** 用户进入设置
- **THEN** 仅展示：昵称、个人中心、退出登录、配对码
- **AND** 不再展示经纬度、城市等字段

---

## MODIFIED Requirements

### Requirement: 登录页

原来：包含 QQ、微博等多种登录方式。
修改后：仅保留 QQ 登录和新增手机号验证码登录，删除微博入口。

### Requirement: 配对机制

原来：支持本地局域网服务器、配对码、PIN 码、P2P WebRTC 等多种方式。
修改后：仅保留基于内部 user_id 的双向绑定；匹配码/二维码仅作为 user_id 的可视化载体。

### Requirement: 设置页

原来：包含配对码、昵称、纪念日、位置输入、经纬度、城市等。
修改后：仅保留昵称、个人中心、退出登录、配对码。

### Requirement: 定位与城市显示

原来：设置页手动输入经纬度和城市。
修改后：删除设置页经纬度/城市输入，改为自动实时定位并在地图页面展示。

---

## REMOVED Requirements

### Requirement: 微博登录

**Reason**: 用户明确要求移除，仅保留 QQ 登录。
**Migration**: 删除 `src/routes/auth.js` 中微博相关端点、`index.html` 中微博登录按钮、`app.js` 中微博回调处理。

### Requirement: 本地局域网服务器配对

**Reason**: 架构统一为服务端 user_id 绑定，不再需要本地局域网方案。
**Migration**: 删除相关 UI、路由、本地发现逻辑。

### Requirement: PIN 码本地身份认证

**Reason**: 手机号验证码登录已覆盖无第三方登录的场景。
**Migration**: 删除 localAuth/PIN 相关模块与 UI。

### Requirement: P2P WebRTC 同步

**Reason**: 新架构以服务端为中心，P2P 模式增加维护成本且与新账号体系冲突。
**Migration**: 删除 `src/frontend/webrtc.js`、`src/frontend/pairing.js`、P2P 相关 IndexedDB 同步逻辑；保留 IndexedDB 作为本地缓存可选。

### Requirement: 设置页经纬度与城市字段

**Reason**: 实时定位与地图已涵盖该需求。
**Migration**: 删除相关 UI 和 API 字段，数据改为从 Location 模型读取。
