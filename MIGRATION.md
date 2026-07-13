# LoreLens 7.13 → 7.14 迁移说明

7.14 是从 7.13 独立复制并重新初始化 Git 的升级分支。`软件/lorelens7.13` 不会被构建、修改或删除。

## 升级前

1. 在 7.13 设置页导出历史，或备份浏览器站点数据。
2. 备份旧部署的环境变量；不要复制包含真实密钥的 `.env.local` 到压缩包或 Git。
3. 使用 Node.js 20.19+ 或 22.12+。
4. 在 7.14 目录重新执行 `npm install`，不要复用 7.13 的 `node_modules`。

## 自动本地数据迁移

应用首次加载时会自动执行以下兼容逻辑：

- 旧历史 `context_lens_history` → `lorelens_records_v2`。
- 合法旧历史记录迁移为 `AnalysisRecordV2` 的 `complete` 状态。
- 保留原有结果、时间、缩略图、坐标和地图链接。
- 没有坐标的旧记录保持地点未知，不补写任何默认城市。
- 旧设置 `context_lens_settings_zustand` → `lorelens_settings_v2`。
- 旧 `highResAudio` → `readAloudEnabled`，朗读由浏览器 `speechSynthesis` 完成。

迁移完成后，新写入均使用 V2 key 和 schema。建议迁移成功后立即从设置页导出一份新的 V2 JSON 备份。

## AnalysisRecordV2

每条记录包含：

- `schemaVersion: 2`
- 稳定 `id`
- `complete | pending | failed` 状态
- 可选压缩分析图片和缩略图
- 七语言代码
- 可选 `LocationSnapshot`
- 标准解读结果或类型化错误
- `createdAt` 和 `updatedAt`

离线完成裁剪时会保存 `pending` 记录。应用不会在网络恢复时自动上传；必须由用户在历史页点击“重试”。

## 备份导入合并

7.14 导出格式为 `schemaVersion: 2`。导入流程会：

1. 解析 JSON；
2. 使用 Zod 校验整个备份与每条记录；
3. 以记录 `id` 合并；
4. 同一 ID 保留 `updatedAt` 更新的一份；
5. 拒绝不完整、版本错误或字段非法的备份。

导出文件可能包含压缩照片和位置，请勿公开分享。

## 服务端 API 破坏性变更

旧接口已移除：

- `/api/gemini/decipher`
- `/api/gemini/daily-recap`
- `/api/gemini/tts`

新接口：

- `POST /api/ai/decipher`
- `POST /api/ai/recap`

前端结果契约保持为 `title`、`essence`、`mirrorInsight`、`philosophy`、`quickAction` 和可选 `mapUri`。AI 返回值现在必须通过运行时 schema 校验。

## Provider 与环境变量

7.14 默认组合：

- Qwen：图像解读
- DeepSeek：旅行回顾文字生成
- Gemini：可选备用

部署时从 [.env.example](./.env.example) 复制所需变量。API Key 只放在服务端；设置页不再提供密钥输入。

备用只在超时、429 和可恢复 5xx 时最多尝试一次。400、401、403、内容错误或 schema 错误不会自动回退。

## 定位行为变化

定位链现在是：

1. 高精度浏览器定位；
2. 低精度浏览器定位；
3. 上次有效位置；
4. 已配置的 `IP_LOCATION_URL` 粗略定位；
5. 明确的不可用状态。

地图无数据时显示全球视图。地图保留 Leaflet、OpenStreetMap 和 CARTO 署名。

## 部署步骤

```powershell
Copy-Item .env.example .env.local
npm install
npm run typecheck
npm test
npm run build
npm start
```

如已有 7.13 Service Worker，浏览器会在 7.14 构建发布后更新应用壳。若调试环境仍显示旧资源，可在浏览器站点设置中清除该站点的 Service Worker 和缓存后重新加载；不要清除生产用户数据作为常规升级步骤。

## 回滚

7.13 与 7.14 是独立目录，可以将反向代理重新指向 7.13 服务来回滚代码。V2 数据不会写回 7.13 schema，因此回滚前应保留 7.14 JSON 导出；不要让两个版本同时写同一个浏览器站点存储。
