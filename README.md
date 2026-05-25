Markdown# 🗺️ LoreLens (formerly Beijing Culture AI City Tour)

临场感、非线性的 AI 驱动城市文化导览与智能漫游助手。

[![GitHub license](https://img.shields.io/github/license/victoriag5tyjw7ehciuouc-droid/LoreLens?style=flat-square)](https://github.com/victoriag5tyjw7ehciuouc-droid/LoreLens/blob/main/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Android](https://img.shields.io/badge/Platform-Android%20%7C%20Python-blue?style=flat-square&logo=android)](https://developer.android.com)
[![LLM Powered](https://img.shields.io/badge/LLM-Gemini%20%7C%20GPT-orange?style=flat-square&logo=google-gemini)](https://ai.google.dev/)

> **让每一次城市漫游（City Walk），都变成一场量身定制的非线性文化探索。**
> 传统导览死板、千篇一律且缺乏深度。**LoreLens** 结合大语言模型（LLMs）与动态上下文检索，根据用户的步伐、兴趣与即时提问，实时生成兼具文学色彩与历史厚度的深度文旅故事线。

---

## 📱 核心特性 (Key Features)

* **🎙️ 动态非线性故事生成 (Non-linear Dynamic Narrative)**
    不再是死板的点对点打卡。AI 导游会根据你的路线选择、停留时间以及即时反馈，动态交织出一条独特的历史文化故事线。
* **🤖 多模态文化智能体 (Multimodal Culture Agent)**
    支持文字、语音甚至拍照识别历史建筑。拍下眼前的红墙砖瓦，AI 智能体即可深度剖析其背后的营造法式与历史变迁。
* **📍 空间感知与上下文检索 (Location-Aware RAG)**
    精准感知用户所处的空间几何位置，无缝融合本地文史数据库（Local Lore Base），拒绝大模型幻觉，提供真正准确的野史趣闻与正史考证。
* **✨ 沉浸式 UI/UX 设计 (Immersive Interface)**
    专为极客与摄影爱好者打造的简洁视觉，支持非线性探索进度图谱，让每一次出行都像在解密城市。

---

## 🏗️ 系统架构 (Architecture)

```text
[用户移动端 (Android/App)] 🌟 空间感知 & 多模态输入
          │
          ▼ (REST API / WebSocket)
[LoreLens 后端服务 (Python)]
          │
          ├──► [位置路由与上下文生成器] ──► 匹配 Local Lore DB (向量数据库)
          │
          └──► [大模型编排层 (Gemini/GPT API)] ──► Prompt 注入与流式故事生成

🛠️ 技术栈 (Tech Stack)模块 (Layer)技术选型 (Technologies)说明 (Description)FrontendJava / Kotlin / Android SDK丝滑的移动端交互与传感器数据采集BackendPython / FastAPI高并发、低延迟的 AI 编排与流式传输 (Streaming)AI ModelsGoogle Gemini API / OpenAI API核心文本理解、结构化 Prompt 生成与多模态视觉DatabaseVector DB (FAISS/Milvus) + SQLite沉浸式本地文史知识库检索与用户非线性足迹存储🚀 快速开始 (Quick Start)1. 克隆仓库Bashgit clone [https://github.com/Mickey-Wang-hub/LoreLens.git](https://github.com/Mickey-Wang-hub/LoreLens.git)
cd LoreLens
2. 后端配置与运行进入后端目录，配置环境变量并启动服务：Bashcd backend
pip install -r prerequisites.txt

# 创建并配置你的 .env 文件
echo "GEMINI_API_KEY=your_api_key_here" > .env
echo "DATABASE_URL=sqlite:///./lorelens.db" >> .env

# 启动 FastAPI 服务
uvicorn main:app --reload
3. 移动端构建使用 Android Studio 打开 frontend/ 目录。等待 Gradle 同步完成。将 config.json 中的 BASE_URL 改为你的后端服务地址（本地测试通常为 http://10.0.2.2:8000）。点击 Run 部署到你的测试手机或模拟器。💡 项目亮点与技术攻关 (Project Highlights)精心优化的 Prompt 工程： 克服了大模型表达“AI 腔”的问题，通过角色扮演（Role-Playing）与少量样本提示（Few-Shot Prompting），让 AI 具备了如同《非线性流浪者指南》般的人文叙事笔触。极致的 RAG 召回优化： 针对密集城市街区，设计了基于地理围栏（Geo-fencing）的多级向量检索机制，确保在移动端弱网环境下依然能秒级响应。独立开发落地： 实现了从算法设计、Prompt 调优到移动端全栈闭环的完整工程落地。🤝 参与贡献 (Contributing)我们非常欢迎各种形式的贡献！无论是提交 Bug、想法（Issues），还是直接合并代码（Pull Requests）：Fork 本仓库创建特性分支 (git checkout -b feature/AmazingFeature)提交更改 (git commit -m 'Add some AmazingFeature')推送到分支 (git push origin feature/AmazingFeature)提交 Pull Request📄 开源协议 (License)本项目基于 MIT License 协议开源。💡 LoreLens 正在持续进化中。如果你喜欢这个将大模型与城市浪漫结合的创意，请给项目点一个 ⭐ Star，这是对独立开发者最大的鼓励！
