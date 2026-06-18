你当前运行在一台开发的服务器上吗，公网 ip 是：34.71.45.249，端口都开放，当你部署服务的时候应该返回公网 ip 地址的访问链接，服务必须启动在 3000 端口。

/home/4dtc/Macaron_3.0 是你的工作目录。

核心技术栈

   层             技术  
  ━━━━━━━━━━━━━  
   包管理/运行    Bun workspace，lib/* 是本地 workspace packages  
  ─────────────  
   Web 框架       Astro 7 beta，output: "server"，Vercel adapter  
  ─────────────  
   前端 UI        React 19，Astro pages + React client islands  
  ─────────────  
   构建           Vite 8，经 Astro 集成  
  ─────────────  
   样式           UnoCSS 66，Wind3 preset，动画 preset，少量全局 CSS  
  ─────────────  
   组件体系       本地 $macaron/ui primitives + src/components/ui/*，Radix UI、lucide-react、recharts、katex、motion 等

你常用的 icon 库是：[https://icons.lobehub.com/](https://icons.lobehub.com/)



**部署规范**

给用户提供访问链接时，**永远不要用 dev server（astro dev / vite dev）**。Dev server 的 HMR WebSocket、模块热更新和 `/@vite/client` 依赖在外网/代理环境下会失败，导致页面空白。

正确流程：

1. 先执行 `astro build`（或对应的 build 命令）生成 `dist/` 目录
2. 用 `npx serve dist -l 3000 -s` 或等效静态文件服务器来 serve production build
3. 确保 HTML 中包含 **loading fallback**（纯 HTML/CSS，不依赖 JS），这样即使 JS 加载慢或失败用户也能看到内容
4. 确保 React 入口有 **Error Boundary** 和 **try/catch**，出错时显示信息而不是空白
5. 用 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` 验证返回 200
6. 用 `curl` 检查 CSS 和 JS 资源文件也返回 200
7. 验证全部通过后再把公网链接给用户

一句话总结：**build → serve static → verify → share link**，永远不要 `dev → share link`。

**服务进程管理**

重启 server 前，**必须先用 `fuser -k 3000/tcp` 杀掉旧进程**，否则旧进程仍然占用端口，新 server 启动失败或新代码不生效。完整重启流程：

```bash
fuser -k 3000/tcp 2>/dev/null; sleep 1; bun run server.ts &disown
```

常见坑：改了 server.ts 后 build + 启动新进程，但忘记杀旧进程 → 请求仍然打到旧进程 → 新代码不生效、API 返回 HTML 等诡异表现。