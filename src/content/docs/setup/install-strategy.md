---
title: 安裝分工
description: 每個工具該用 apt、mise 還是它自己的安裝程式。
---

同一個工具往往有好幾種裝法。我依「誰負責更新」來決定：

| 裝法 | 適合什麼 | 例子 |
| --- | --- | --- |
| 原生安裝程式 | 自己會更新，或自己會依專案切換版本 | uv（`uv self update`）、rustup、Claude Code（自動更新） |
| mise | 其他 CLI 工具，以及 go、bun、node | rg、eza、bat、fzf、zoxide、gh、chezmoi、go、bun、node |
| apt | 系統基礎，不追版本 | zsh、curl、build-essential、字型、函式庫 |
| apt＋PPA | 系統基礎，但要追最新版 | git |
| `uv tool install` | Python 寫的 CLI 工具 | pre-commit、commitizen、ruff |

程式語言的分工另外整理在[語言版本管理](/setup/languages/)。

## mise 管哪些

除了少數自己會更新的工具，CLI 工具一律交給 mise：

- 版本寫在 `~/.config/mise/config.toml`，這個檔案收進 dotfiles，新電腦 `mise install` 一次裝回來
- `mise upgrade` 一次升級全部
- 不需要 sudo，全部裝在家目錄底下

### mise 不只管版本

mise 官方的介紹是「Dev tools, env vars, and tasks in one CLI」，一個工具做三件事：

| 功能 | 取代什麼 | 寫在 `mise.toml` 的 |
| --- | --- | --- |
| 管工具版本 | asdf、nvm、pyenv、rbenv 這類版本管理器 | `[tools]` |
| 進入目錄時自動載入環境變數、`.env`、PATH | direnv、dotenv | `[env]` |
| 執行專案任務，可設依賴、平行執行、監看檔案 | make、just | `[tasks]` |

```toml title="mise.toml"
[tools]
node = "24"

[env]
DATABASE_URL = "postgres://localhost/dev"
_.file = ".env"        # 一併載入 .env
_.path = ["./bin"]     # 把專案的 bin 加進 PATH

[tasks.build]
run = "bun run build"

[tasks.test]
depends = ["build"]
run = "bun test"
```

`mise run test` 會先跑 `build` 再跑 `test`，而且執行時已經套用上面的工具版本與環境變數。

從 asdf 換過來不用改專案：mise 直接讀 `.tool-versions`，也能讀 `.nvmrc`、`.python-version` 這類各語言自己的版本檔。
只想在自己電腦上用、不進版控的設定，寫在 `mise.local.toml`（已經在[全域忽略檔](/git/config/#git-全域忽略檔)裡）。

mise 也有 `mise bootstrap`、`mise dot apply` 可以套用 dotfiles 與系統套件，跟 chezmoi 的功能重疊。這本書的 dotfiles 用 chezmoi 管理，主機切換的樣板與加密比較成熟。

官方說明：[工具版本](https://mise.jdx.dev/dev-tools/)、[環境變數](https://mise.jdx.dev/environments/)、[任務](https://mise.jdx.dev/tasks/)、[從 asdf 轉換](https://mise.jdx.dev/dev-tools/comparison-to-asdf.html)

## Node 也交給 mise

以前用 fnm 管 Node，現在改用 mise，fnm 退休。

- `npm i -g` 裝的全域套件放在該 Node 版本的目錄底下，升 Node 大版本後要重裝一次
- 全域的 npm CLI 改寫進 mise 設定，用 `npm:` 後端，例如 `"npm:@openai/codex" = "latest"`。這樣裝在 mise 自己的目錄，升級 Node 也不會消失（帶原生模組的套件例外）
- 一次性執行用 `bunx`
- 不完全拿掉 Node：很多 CLI 的開頭是 `#!/usr/bin/env node`，`bunx` 預設也還是用 Node 執行它們

## Python 工具交給 uv

Python 寫的 CLI 工具用 `uv tool install`，不用 mise：

- 每個工具裝在自己的獨立環境，指令直接放在 `~/.local/bin`，不需要 shims 或任何啟動步驟
- 要一起帶外掛時很簡單，例如 `uv tool install commitizen --with cz-conventional-gitmoji`
- `uv tool upgrade --all` 一次升級

缺點是沒有像 mise `config.toml` 那樣的清單檔記錄裝了哪些。這部分交給 dotfiles 工具：列一份要裝的清單，套用時自動補裝。
