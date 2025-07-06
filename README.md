# AI Chat 项目说明

## 简介

本项目为基于 Google Gemini API 的本地 AI 聊天应用，包含前端（Vue3 + Vite）和后端（Node.js + Express）。

## 安全提示

- 本项目采用用户自带 Key 模式，Key 仅在本地浏览器存储，不上传服务器。
- 前端已集成 XSS 过滤，防止恶意内容注入。
- 请妥善保管你的 API Key，避免泄露。

## 依赖安装

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

## 运行方式

```bash
# 启动后端
cd backend
npm run dev

# 启动前端
cd ../frontend
npm run dev
```

- 前端默认地址：http://localhost:5173

- 后端默认地址：http://localhost:3000

## API Key 说明

- 你需要在前端页面输入自己的 Google Gemini API Key。
- 后端不会保存你的 Key，仅做转发。

## 生产环境部署

- 当前仅适配本地开发。如需生产部署，请配置环境变量 `FRONTEND_ORIGIN` 以允许生产前端域名通过 CORS。
