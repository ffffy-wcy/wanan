# 晚安 App UI 流程优化 Spec

## Why
当前 App 存在以下问题：引导流程不完整（缺少生日字段）、电量读取不精准（仅充电时更新）、定位需要手动点击、时光墙功能冗余。需要优化整体流程和核心体验。

## What Changes
- **BREAKING**: 删除时光墙功能（页面、路由、数据库模型、UI 入口）
- 个人信息设置增加生日日期字段
- 引导流程重排：品牌页 → 登录 → 完善个人信息 → 配对 → 进入主界面
- 电量监控改为高频轮询 + 事件监听双保险
- 定位改为进入主界面后自动请求权限并实时上报
- 主页功能参照图二完整保留

## Impact
- Affected specs: rebuild-sync-auth
- Affected code: `app.js`, `styles.css`, `index.html`, `src/routes/wall.js`, `src/routes/auth.js`, `src/frontend/battery.js`, `prisma/schema.prisma`

---

## ADDED Requirements

### Requirement: 个人资料增加生日字段
系统 SHALL 在个人信息设置步骤中增加生日日期输入框。

#### Scenario: 用户填写生日
- **WHEN** 用户在完善个人信息页面填写生日
- **THEN** 生日日期保存到 User 模型，并在主页纪念日区域展示

### Requirement: 自动实时定位
系统 SHALL 在用户进入主界面后自动请求定位权限，并开始实时上报位置。

#### Scenario: 用户进入主界面
- **WHEN** 用户首次进入主界面
- **THEN** App 自动弹出定位权限请求
- **AND** 授权后开始持续上报位置（每 30 秒或位置变化时）
- **AND** 不再需要手动点击"一键定位"按钮

#### Scenario: 用户拒绝定位权限
- **WHEN** 用户拒绝定位权限
- **THEN** 之间页面显示"定位未开启"提示
- **AND** 提供手动开启的引导按钮

### Requirement: 精准电量读取
系统 SHALL 通过高频轮询 + 事件监听结合的方式精准读取电量。

#### Scenario: 电量变化
- **WHEN** 手机电量发生变化
- **THEN** 通过 `levelchange` 事件立即更新
- **AND** 每 30 秒轮询一次作为兜底

#### Scenario: 充电状态变化
- **WHEN** 手机插拔充电器
- **THEN** 通过 `chargingchange` 事件立即更新

---

## MODIFIED Requirements

### Requirement: 引导流程顺序
系统 SHALL 按以下顺序展示引导流程：

1. 品牌页（爱心 + 标题 + 标语）
2. 登录页（QQ 登录 + 微博登录）
3. 完善个人信息（昵称 + 生日 + 在一起的日期）
4. 配对页（生成配对码 / 输入配对码）
5. 进入主界面

#### Scenario: 新用户首次打开
- **WHEN** 新用户（无 token）打开 App
- **THEN** 依次展示品牌页 → 登录页
- **AND** 登录成功后展示完善个人信息页
- **AND** 完成后展示配对页
- **AND** 配对或跳过进入主界面

#### Scenario: 已登录无配对用户
- **WHEN** 已登录但未配对的用户打开 App
- **THEN** 跳过品牌页和登录页
- **AND** 直接展示完善个人信息或配对页

---

## REMOVED Requirements

### Requirement: 时光墙功能
**Reason**: 用户反馈功能冗余，决定移除
**Migration**: 删除 WallEntry 模型、wall 路由、前端时光墙页面、TabBar 入口

### Requirement: 手动一键定位按钮
**Reason**: 改为进入主界面自动定位
**Migration**: 删除之间页面的手动定位按钮，改为自动触发