
# Balance Window

Balance Window 是一个“本地优先”的个人资金未来推演工具，同时维护公开的 Web 版本和原生 iOS 版本。它根据当前余额和用户已知的工资、账单及计划支出，推演未来余额走势和可能的最低点。

> 品牌状态：当前品牌为 **Balance Window**，目标 App Store 名称为 **Balance Window: Cash Flow**。`FutureMoney` 仅作为仓库路径、生产 Bundle ID、Cloudflare 地址和历史记录中的技术身份保留；本次迁移不保留旧业务数据兼容逻辑。唯一品牌事实源见 [`docs/69-Balance Window品牌事实源与历史名称迁移规范.md`](./docs/69-Balance%20Window品牌事实源与历史名称迁移规范.md)；迁移进度见 [`docs/71-Balance Window品牌迁移执行记录.md`](./docs/71-Balance%20Window品牌迁移执行记录.md)。

## 版本目录

```text
FutureMoney/       # 历史仓库/技术目录名；当前品牌为 Balance Window
├── web/       # 公开 Web 版本：React + TypeScript + Vite + Pages Functions
├── ios/       # 原生 iOS 版本：SwiftUI + Apple 登录 + 云同步
├── docs/      # 产品、算法、Web 运维、iOS 方案和验收记录
└── wrangler.jsonc
```

Web 源码继续保留在公开仓库中，不引入私有子模块或访问限制。Web 的历史实现、公开 API 设计和生产运维文档也继续开放；Apple 私钥、Cloudflare Secret、Session Cookie 和用户财务数据永远不进入仓库。

## Web 版本

Web 源码与工具链位于 [`web/`](./web/)，当前已验证的公开体验地址仍为 <https://future-money.pages.dev>。这是历史技术 URL，不表示当前品牌仍为 FutureMoney，也不应据此虚构尚未部署的 Balance Window 域名。

```bash
npm install
npm run dev
npm test
npm run build
npm run dev:pages
```

根目录命令是 Web workspace 的兼容入口，实际代码、测试和 Pages Functions 均在 `web/`。Cloudflare Pages 的输出目录为 `web/dist/`，根目录 `wrangler.jsonc` 保留 D1 和 Pages 项目配置。

## iOS 版本

原生工程位于 [`ios/BalanceWindowIOS/BalanceWindowIOS.xcodeproj`](./ios/BalanceWindowIOS/BalanceWindowIOS.xcodeproj)。工程和源码已切换为 Balance Window 语义命名；生产 Bundle ID 仍保持 `com.ponzio.futuremoney`。它不使用 WebView，与 Web 版本共享服务端数据协议，但使用独立 SwiftUI 界面。

- Bundle ID：`com.ponzio.futuremoney`；
- 登录：Apple only；
- 免费版：最多两个资金账户；
- 云同步：复用 `/api/v1/vault` 加密快照；
- 首版功能上限：最多两个资金账户；不包含 AI、小组件、订阅和广告。

真机 Apple 登录和生产配置的最新进度见 [`docs/19-iOS登录生产配置与真机测试记录.md`](./docs/19-iOS登录生产配置与真机测试记录.md)。

## 文档

从 [`docs/69-Balance Window品牌事实源与历史名称迁移规范.md`](./docs/69-Balance%20Window品牌事实源与历史名称迁移规范.md) 和 [`docs/README.md`](./docs/README.md) 开始。品牌、版本边界、生产配置和验收记录统一从那里进入。

## 开源边界

本仓库的 Web 版本继续作为公开代码维护。整理目录不改变 Web 的公开属性，也不把 iOS 生产凭据或服务端 Secret 放入公开代码。iOS 源码是否随公开仓库发布，以产品负责人最终的发布边界决定；无论公开与否，真实凭据、用户数据和部署权限始终保留在本机/云平台的安全配置中。
