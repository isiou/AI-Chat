const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");

const app = express();
const port = 3000;

const corsOptions = {
  origin: "http://localhost:5173",
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

app.post("/api/chat-stream", async (req, res) => {
  try {
    const { message, history, apiKey } = req.body;
    if (!message || !apiKey)
      return res
        .status(400)
        .json({ error: "Message and API Key are required." });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const chat = model.startChat({
      history: history || [],
      generationConfig: {
        maxOutputTokens: 2000,
      },
    });

    const result = await chat.sendMessageStream(message);

    for await (const chunk of result.stream) {
      try {
        const chunkText = chunk.text();
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      } catch (error) {
        console.error("Error processing stream chunk:", error);
      }
    }

    console.log("Stream finished, awaiting final response...");
    const finalResponse = await result.response;
    const finishReason = finalResponse.candidates[0].finishReason;
    console.log("Finish Reason:", finishReason);

    res.write("event: end\n");
    res.write(
      `data: ${JSON.stringify({
        message: "Stream ended",
        finishReason: finishReason,
      })}\n\n`
    );

    res.end();
  } catch (error) {
    console.error("Error in stream chat API:", error.message);
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
