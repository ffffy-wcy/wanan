# Tasks

- [x] Task 1: 项目文件审查与分类：扫描根目录、src/frontend、src/routes、src/utils、www/，列出冗余/重复/未使用/敏感文件清单，并确认删除边界（不影响 Capacitor 构建）。
  - [x] SubTask 1.1: 根目录文件审查，识别 `gh.msi`、`wanan.jks`、`wanan.crt` 等不应纳入版本控制的文件。
  - [x] SubTask 1.2: 前端模块审查，识别未导出/未使用的函数与重复工具。
  - [x] SubTask 1.3: 后端路由与中间件审查，识别死代码与重复逻辑。
  - [x] SubTask 1.4: www/ 目录审查，确认与根目录源文件的对应关系，识别真正的重复产物。

- [x] Task 2: 移除无关与敏感文件：安全删除 `gh.msi`、`wanan.jks`、`wanan.crt`，并在 `.gitignore` 中补充规则防止再次提交；保留一份密钥库使用说明（不暴露密码）。
  - [x] SubTask 2.1: 删除上述文件。
  - [x] SubTask 2.2: 更新 `.gitignore`。
  - [x] SubTask 2.3: 验证删除后不影响构建命令 `npx cap sync` 与 `./gradlew assembleRelease`。

- [x] Task 3: 清理调试日志：删除 `src/frontend/socket.js`、`webrtc.js`、`pairing.js` 中的大量 `console.log` 调试日志，仅保留关键错误与状态变化日志。
  - [x] SubTask 3.1: 清理 `socket.js`。
  - [Task 3.2]: 清理 `webrtc.js`。
  - [x] SubTask 3.3: 清理 `pairing.js`。
  - [x] SubTask 3.4: 清理 `src/routes/pair.js` 中的快照日志。

- [x] Task 4: 删除死代码与废弃测试：移除 `test-smoke.js`、`tests.js` 等无法维护或已废弃的测试入口，若需保留测试能力则迁移为可运行的最小验证脚本。
  - [x] SubTask 4.1: 确认 `tests.js` / `test-smoke.js` 的当前状态与用途。
  - [x] SubTask 4.2: 删除或重构为最小化验证脚本。

- [x] Task 5: 简化重复与冗余代码：合并 `app.js` 中明显重复的 DOM 辅助函数、事件绑定片段；清理未使用的导入与变量。
  - [x] SubTask 5.1: 扫描 `app.js` 中的重复模式（toast/confirm/skeleton 等是否已在 utils 中存在）。
  - [x] SubTask 5.2: 合并或提取重复辅助函数。
  - [x] SubTask 5.3: 删除未使用的变量与函数。

- [x] Task 6: 修正 P2P/OAuth 流程边界：确保 `app.js` 的 `doInit` 在 P2P 模式下完全跳过 OAuth 相关检查，服务器模式下保持原有行为，并避免重复初始化。
  - [x] SubTask 6.1: 审查 `doInit` 与 `showOnboarding` 的调用关系。
  - [x] SubTask 6.2: 分离 P2P 与 OAuth 初始化路径。
  - [x] SubTask 6.3: 验证本地存储键与 `Store` 状态不冲突。

- [x] Task 7: 统一构建源文件同步：建立根目录源文件到 `www/` 的同步脚本/命令，确保后续 APK 构建不再打包旧代码。
  - [x] SubTask 7.1: 在 `package.json` 中新增 `sync:www` 脚本。
  - [x] SubTask 7.2: 验证同步后 `npx cap sync android` 正确复制新文件。

- [x] Task 8: 回归验证：运行 e2e /  smoke 检查，确认服务器模式登录、P2P 本地登录、页面渲染均正常，无新增报错。
  - [x] SubTask 8.1: 本地浏览器访问 `http://localhost:3000` 验证页面加载。
  - [x] SubTask 8.2: 验证 `app.js` 无语法错误。
  - [x] SubTask 8.3: 验证构建命令可成功生成 APK。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 1
- Task 6 depends on Task 1
- Task 7 depends on Task 5, Task 6
- Task 8 depends on Task 2, Task 3, Task 4, Task 5, Task 6, Task 7
