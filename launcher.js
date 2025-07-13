const { spawn } = require("child_process");
const { log } = require("console");
const path = require("path");

let mihomoProcess = null;
let appProcess = null;

// 启用 mihomo 代理
function startMihomo() {
  return new Promise((resolve, reject) => {
    const mihomoDir = path.join(__dirname, "core", "mihomo");
    const mihomoPath = path.join(mihomoDir, "mihomo");

    console.log("Launcher: 正在启用 mihomo 代理");
    mihomoProcess = spawn(mihomoPath, ["-d", mihomoDir]);

    mihomoProcess.stdout.on("data", (data) => {
      const message = data.toString();
      console.log(`[mihomo]: ${message.trim()}`);
      if (message.includes("TUN interface name")) {
        console.log("Launcher: 启用 mihomo 代理成功");
        resolve();
      }
    });

    mihomoProcess.stderr.on("data", (data) =>
      console.error(`[mihomo-err]: ${data.toString().trim()}`)
    );
    mihomoProcess.on("error", reject);
  });
}

// 后端入口
function startApp() {
  console.log("============启动后端============");
  appProcess = spawn("node", ["backend/server.js"], {
    stdio: "inherit",
  });

  appProcess.on("close", (code) => {
    console.log(`Launcher: 应用退出代码 ${code}`);
    cleanup();
  });
}

// 清理函数
function cleanup() {
  console.log("Launcher: ============启用清理============");
  if (appProcess) appProcess.kill();
  if (mihomoProcess) mihomoProcess.kill("SIGINT");
  setTimeout(() => process.exit(0), 500);
}

async function main() {
  try {
    log("Launcher: 启动中...");
    await startMihomo();
    startApp();
  } catch (error) {
    console.error("Launcher: 失败");
    console.log("Error:", error);

    cleanup();
  }
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

main();
