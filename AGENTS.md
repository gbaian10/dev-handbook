# AGENTS.md

給 AI 開發工具（Claude Code、Codex 等）的寫作規則。這本書會公開。

## 寫作

- 一律用繁體中文
- 每一步寫清楚：指令、為什麼這樣做、怎麼確認成功、官方文件連結，以及跟官方指令不一樣的地方
- 主機分四種：`desktop`（有桌面的 Ubuntu）、`wsl`、`personal-server`、`shared-server`。只適用其中幾種的步驟要標出來
- 不寫公司名稱、主機名稱、IP，也不用「家裡」「公司」這類個人地點的說法；主機用「Ubuntu 桌面」「Windows 上的 WSL」「遠端伺服器」描述。範例的網域用 `example.com`
- 私人工具與個人設定不收：書講推薦的工具與觀念，個人腳本留在作者自己的 dotfiles
- 外部連結會自動開新分頁（`astro.config.mjs` 的腳本），不用手動加 `target`

## 結構

- 側邊欄分三區：〈裝機〉照著做的步驟、〈觀念〉為什麼這樣做、〈git〉
- 新增頁面要在 `astro.config.mjs` 的 `sidebar` 加一列；網址就是檔案路徑，搬區塊只改側邊欄，不要搬檔案
- `.mdx` 才能用 Starlight 元件（`<Steps>`、`<Tabs>`、`<TabItem>`）。元件內的內容要照元件的縮排，改動時不要用會重排縮排的格式化工具

## 檢查

- commit 時 pre-commit 會跑 markdownlint：code block 要標語言（純文字用 `text`），表格 pipe 兩側要有空格並對齊
- 改完跑 `bun run build`，確認建置成功
- 不要執行 `pre-commit install`（作者用 git 全域 hook 套用 pre-commit）
