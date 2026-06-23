# 实时地图 & 相册"瞬" Spec

## Why
当前"之间"页面只显示文字距离，缺乏可视化地图的亲密感。用户希望在地图上看到双方头像和实时距离。同时需要"瞬"相册功能，记录异地恋中每个珍贵瞬间——上传照片+文字+位置，构建属于两个人的时光相册。

## What Changes
- **之间页面**新增嵌入式 Leaflet 小地图，显示双方头像标记、连线、距离
- 新增 **"瞬"（Moments）** 相册功能：含独立 tab、上传照片+文字+位置、时间线展示
- 新增 `Moment` 数据库模型，后端 Multer 图片上传 API
- 底部导航新增第6个 tab "瞬"
- **BREAKING**: 数据库 schema 变更（新增 Moment 表）

## Impact
- Affected specs: `refine-ui-flow`（之间页面布局变更）
- Affected code: `app.js`, `index.html`, `styles.css`, `prisma/schema.prisma`, `src/server.js`, `src/routes/`（新增 moments.js）, `src/frontend/socket.js`

## ADDED Requirements

### Requirement: 实时地图可视化
系统 SHALL 在"之间"页面中嵌入一个 Leaflet 互动小地图，显示双方位置标记、连接线和距离。

#### Scenario: 双方都有位置数据
- **WHEN** 双方的地理位置数据均已获取
- **THEN** 地图上显示两个标记点（用户头像/昵称首字），之间有一条虚线连接，并显示距离标签

#### Scenario: 只有一方有位置数据
- **WHEN** 仅有一方有位置数据
- **THEN** 地图上仅显示该方的标记点，不显示连线，距离显示为 "—"

#### Scenario: 双方都没有位置数据
- **WHEN** 双方都无位置数据
- **THEN** 地图显示默认世界视图，提示"等待双方开启定位"

#### Scenario: 地图交互
- **WHEN** 用户在地图上拖动或缩放
- **THEN** 地图响应交互，支持双指缩放和拖动

### Requirement: 位置实时更新到地图
系统 SHALL 在接收到 WebSocket `location:update` 事件时，自动更新地图上的标记位置和距离。

#### Scenario: 对方位置更新
- **WHEN** 通过 WebSocket 收到对方的新位置数据
- **THEN** 地图上对方标记平滑移动到新位置，距离数字更新

### Requirement: 相册"瞬"功能
系统 SHALL 提供"瞬"（Moments）功能，允许用户上传照片、配文，记录特定时刻。

#### Scenario: 创建瞬间
- **WHEN** 用户在"瞬"页面选择照片、填写文字描述
- **THEN** 系统上传照片到服务器，保存瞬间记录（含照片URL、文字、位置、时间），并实时同步给另一半

#### Scenario: 查看瞬间时间线
- **WHEN** 用户进入"瞬"页面
- **THEN** 系统按时间倒序展示双方发布的所有瞬间，每条包含照片、文字、位置、发布者和时间

#### Scenario: 瞬间详情
- **WHEN** 用户点击某条瞬间
- **THEN** 系统展示大图查看模式，显示完整文字和位置信息

#### Scenario: 删除瞬间
- **WHEN** 用户对自己发布的瞬间执行删除操作
- **THEN** 系统删除该瞬间及关联照片文件，同步通知对方

#### Scenario: 空状态
- **WHEN** 双方还没有发布过任何瞬间
- **THEN** 页面显示空状态引导："还没有瞬间，记录你们的第一个瞬间吧 ✦"

### Requirement: 底部导航扩展
系统 SHALL 在底部导航栏新增"瞬" tab。

#### Scenario: 导航切换
- **WHEN** 用户点击底部"瞬" tab
- **THEN** 切换到"瞬"视图，显示相册时间线

## MODIFIED Requirements

### Requirement: 之间页面布局
"之间"页面 SHALL 在原有距离卡片和纪念日列表之间插入嵌入式地图区域。

#### Scenario: 之间页面渲染
- **WHEN** 用户进入"之间"页面
- **THEN** 页面从上到下依次显示：距离卡片（含城市、距离、电量）→ 实时小地图 → 纪念日列表