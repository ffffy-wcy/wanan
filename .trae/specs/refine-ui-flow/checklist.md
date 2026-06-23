# Checklist

## 时光墙删除
- [x] `src/routes/wall.js` 文件已删除
- [x] `src/server.js` 中 wall 路由挂载已移除
- [x] `src/sync.js` 中 wall 相关 WebSocket 事件已移除
- [x] `index.html` 中时光墙 Tab 和页面内容已移除
- [x] `app.js` 中 wall 渲染和绑定逻辑已移除
- [x] `styles.css` 中 wall 相关样式已移除
- [x] TabBar 导航已更新（去掉时光墙标签）
- [x] `prisma/schema.prisma` 中 WallEntry 模型已移除
- [x] Room 模型中 wallEntries 关系已移除
- [x] 数据库迁移已执行，WallEntry 表已删除

## 引导流程
- [x] 品牌页 → 登录页 → 个人信息 → 配对页 → 主界面流程正确
- [x] 个人信息页包含昵称、生日、在一起日期三个字段
- [x] 登录成功后自动跳转个人信息页
- [x] 个人信息完成后跳转配对页
- [x] 已登录无配对用户直接进入个人信息/配对页
- [x] User 模型有 `birthday String?` 字段
- [x] `/api/auth/profile` 端点支持 birthday 更新

## 电量精准读取
- [x] 30 秒轮询作为兜底已实现
- [x] `levelchange` 事件监听保留
- [x] `chargingchange` 事件监听保留
- [x] 进入主界面后立即执行一次读取

## 自动实时定位
- [x] 进入主界面后自动调用 `navigator.geolocation`
- [x] `watchPosition` 持续监听位置变化
- [x] 位置变化时自动上报到后端
- [x] 手动"一键定位"按钮已删除
- [x] 定位拒绝时显示友好提示

## 整合验证
- [x] 完整引导流程可在浏览器中走通
- [x] 主页所有功能正常（天数、状态、心愿、之间、心情、设置）
- [x] 时光墙已完全移除
- [x] 定位自动启动正常
- [x] 电量精准读取正常