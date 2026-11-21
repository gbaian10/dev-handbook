---
title: 安裝分工
description: 每個工具該用 apt、mise 還是它自己的安裝程式。
---

同一個工具往往有好幾種裝法。我依「誰負責更新」來決定：

| 裝法              | 適合什麼                          | 例子                                                  |
| ----------------- | --------------------------------- | ----------------------------------------------------- |
| 原生安裝程式      | 工具自帶更新或版本管理方式        | uv、rustup、Claude Code、Codex CLI                    |
| mise              | 其他 CLI 工具，以及 go、bun、node | rg、eza、bat、fzf、zoxide、gh、chezmoi、go、bun、node |
| apt               | 系統基礎，不追版本                | zsh、curl、build-essential、字型、函式庫              |
| apt＋PPA          | 系統基礎，但要追最新版            | git                                                   |
| `uv tool install` | Python 寫的 CLI 工具              | pre-commit、commitizen、ruff                          |

程式語言的分工另外整理在[語言版本管理](/setup/languages/)。

## mise 管哪些

除了採用原生安裝程式和交給 uv 的工具，多數 CLI 工具交給 mise：

- 版本寫在 `~/.config/mise/config.toml`，這個檔案收進 dotfiles，新電腦 `mise install` 一次裝回來
- `mise upgrade` 在目前的設定範圍內更新各工具。精確釘版的工具要先更新版本要求，可用 `mise ls` 核對裝好的版本。 [mise upgrade 手冊](https://mise.jdx.dev/cli/upgrade.html)
- 不需要 sudo，全部裝在家目錄底下

### mise 不只管版本

mise 官方的介紹是「Dev tools, env vars, and tasks in one CLI」，一個工具做三件事：

| 功能                                       | 取代什麼                               | 寫在 `mise.toml` 的 |
| ------------------------------------------ | -------------------------------------- | ------------------- |
| 管工具版本                                 | asdf、nvm、pyenv、rbenv 這類版本管理器 | `[tools]`           |
| 進入目錄時自動載入環境變數、`.env`、PATH   | direnv、dotenv                         | `[env]`             |
| 執行專案任務，可設依賴、平行執行、監看檔案 | make、just                             | `[tasks]`           |

```toml title="mise.toml"
[tools]
bun = "1.4"
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

`mise run test` 會先跑 `build` 再跑 `test`，執行時會套用上面的工具版本與環境變數。把範例存到已有 `build` script 與測試的 Bun 專案，檢查並信任設定後用 `mise install` 裝工具，再執行 `mise run test` 核對執行順序。

mise 可直接讀 asdf 的 `.tool-versions`。`.nvmrc` 這類語言版本檔需各自啟用，例如用 `mise settings add idiomatic_version_file_enable_tools node` 啟用 Node 版本檔。這本書的 `.python-version` 交給 uv。 [mise 的語言版本檔設定](https://mise.jdx.dev/configuration/settings.html#idiomatic_version_file_enable_tools)
只想在自己電腦上用、不進版控的設定，寫在 `mise.local.toml`（已經在[全域忽略檔](/git/config/#git-全域忽略檔)裡）。

mise 也有 `mise bootstrap`、`mise dot apply` 可以套用 dotfiles 與系統套件，跟 chezmoi 的功能重疊。本書示範用 chezmoi 管理主機差異與套用設定，見[用 chezmoi 管理 dotfiles](/setup/chezmoi/)。

官方說明：[工具版本](https://mise.jdx.dev/dev-tools/)、[環境變數](https://mise.jdx.dev/environments/)、[任務](https://mise.jdx.dev/tasks/)、[從 asdf 轉換](https://mise.jdx.dev/dev-tools/comparison-to-asdf.html)

## Node 也交給 mise

以前用 fnm 管 Node，現在改用 mise，fnm 退休。

- `npm i -g` 裝的全域套件放在該 Node 版本的目錄底下，升 Node 大版本後要重裝一次
- 全域的 npm CLI 可寫進 mise 設定，用 `npm:` 後端，例如 `"npm:wrangler" = "latest"`。mise 會把套件裝在自己的工具目錄。升級 Node 後仍可找到該工具，但含原生模組的套件可能要重建。 [mise 的 npm 後端](https://mise.jdx.dev/dev-tools/backends/npm.html)
- 一次性執行用 `bunx`
- 不完全拿掉 Node：很多 CLI 的開頭是 `#!/usr/bin/env node`，`bunx` 預設也還是用 Node 執行它們

## Python 工具交給 uv

Python 寫的 CLI 工具用 `uv tool install`，不用 mise：

- 每個工具裝在自己的獨立環境，指令直接放在 `~/.local/bin`，不需要 shims 或任何啟動步驟
- 要一起帶外掛時很簡單，例如 `uv tool install commitizen --with cz-conventional-gitmoji`
- `uv tool upgrade --all` 一次升級

用 `uv tool list` 確認實際安裝的工具。 [uv 的工具管理說明](https://docs.astral.sh/uv/guides/tools/)

缺點是沒有像 mise `config.toml` 那樣的清單檔記錄裝了哪些。這部分交給 dotfiles 工具：列一份要裝的清單，套用時自動補裝。
