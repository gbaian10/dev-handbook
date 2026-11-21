---
title: PATH 擺法
description: 同一份 PATH 要讓互動 shell、腳本、systemd 服務、GUI 程式都找得到工具，分別寫在哪裡。
---

工具裝好了，終端機裡打得出來，換個地方執行卻說找不到指令，幾乎都是 PATH 的問題：
**不同的啟動方式讀不同的設定檔。**

## zsh 啟動時讀哪些檔

zsh 依照「是不是登入 shell」「是不是互動 shell」決定要讀哪些檔，順序固定（`man zsh` 的 STARTUP/SHUTDOWN FILES）：

| 順序 | 檔案 | 什麼時候讀 |
| --- | --- | --- |
| 1 | `~/.zshenv` | **每一次**，包括腳本、`zsh -c` |
| 2 | `~/.zprofile` | 登入 shell |
| 3 | `~/.zshrc` | 互動 shell |
| 4 | `~/.zlogin` | 登入 shell（在 `.zshrc` 之後） |
| 離開時 | `~/.zlogout` | 登入 shell 結束時 |

每個檔案讀之前，會先讀 `/etc/zsh/` 底下的同名系統檔（例如 `/etc/zsh/zprofile`）。

- **登入 shell**：代表「登入了一次」的那個 shell，例如 WSL 從 Windows Terminal 開的分頁、`ssh 主機` 登入。`echo $0` 會顯示 `-zsh`（開頭有 `-`）
- **互動 shell**：有提示列、等你打指令的 shell。開終端機的都是；跑腳本、`zsh -c`、`ssh 主機 指令` 不是

## 誰會讀哪個檔

| 啟動方式 | `~/.zshenv` | `~/.zprofile` | `~/.zshrc` | `~/.config/environment.d/` |
| --- | --- | --- | --- | --- |
| WSL 從 Windows Terminal 開分頁、`ssh 主機` 登入（登入＋互動） | ✅ | ✅ | ✅ | ❌ |
| 桌面上開終端機視窗（互動、非登入，例如 GNOME Terminal 預設） | ✅ | ❌ | ✅ | ✅ 從桌面工作階段繼承 |
| 非互動的 zsh（`zsh -c`、腳本、`ssh 主機 指令`） | ✅ | ❌ | ❌ | — |
| systemd user 服務 | ❌ | ❌ | ❌ | ✅ |
| 從桌面啟動的 GUI 程式 | ❌ | ❌ | ❌ | ✅ |
| cron | ❌ | ❌ | ❌ | ❌ |

`.zshenv` 和 `environment.d` 範圍互補，**兩個都要放**：WSL 從 Windows Terminal 開的 shell、`ssh` 登入的 shell 都不是 systemd 啟動的，吃不到 `environment.d`；反過來，systemd 服務與 GUI 程式不經過 zsh，讀不到 `.zshenv`。
兩邊都加了同樣的路徑也沒關係，`.zshenv` 的 `typeset -U` 會去掉重複。

## 三個地方各放什麼

```zsh title="~/.zshenv"
typeset -U path PATH
path=($HOME/.local/bin $HOME/bin $HOME/.local/share/mise/shims $path)
```

每個 zsh 都會讀，所以放**最基本、所有情況都要有的路徑**。mise 用 shims，不在這裡執行 `mise activate`，因為 `.zshenv` 連腳本都會讀，要保持輕快。

| 路徑 | 放什麼 |
| --- | --- |
| `~/.local/bin` | 工具的安裝程式放進來的：uv、Claude Code、mise，以及 `uv tool install` 裝的指令 |
| `~/bin` | 自己寫的腳本。跟工具分開，一眼就分得出哪些是自己的 |

這兩個都是 Ubuntu 預設 `~/.profile` 會自動加進 PATH 的位置，但 zsh 不讀 `~/.profile`，所以要自己寫在這裡。資料夾不存在也沒關係，PATH 裡多一個不存在的路徑不會出錯。

```zsh title="~/.zshrc（節錄）"
plugins=(
	git
	mise
	zsh-autosuggestions
	zsh-syntax-highlighting
)
```

只有互動 shell 會讀。oh-my-zsh 的 `mise` 外掛執行 `mise activate zsh`：進入目錄時切換工具版本，並套用 `mise.toml` 的 `[env]`。

```ini title="~/.config/environment.d/999-path.conf"
PATH=${HOME}/.local/bin:${HOME}/bin:${HOME}/.local/share/mise/shims:${PATH}
```

給 systemd user 服務與從桌面啟動的 GUI 程式。它們不經過 zsh，只讀這裡。

這是 systemd 的功能：每個使用者登入時會有一個自己的 `systemd --user`，它讀這個目錄，再把環境傳給它啟動的程式。格式是一行一個 `KEY=VALUE`，可以用 `${變數}`，但**不是 shell**：不能 `export`、不能用 `~`、不能 `$(指令)`。

修改後執行 `systemctl --user daemon-reload` 重讀；已經在跑的服務要重啟才會拿到新值。只關掉終端機再開沒有用，`systemd --user` 在你還有任何登入工作階段時都不會重啟。

:::caution[檔名要排在 99-environment.conf 後面]
目錄裡所有 `.conf` 照檔名排序依序讀取，後讀的蓋掉先讀的。系統內建的 `/usr/lib/environment.d/99-environment.conf`（連到 `/etc/environment`）會把 PATH 整個重設成預設值，
檔名排在它前面（例如 `10-path.conf`）加進去的路徑會被蓋掉。用 `999-` 開頭就會排在它後面。
:::

## ~/.zprofile：這套設定不用它

`.zprofile` 只有登入 shell 會讀。桌面上開的終端機預設不是登入 shell、腳本也不是，PATH 寫在這裡就會時有時無，所以 PATH 統一放 `.zshenv`，`.zprofile` 留空或不建立。

| 不是登入 shell（不讀 `.zprofile`） | 是登入 shell（會讀） |
| --- | --- |
| 桌面上開的終端機視窗（GNOME Terminal 預設） | WSL 從 Windows Terminal 開的分頁 |
| VS Code 的內建終端機（Linux 預設） | `ssh 主機` 登入 |
| 在 zsh 裡再打 `zsh` 開的子 shell | 文字模式的 tty 登入 |
| 執行腳本、`zsh -c`、`ssh 主機 指令` | tmux 開的視窗與窗格（tmux 預設開登入 shell） |
| cron、systemd 服務呼叫的 shell | `zsh -l`、`su - 使用者` |

常見的舊寫法是在 `.zprofile` 寫 `source ~/.profile`，借用 Ubuntu 預設 `~/.profile` 裡「把 `~/.local/bin` 加進 PATH」的那段。PATH 改由 `.zshenv` 管理後，這行就不需要了。

`.zprofile` 適合放「每次登入只要做一次」的事；目前沒有這種需求。`.zlogin`、`.zlogout` 也一樣用不到。

:::note[macOS 不一樣]
macOS 的 `/etc/zprofile` 會執行 `path_helper` 重排 PATH，`.zshenv` 加的路徑可能被擠到後面，所以 macOS 上常見把 PATH 寫在 `.zprofile`。這本書以 Linux 為主，照 `.zshenv` 的做法即可。
:::

## cron 要自己寫

cron 什麼設定檔都不讀，PATH 只有最基本的 `/usr/bin:/bin`。在 `crontab -e` 最上面自己寫：

```bash
PATH=/home/<你>/.local/bin:/home/<你>/.local/share/mise/shims:/usr/local/bin:/usr/bin:/bin
```

cron 不會展開 `$HOME`，要寫完整路徑。

## 實際案例：服務裡 commit 找不到 pre-commit

有一個常駐的 systemd user 服務會幫忙做 git commit。設定好[全域 pre-commit hook](/git/global-hooks/) 之後，在終端機 commit 一切正常，從這個服務 commit 卻失敗：找不到 `pre-commit`。

原因：

- pre-commit 裝在 `~/.local/bin`，PATH 寫在 zsh 的設定檔裡，systemd 服務不讀 zsh 設定
- systemd user 服務的 PATH 預設不含 `~/.local/bin`

臨時的修法是替這個服務寫一個 drop-in，把 PATH 寫死：

```ini title="~/.config/systemd/user/<服務>.service.d/path.conf"
[Service]
Environment=PATH=%h/.local/bin:%h/.local/share/mise/shims:/usr/local/bin:/usr/bin:/bin
```

根本的修法是上面的 `environment.d`：所有 user 服務都拿到同一份 PATH，不必每個服務各寫一份。

## 確認

```bash
# 互動 shell
echo $PATH | tr ':' '\n'

# 非互動 shell
zsh -c 'echo $PATH' | tr ':' '\n'

# systemd user 服務看到的環境
systemctl --user daemon-reload
systemctl --user show-environment | grep '^PATH='
```
