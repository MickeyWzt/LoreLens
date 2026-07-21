# LoreLens 7.14

LoreLens 是面向全球旅行场景的文化解读 PWA。用户可以拍照或选择本地照片、调整关注区域，并获得与画面相关的文化线索、观察提示和行动建议。

7.14 保留了原有的沉浸式深色界面、玻璃卡片和相机体验，同时重构了扫描状态、AI 服务、定位、历史数据、离线能力、国际化、无障碍和生产服务器。

## 主要能力

- 扫描状态机：主页、相机、裁剪、分析、结果、错误和待处理状态互斥，离开页面会取消过期分析请求。
- 多 AI Provider：默认使用 Qwen 识图、DeepSeek 生成文字总结，可配置 Gemini 为备用。
- 自然朗读：中文和英文使用小米 `mimo-v2.5-tts` 精品音色；其他语言、离线或云端故障时自动回退到设备语音。
- 安全服务端：API Key 只保存在服务端环境变量中；包含 10 MB 请求限制、超时、速率限制、安全响应头、请求 ID 和不记录请求正文的结构化日志。
- 可靠定位：高精度 GPS → 低精度 GPS → 上次有效位置 → 可选 IP 粗略位置 → 明确不可用，不会伪造默认城市。
- 定位辅助默认开启：相机拍摄时刷新并绑定设备定位；上传 JPEG 优先读取照片自身的 EXIF GPS，没有 EXIF 时不会冒用当前地点。
- AI 定位交叉验证：完整传递坐标、精度、来源、时间与附近 POI；视觉和定位冲突或疑似仿制品时不生成确定地图链接。
- 本地优先记录：分析图片经过压缩后保存在浏览器本地；离线裁剪会生成待处理记录，只有用户主动重试才会上传。
- 版本化备份：支持 V2 JSON 导出、schema 校验导入和按记录 ID/更新时间合并。
- PWA：字体、样式、脚本和应用壳本地缓存；地图与远程背景图使用受控运行时缓存。
- 七种语言：简体中文、英语、日语、西班牙语、法语、俄语和阿拉伯语，包含 RTL、键盘操作、减少动效和安全区适配。

## 运行要求

- Node.js 20.19+ 或 22.12+
- npm 10+
- 现代 Chromium、Safari 或 Firefox 浏览器
- 至少配置一个图像 AI Provider 才能进行真实图片解读

## 本地开发

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

默认地址为 `http://localhost:3000`。请在 `.env.local` 中填入需要的密钥；不要把该文件提交到 Git。

最小推荐配置：

```dotenv
VISION_PROVIDER=qwen
QWEN_API_KEY=your_qwen_key
TEXT_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_key
MIMO_API_KEY=your_mimo_key
```

Qwen 负责单张图片解读；DeepSeek 只在用户主动生成“共鸣回顾”时处理文字记录。未配置 AI 时，应用仍可启动并验证相机、裁剪、离线记录、历史、地图和设置，分析操作会显示明确的“服务尚未配置”状态。

## 环境变量

完整模板见 [.env.example](./.env.example)。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | Express/Vite 开发服务器端口 |
| `VISION_PROVIDER` | `qwen` | 图像 Provider：`qwen` 或 `gemini` |
| `QWEN_API_KEY` / `DASHSCOPE_API_KEY` | 空 | Qwen/DashScope 服务端密钥 |
| `QWEN_VISION_MODEL` | `qwen-vl-max-latest` | Qwen 视觉模型 |
| `QWEN_BASE_URL` | DashScope compatible-mode v1 | OpenAI 兼容 Base URL |
| `TEXT_PROVIDER` | `deepseek` | 文字 Provider：`deepseek` 或 `gemini` |
| `DEEPSEEK_API_KEY` | 空 | DeepSeek 服务端密钥 |
| `DEEPSEEK_TEXT_MODEL` | `deepseek-chat` | DeepSeek 文字模型 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | DeepSeek Base URL |
| `GEMINI_API_KEY` | 空 | Gemini 主 Provider 或备用 Provider 密钥 |
| `VISION_FALLBACK_PROVIDER` | `gemini` | 图像备用 Provider；仅可恢复错误时最多调用一次 |
| `TEXT_FALLBACK_PROVIDER` | `gemini` | 文字备用 Provider；仅可恢复错误时最多调用一次 |
| `AI_TIMEOUT_MS` | `30000` | 单次上游请求超时，范围 1000–120000 ms |
| `MIMO_API_KEY` | 空 | 小米 MiMo TTS 服务端密钥；为空时全部使用设备语音 |
| `MIMO_TTS_MODEL` | `mimo-v2.5-tts` | 小米内置精品音色模型 |
| `MIMO_BASE_URL` | `https://api.xiaomimimo.com/v1` | 小米 MiMo API Base URL |
| `MIMO_TTS_TIMEOUT_MS` | `30000` | 单次语音生成超时，范围 1000–120000 ms |
| `MIMO_TTS_VOICE_ZH` / `MIMO_TTS_VOICE_EN` | `茉莉` / `Mia` | 中英文预设音色 |
| `UNSPLASH_ACCESS_KEY` | 空 | 可选动态城市背景图；为空时使用缓存或品牌渐变 |
| `IP_LOCATION_URL` | 空 | 可选粗略 IP 定位 JSON 地址，需返回经纬度字段 |

备用 Provider 只会在超时、HTTP 429 或可恢复的 5xx 错误时尝试一次。参数错误、内容错误和 schema 错误不会自动重复计费。

## 生产构建

```powershell
npm run typecheck
npm test
npm run build
npm start
```

`npm run build` 会生成前端资源、Service Worker 和 `dist/server.cjs`。`npm start` 从 `dist` 提供生产静态资源与 API；可以通过 `PORT` 更改监听端口。

反向代理需保留 HTTPS、`X-Request-ID` 和正常的流式请求语义。相机、定位、Service Worker 和剪贴板等能力在非 localhost 环境通常要求 HTTPS。

## API

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/health` | 返回可用能力，不返回密钥或模型凭据 |
| `POST /api/ai/decipher` | 解读一张 data URL 图片，返回标准 LoreLens 结果 |
| `POST /api/ai/recap` | 根据本地记录生成旅行回顾 |
| `POST /api/tts/speech` | 使用服务端小米 MiMo 为中英文生成 WAV 朗读音频 |
| `GET /api/location/reverse` | 将坐标转换为可读地点标签 |
| `GET /api/location/ip` | 使用已配置的 IP 定位服务返回粗略位置 |
| `GET /api/background` | 获取按“地点 + 时间段”缓存的 Unsplash 背景 |
| `POST /api/background/download` | 按 Unsplash 规则记录下载事件 |

错误响应统一为：

```json
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "The service is temporarily unavailable.",
    "retryable": true,
    "requestId": "..."
  }
}
```

## 本地数据与隐私

- 设置键：`lorelens_settings_v2`
- 记录键：IndexedDB/localForage 中的 `lorelens_records_v2`
- 定位缓存键：`lorelens_location_v2`
- 背景缓存前缀：`lorelens_background_v2:`
- AI Key 不会写入浏览器、本地历史、导出文件或日志。
- 离线照片不会自动上传；联网后必须由用户点击“重试”。
- JSON 导出可能包含用户选择保存的压缩照片和地点，因此应按私人备份处理。

从 7.13 升级时的数据兼容和 API 变更见 [MIGRATION.md](./MIGRATION.md)。

## 项目结构

```text
components/            页面与交互组件
domain/                Zod schema、状态机、裁剪与记录逻辑
services/              浏览器端 AI、定位、背景图和朗读服务
server/                Express API、Provider、缓存和定位服务
store/                 设置、历史与应用上下文状态
public/locales/        七种语言资源
tests/                 Vitest、RTL 和 API 集成测试
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器和 Vite 中间件 |
| `npm run typecheck` | 运行 TypeScript 检查 |
| `npm test` | 运行全部 Vitest 测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run build` | 构建生产客户端、PWA 和服务端 |
| `npm start` | 启动已构建的生产服务 |

## 验收基线

- TypeScript 检查通过
- 21 个测试文件、69 项测试通过
- 生产主入口 chunk 约 278 KB，地图、历史和设置按需加载
- `npm audit --audit-level=high` 无 high/critical 漏洞
- 已在 390×844、430×932 和 1440×900 的真实 Chromium 浏览器中验证核心流程
