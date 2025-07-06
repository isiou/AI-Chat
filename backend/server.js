const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = 3000;

// CORS 预留支持多环境配置，便于本地和生产切换
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // 允许本地和生产环境
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

app.post("/api/chat-stream", async (req, res) => {
  let clientClosed = false;
  res.on("close", () => {
    clientClosed = true;
    console.log("[INFO] 客户端连接已关闭，终止流式响应。");
  });
  try {
    const { message, history, apiKey } = req.body;
    if (!message || !apiKey) {
      return res
        .status(400)
        .json({ error: "Message and API Key are required." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const chat = model.startChat({
      history: history || [],
      generationConfig: {
        maxOutputTokens: 65535,
      },
    });

    const result = await chat.sendMessageStream(message);

    for await (const chunk of result.stream) {
      if (clientClosed) {
        break;
      }
      try {
        const chunkText = chunk.text();
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      } catch (error) {
        res.write("event: error\n");
        res.write(`data: ${JSON.stringify({ error: "流式数据处理异常" })}\n\n`);
        console.error("[ERROR] Error processing stream chunk:", error);
      }
    }

    if (!clientClosed) {
      const finalResponse = await result.response;
      const finishReason = finalResponse.candidates[0].finishReason;
      res.write("event: end\n");
      res.write(
        `data: ${JSON.stringify({
          message: "Stream ended",
          finishReason: finishReason,
        })}\n\n`
      );
      res.end();
      console.log("[INFO] Stream finished, reason:", finishReason);
    }
  } catch (error) {
    console.error("[ERROR] Error in stream chat API:", error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to start stream. Check API Key, network, and limits.",
      });
    } else {
      res.write("event: error\n");
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
