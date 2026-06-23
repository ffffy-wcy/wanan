# Checklist

## Phase 1: 本地存储与身份认证

- [x] IndexedDB 数据库正确创建，包含所有 Object Stores（wallEntries、wishes、anniversaries、moods、locations、moments、settings、syncMeta）
- [x] `localDB.getAll/get/put/delete` 操作正常工作
- [x] `localDB.exportAll` 能导出完整 JSON 数据快照
- [x] `localDB.importAll` 能正确导入 JSON 数据
- [x] 旧版 localStorage 数据自动迁移到 IndexedDB
- [x] 本地登录页正确显示：昵称输入 + PIN 码设置
- [x] 首次创建身份后 PIN 码正确存储并验证
- [x] 再次打开 App 时要求输入 PIN 码验证
- [x] 错误 PIN 码被拒绝，正确 PIN 码进入主界面
- [x] 本地身份信息在 localStorage 中安全存储

## Phase 2: P2P WebRTC 核心

- [x] RTCPeerConnection 使用 STUN 服务器正确创建
- [x] Offer SDP 正确生成并可通过文本传输
- [x] Answer SDP 正确生成并完成握手
- [x] Data Channel 成功建立，消息可双向收发
- [x] 连接成功时触发 `onConnect` 回调
- [x] 连接断开时触发 `onDisconnect` 回调
- [x] ICE candidate 正确收集和交换
- [x] 二维码正确生成并包含完整 SDP 数据
- [x] 摄像头扫码正确解析 QR 码中的 SDP
- [x] 双向扫码完成配对握手
- [x] 配对成功后 peer identity 正确持久化存储
- [x] 页面刷新后自动尝试重连已配对 peer

## Phase 3: 数据同步协议

- [x] 同步消息格式定义明确，包含 type/store/action/payload/timestamp/syncId
- [x] 本地数据变更后自动通过 Data Channel 发送给对端
- [x] 收到对端数据变更后正确写入本地 IndexedDB
- [x] 首次配对后全量同步正常工作
- [x] 增量同步基于 lastSyncAt 正确过滤变更
- [x] 冲突数据正确检测并以 updatedAt 为准解决
- [x] 冲突数据保留在 _conflicts 中供用户查看
- [x] 离线队列在连接恢复后自动重发
- [x] P2P 模式下时光墙功能正常（添加、删除、同步）
- [x] P2P 模式下心愿功能正常（添加、勾选、删除、同步）
- [x] P2P 模式下纪念日功能正常（添加、同步）
- [x] P2P 模式下心情打卡功能正常（打卡、同步）
- [x] P2P 模式下位置共享功能正常

## Phase 4: UI 与体验

- [x] Onboarding 页面显示模式选择：「本地直连（推荐）」和「服务器同步」
- [x] 设置页显示当前同步模式和连接状态
- [x] 模式切换流程正确：确认 → 断开 → 初始化
- [x] P2P 连接状态指示器正确显示四种状态
- [x] 手动重连按钮可用
- [x] Android WebView 中 WebRTC 正常工作
- [x] Android WebView 中摄像头扫码正常工作
- [x] NAT 穿透失败时显示友好提示和替代方案
- [x] 数据导入/导出 JSON 文件功能正常（兜底方案）
- [x] 服务器模式（原有功能）不受影响，仍可正常使用

## 回归验证

- [x] 服务器模式下的所有现有功能不受影响
- [x] 现有 UI 视觉风格保持一致
- [x] 现有 E2E 测试（e2e-test.js）全部通过