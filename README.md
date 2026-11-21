# 開發環境手冊

從一台全新的 Ubuntu 開始，把開發環境裝起來的步驟與背後的觀念：zsh、mise、uv、chezmoi、Docker、ssh、git。
用 [Starlight](https://starlight.astro.build)（Astro）寫成。

## 本機預覽

先準備 [Bun](https://bun.com/docs/installation)和 Astro 所需的 Node.js。這個版本的 Astro 需要 Node.js 22.23.4 以上，可先用 `bun --version` 與 `node --version` 確認。

```bash
bun install
bun run dev              # http://localhost:4321
bun run dev -- --host    # 同一個區網的其他裝置也能看
```

## 建置

```bash
bun run build            # 輸出到 dist/
bun run preview          # 預覽建置結果
```

## 結構

```text
src/content/docs/        # 頁面（.md、.mdx），檔名就是網址
astro.config.mjs         # 網站設定與側邊欄
src/styles/custom.css    # 樣式微調
```

新增頁面後要在 `astro.config.mjs` 的 `sidebar` 加一列，才會出現在側邊欄。

## 檢查

已啟用 [Git hook](https://git-scm.com/docs/git-hook) 時，commit 會執行行尾空白、YAML、JSON、markdownlint 及 commit 訊息格式檢查。手動檢查所有檔案可執行下列指令，commit 訊息由 `commit-msg` 事件另行檢查。

```bash
pre-commit run --all-files
```

commit 訊息格式：`<gitmoji> <type>(<scope>): <描述>`，例如 `📝 docs(ssh): 補充多帳號的設定`。

## 授權

[MIT](LICENSE)。首頁插圖與網站圖示取自 [Astro Starlight 範本](https://github.com/withastro/starlight/tree/main/examples/basics)，同樣是 MIT 授權，原作者的授權聲明見 [`public/starlight-license.txt`](public/starlight-license.txt)（網站上是 `/starlight-license.txt`）。
