<template>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <h1>AI 聊天</h1>
        <p>基于 Google AI (Gemini)</p>
      </div>
      <button id="new-chat-btn" title="开始新对话" @click="startNewChat">
        新对话
      </button>
    </div>
    <div class="api-key-container">
      <div class="api-key-header">
        <label for="api-key-input">Gemini API Key:</label>
        <button class="clear-btn" @click="clearApiKey">清除</button>
      </div>
      <input
        type="password"
        id="api-key-input"
        placeholder="在此输入你的 API Key"
        v-model="apiKey"
      />
    </div>

    <div class="chat-window" id="chat-window" ref="chatWindowRef">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.isUser ? 'user-message' : 'ai-message']"
      >
        <div
          v-if="!msg.isUser"
          v-html="
            renderMarkdown(msg.content) +
            (isLoading && index === messages.length - 1
              ? '<span class=\'blinking-cursor\'></span>'
              : '')
          "
        ></div>
        <span v-else>{{ msg.content }}</span>
      </div>
    </div>

    <form id="chat-form" class="chat-form" @submit.prevent="sendMessage">
      <input
        type="text"
        id="message-input"
        :placeholder="isLoading ? 'AI 正在回复中...' : '输入你的消息...'"
        autocomplete="off"
        v-model="newMessage"
      />
      <button
        type="submit"
        id="send-btn"
        aria-label="发送"
        :disabled="isLoading"
      >
        <svg
          v-if="!isLoading"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        </svg>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

const apiKey = ref("");
const newMessage = ref("");
const messages = ref([]);
const chatHistory = ref([]);
const isLoading = ref(false);
const chatWindowRef = ref(null);

const STORAGE_KEY = "google_ai_api_key";

onMounted(() => {
  const savedKey = localStorage.getItem(STORAGE_KEY);
  if (savedKey) {
    apiKey.value = savedKey;
  }
  startNewChat();
});

watch(apiKey, (newKey) => {
  localStorage.setItem(STORAGE_KEY, newKey);
});

const clearApiKey = () => {
  apiKey.value = "";
  localStorage.removeItem(STORAGE_KEY);
  alert("已保存的 API Key 已被清除");
};

const renderMarkdown = (content) => {
  if (!content) return "";
  return DOMPurify.sanitize(marked.parse(content));
};

let scrollTimeout = null;
const throttledScrollToBottom = () => {
  if (scrollTimeout) return;
  scrollTimeout = setTimeout(() => {
    scrollToBottom();
    scrollTimeout = null;
  }, 100);
};

const scrollToBottom = async () => {
  await nextTick();
  const chatWindow = chatWindowRef.value;
  if (chatWindow) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
};

const startNewChat = () => {
  messages.value = [];
  chatHistory.value = [];
  isLoading.value = false;
  messages.value.push({
    content: "你好！有什么可以帮助你的吗？",
    isUser: false,
  });
};

const sendMessage = async () => {
  if (isLoading.value) return;

  const messageContent = newMessage.value.trim();
  if (!messageContent) return;
  const currentApiKey = apiKey.value.trim();
  if (!currentApiKey) {
    alert("请输入你的 Google AI API Key");
    return;
  }

  messages.value.push({ content: messageContent, isUser: true });
  chatHistory.value.push({ role: "user", parts: [{ text: messageContent }] });
  const currentMessageForHistory = messageContent;
  newMessage.value = "";
  isLoading.value = true;
  messages.value.push({ content: "", isUser: false });
  throttledScrollToBottom();

  try {
    const response = await fetch("http://localhost:3000/api/chat-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: currentMessageForHistory,
        history: chatHistory.value,
        apiKey: currentApiKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "无法解析的服务器错误" }));
      alert(errorData.error || "服务器返回错误");
      isLoading.value = false;
      messages.value.pop();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = "";
    let streamEnded = false;

    while (!streamEnded) {
      const { done, value } = await reader.read();
      if (done) {
        streamEnded = true;
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (!line) continue;

        if (line.startsWith("event: end")) {
          const dataStr = line.substring(line.indexOf("data:") + 5).trim();
          try {
            const endData = JSON.parse(dataStr);
            console.log("Stream ended with reason:", endData.finishReason);
            if (endData.finishReason === "MAX_TOKENS") {
              messages.value[messages.value.length - 1].content +=
                "\n\n**[提示：回复因达到最大长度而被截断]**";
            } else if (endData.finishReason === "SAFETY") {
              messages.value[messages.value.length - 1].content +=
                "\n\n**[提示：回复因内容安全问题被中断]**";
            }
          } catch (e) {
            console.error("Could not parse end event data:", dataStr, e);
          }

          streamEnded = true;
          break;
        } else if (line.startsWith("data:")) {
          const dataStr = line.substring(5).trim();
          try {
            const data = JSON.parse(dataStr);
            if (data.text) {
              fullReply += data.text;
              messages.value[messages.value.length - 1].content = fullReply;
              throttledScrollToBottom();
            }
          } catch (e) {
            console.error("Could not parse data chunk:", dataStr, e);
          }
        } else if (line.startsWith("event: error")) {
          const dataStr = line.substring(line.indexOf("data:") + 5).trim();
          try {
            const errorData = JSON.parse(dataStr);
            alert(errorData.error || "来自服务器的流错误");
            isLoading.value = false;
            messages.value[messages.value.length - 1].content =
              `出错了：${errorData.error}`;
            chatHistory.value.pop();
            streamEnded = true;
            break;
          } catch (e) {
            alert("来自服务器的无法解析的流错误");
            isLoading.value = false;
            messages.value[messages.value.length - 1].content =
              `出错了：无法解析服务器错误`;
            chatHistory.value.pop();
            streamEnded = true;
            break;
          }
        }
      }
    }

    isLoading.value = false;

    if (fullReply) {
      chatHistory.value.push({
        role: "model",
        parts: [{ text: fullReply }],
      });
    }
  } catch (error) {
    console.error("流式请求失败：", error);
    isLoading.value = false;
    alert(error.message || "请求失败");
    messages.value[messages.value.length - 1].content =
      `出错了：${error.message}`;
    chatHistory.value.pop();
  }
};
</script>
