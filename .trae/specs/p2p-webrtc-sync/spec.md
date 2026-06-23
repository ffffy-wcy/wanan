# P2P WebRTC 同步方案 Spec

## Why

当前「晚安」App 依赖中心化服务器 + 第三方 OAuth（QQ/微信）才能实现数据同步，但第三方登录接入审批周期长、云服务器需要付费且运维成本高。对于一款仅限两人使用的异地情侣 App，完全可以改用 **P2P 直连 + 本地优先** 架构，无需任何服务器即可实现数据同步。

## What Changes

- **新增**: WebRTC P2P 直连数据同步通道，替代中心化 WebSocket 服务器
- **新增**: 二维码扫码配对机制（通过交换 WebRTC SDP 完成握手）
- **新增**: 本地优先存储（IndexedDB），即使无网络也能正常使用
- **新增**: 简易本地身份认证（PIN 码/昵称），无需第三方 OAuth
- **保留**: 现有中心化服务器模式作为可选通道（`syncMode: 'server'` / `syncMode: 'p2p'`），用户可切换
- **保留**: 所有现有 UI 和功能模块不变

## Impact

- Affected specs: `rebuild-sync-auth`（引入替代同步方案，不破坏现有架构）
- Affected code: 新增 `src/frontend/webrtc.js`、`src/frontend/pairing.js`、`src/frontend/localdb.js`；修改 `app.js`、`src/frontend/store.js`；不修改后端
- 服务器依赖: 完全可选（P2P 模式下无需服务器，Server 模式下仍需）

---

## ADDED Requirements

### Requirement: P2P WebRTC 数据同步通道
系统 SHALL 支持通过 WebRTC Data Channel 在两个设备之间建立 P2P 直连，实现数据实时同步，无需中心化服务器。

#### Scenario: 建立 P2P 连接
- **WHEN** 双方用户完成二维码配对
- **THEN** 两个设备通过 WebRTC Data Channel 建立直连，数据变更实时同步

#### Scenario: 数据变更同步
- **WHEN** 一方添加/修改/删除数据（时光墙、心愿、纪念日、心情等）
- **THEN** 变更通过 Data Channel 发送给对端，对端自动更新本地数据库和 UI

#### Scenario: NAT 穿透失败降级
- **WHEN** 双方网络环境导致 WebRTC 无法直连（如对称 NAT）
- **THEN** 系统提示用户切换至「服务器模式」或使用同一 WiFi 网络

#### Scenario: 断线自动重连
- **WHEN** P2P 连接意外断开
- **THEN** 双方自动尝试重新建立连接，同时本地数据可正常读写

### Requirement: 二维码扫码配对
系统 SHALL 支持通过二维码扫描完成两台设备的配对握手，无需输入任何配对码。

#### Scenario: 生成配对二维码
- **WHEN** 用户 A 点击「配对」并选择「P2P 直连模式」
- **THEN** 系统生成包含 WebRTC Offer SDP 的二维码，用户 B 扫描后自动建立连接

#### Scenario: 扫描二维码配对
- **WHEN** 用户 B 扫描用户 A 的配对二维码
- **THEN** 系统解析 SDP、生成 Answer，通过剪贴板/二维码回传给 A，完成 WebRTC 握手

#### Scenario: 已配对设备自动重连
- **WHEN** 双方设备都已配对且同时在线
- **THEN** 系统通过存储的 peer identity 自动尝试重连，无需再次扫码

### Requirement: 本地优先存储
系统 SHALL 使用 IndexedDB 作为本地数据存储，所有数据优先写入本地，再同步到对端。

#### Scenario: 离线使用
- **WHEN** 用户处于离线状态（无网络或对端不在线）
- **THEN** 所有操作正常写入本地 IndexedDB，UI 正常展示，待连接恢复后自动同步

#### Scenario: 冲突解决
- **WHEN** 双方离线状态下修改了同一条数据
- **THEN** 以 `updatedAt` 时间戳为准，最后写入者胜出，冲突数据保留在 `_conflicts` 数组中

#### Scenario: 数据初始导入
- **WHEN** 用户首次配对成功
- **THEN** 双方自动交换当前本地全部数据，合并为完整数据集

### Requirement: 简易本地身份认证
系统 SHALL 提供简易的本地身份认证方式，替代第三方 OAuth 登录。

#### Scenario: 创建本地身份
- **WHEN** 用户首次打开 App 且选择「本地模式」
- **THEN** 输入昵称和 4 位 PIN 码，创建本地身份（存储在 localStorage）

#### Scenario: 本地身份登录
- **WHEN** 用户再次打开 App
- **THEN** 输入 PIN 码验证身份，进入主界面

#### Scenario: 切换到第三方登录
- **WHEN** 用户后续想使用 QQ/微信登录
- **THEN** 可在设置中切换登录方式，本地数据合并到云端账号

### Requirement: 同步模式切换
系统 SHALL 支持在「P2P 直连模式」和「服务器模式」之间切换。

#### Scenario: 从 P2P 切换到服务器模式
- **WHEN** 用户在设置中切换同步模式
- **THEN** 断开 P2P 连接，连接服务器，将本地数据全量同步到服务器

#### Scenario: 默认模式选择
- **WHEN** 用户首次启动 App
- **THEN** 提供「本地直连（推荐）」和「服务器同步」两个选项，默认选中本地直连

---

## MODIFIED Requirements

### Requirement: 用户配对绑定（原 Requirement）
原来：仅支持服务器端配对码机制。
修改后：新增二维码扫码配对方式，保留原有配对码方式作为服务器模式下的选项。

### Requirement: 用户认证系统（原 Requirement）
原来：仅支持 QQ/微信 OAuth 登录。
修改后：新增简易本地身份（昵称 + PIN 码），OAuth 登录作为可选扩展。

---

## REMOVED Requirements

无。所有现有功能保留，新方案为增量添加。