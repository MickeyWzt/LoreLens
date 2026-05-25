没问题！我注意到了你在复制时，后半部分的表格、列表和代码块有些格式错位（合并到了一起）。

这里为你送上**完全修复、精准对接你当前 React/TypeScript 全栈架构**的纯净版 `README.md` 源码。我把顶部的 Badges 链接更新为了你的全新账号 `Mickey-Wang-hub`，并将技术栈和启动步骤修正为了你实际项目中的前端组件与 `server.ts` 结构。

你可以直接点击代码块右上角的 **Copy**，然后全文覆盖到你的 GitHub `README.md` 中：

```markdown
# 🗺️ LoreLens

临场感、非线性的 AI 驱动城市文化导览与智能漫游助手。

[![GitHub license](https://img.shields.io/github/license/Mickey-Wang-hub/LoreLens?style=flat-square)](https://github.com/Mickey-Wang-hub/LoreLens/blob/main/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Platform](https://img.shields.io/badge/Platform-TypeScript%20%7C%20React-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![LLM Powered](https://img.shields.io/badge/LLM-Gemini%20%7C%20GPT-orange?style=flat-square&logo=google-gemini)](https://ai.google.dev/)

> **让每一次城市漫游（City Walk），都变成一场量身定制的非线性文化探索。**
> 传统导览死板、千篇一律且缺乏深度。**LoreLens** 结合大语言模型（LLMs）与动态上下文检索，根据用户的步伐、兴趣与即时提问，实时生成兼具文学色彩与历史厚度的深度文旅故事线。

---

## 📱 核心特性 (Key Features)

* **🎙️ 动态非线性故事生成 (Non-linear Dynamic Narrative)**
  不再是死板的点对点打卡。AI 导游会根据你的路线选择、停留时间以及即时反馈，动态交织出一条独特的历史文化故事线。
* **🤖 多模态文化智能体 (Multimodal Culture Agent)**
  支持文字、语音甚至拍照识别历史建筑。结合 Unsplash API 与大模型视觉能力，深度剖析眼前的景观变迁。
* **📍 空间感知与上下文检索 (Location-Aware RAG)**
  精准感知用户所处的空间几何位置，无缝融合本地文史数据库（Local Lore Base），拒绝大模型幻觉，提供真正准确的野史趣闻与正史考证。
* **✨ 沉浸式 UI/UX 设计 (Immersive Interface)**
  专为极客与摄影爱好者打造的简洁视觉，支持非线性探索进度图谱，让每一次出行都像在解密城市。

---

## 🏗️ 系统架构 (Architecture)

```text
[用户客户端 (React / App.tsx)] 🌟 空间感知 & 多模态输入
             │
             ▼ (REST API / WebSocket)
[LoreLens 后端服务 (Node.js / server.ts)]
             │
             ├──► [位置路由与上下文生成器] ──► 匹配 Local Lore DB
             │
             └──► [大模型编排层 (Gemini API)] ──► Prompt 注入与流式故事生成

```

---

## 🛠️ 技术栈 (Tech Stack)

| 模块 (Layer) | 技术选型 (Technologies) | 说明 (Description) |
| --- | --- | --- |
| **Frontend** | React / TypeScript / Vite | 响应式全栈交互、多语言支持 (`i18n.ts`) 与状态管理 |
| **Backend** | Node.js / TypeScript (`server.ts`) | 高并发、低延迟的 AI 状态编排与数据流传输 |
| **AI & Media** | Google Gemini API / Unsplash API | 核心文本理解、结构化 Prompt 生成与多模态视觉对齐 |
| **Data Flow** | Context / Store (`src/store`) | 全局上下文、历史记录管理与非线性足迹存储 |

---

## 🚀 快速开始 (Quick Start)

### 1. 克隆仓库

```bash
git clone [https://github.com/Mickey-Wang-hub/LoreLens.git](https://github.com/Mickey-Wang-hub/LoreLens.git)
cd LoreLens

```

### 2. 配置环境变量

在项目根目录下创建一个 `.env` 文件（可参考 `.env.example`）：

```bash
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here

```

### 3. 安装依赖与启动

```bash
# 安装项目依赖
npm install

# 启动本地开发服务器
npm run dev

```

打开浏览器访问 `http://localhost:3000` 即可开始探索。

---

## 💡 项目亮点与技术攻关 (Project Highlights)

* **精心优化的 Prompt 工程**：克服了大模型表达“AI 腔”的问题，通过角色扮演（Role-Playing）与少量样本提示（Few-Shot Prompting），让 AI 具备了如同《非线性流浪者指南》般的人文叙事笔触。
* **极致的 RAG 召回优化**：针对密集城市街区，设计了多级向量检索机制，确保在弱网环境下依然能秒级响应。
* **干净的 TypeScript 全栈落地**：实现了从算法设计、Prompt 调优到前端状态管理（Store）的全栈闭环工程。

---

## 🤝 参与贡献 (Contributing)

我们非常欢迎各种形式的贡献！无论是提交 Bug、想法（Issues），还是直接合并代码（Pull Requests）：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 开源协议 (License)

本项目基于 [MIT License](https://www.google.com/search?q=LICENSE) 协议开源。

---

💡 *LoreLens 正在持续进化中。如果你喜欢这个将大模型与城市浪漫结合的创意，请给项目点一个 **⭐ Star**，这是对独立开发者最大的鼓励！*

