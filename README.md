# 開發環境手冊

從一台全新的 Ubuntu 開始，把開發環境裝起來的步驟與背後的觀念：zsh、mise、uv、chezmoi、Docker、ssh、git。
用 [Starlight](https://starlight.astro.build)（Astro）寫成。

## 本機預覽

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

commit 時由 pre-commit 檢查（行尾空白、YAML、JSON、markdownlint、commit 訊息格式）。手動跑完整檢查：

```bash
pre-commit run --all-files
```

commit 訊息格式：`<gitmoji> <type>(<scope>): <描述>`，例如 `📝 docs(ssh): 補充多帳號的設定`。
