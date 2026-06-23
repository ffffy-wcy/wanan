# 项目代码审查与清理优化 Spec

## Why
随着 `p2p-webrtc-sync` 等功能的快速迭代，项目中积累了重复文件、调试日志、死代码和未使用资源。用户需要一次整体代码审查与清理，在不破坏现有服务器模式、OAuth 登录、P2P 本地直连等能力的前提下，精简代码并提升可维护性。

## What Changes
- 移除项目根目录下明显不应纳入版本控制的文件：`gh.msi`、`wanan.jks`、`wanan.crt`
- 清理开发期调试日志（`console.log` / `console.warn`），保留必要的错误提示与关键生命周期日志
- 扫描并删除未引用的文件、重复样板文件、废弃测试脚本
- 合并或简化明显重复的辅助函数/样式
- 修正 `app.js` 中 P2P 与 OAuth 流程的边界处理，避免二者逻辑穿插导致状态混乱
- 保持 `www/` 目录作为 Capacitor 构建入口的完整性，仅删除其中真正的重复产物

## Impact
- Affected specs: `p2p-webrtc-sync`, `rebuild-sync-auth`, `refine-ui-flow`, `live-map-moments`
- Affected code: `app.js`, `src/frontend/*.js`, `src/server.js`, `src/routes/*.js`, `styles.css`, 根目录静态文件
- Affected build artifacts: `www/`

## ADDED Requirements
### Requirement: 项目清理
The system SHALL remove files that are not part of the application source or build configuration and shall reduce non-essential console logging.

#### Scenario: 敏感/无关文件清理
- **WHEN** 审查根目录文件
- **THEN** `gh.msi`、`wanan.jks`、`wanan.crt` 等证书/安装包被移除（如确需保留证书应在 `.gitignore` 中忽略并移出版本目录）

#### Scenario: 调试日志清理
- **WHEN** 运行应用或打开浏览器控制台
- **THEN** 不再输出大量 `[WS]` / `[WebRTC]` / `[Pairing]` 调试日志，仅保留连接断开、关键错误等必要日志

#### Scenario: 死代码清理
- **WHEN** 扫描 `src/frontend`、`src/routes`、`src/utils` 及根目录
- **THEN** 未使用的函数、重复实现的工具、废弃的测试入口被识别并删除

## MODIFIED Requirements
### Requirement: P2P 与 OAuth 流程边界
P2P 模式下系统 SHALL 完全跳过 OAuth token 检查与服务器 room 初始化；服务器模式下 SHALL 保持原有 OAuth + room 流程不变。

### Requirement: 构建产物一致性
每次构建前 SHALL 保证 `www/` 中的前端文件与根目录源文件一致，避免 APK 打包旧代码。

## REMOVED Requirements
### Requirement: 调试级 console.log 噪音
**Reason**: 开发期日志已干扰问题定位并增加包体积/运行噪音。  
**Migration**: 保留 `console.error` 与少量关键状态日志即可。
