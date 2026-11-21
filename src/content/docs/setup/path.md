---
title: PATH 擺法
description: 同一份 PATH 要讓互動 shell、腳本、systemd 服務、GUI 程式都找得到工具，分別寫在哪裡。
---

工具裝好了，終端機裡打得出來，換個地方執行卻說找不到指令，幾乎都是 PATH 的問題：
**不同的啟動方式讀不同的設定檔。**

## zsh 啟動時讀哪些檔

zsh 依照「是不是登入 shell」「是不是互動 shell」決定要讀哪些檔。下表使用預設的使用者設定目錄 `$HOME`。設定 `ZDOTDIR` 時會從該目錄讀取，`zsh -f` 則略過這些使用者設定檔。 [zsh 的啟動與結束檔案](https://zsh.sourceforge.io/Doc/Release/Files.html#Startup_002fShutdown-Files)

| 順序   | 檔案          | 什麼時候讀                     |
| ------ | ------------- | ------------------------------ |
| 1      | `~/.zshenv`   | **每一次**，包括腳本、`zsh -c` |
| 2      | `~/.zprofile` | 登入 shell                     |
| 3      | `~/.zshrc`    | 互動 shell                     |
| 4      | `~/.zlogin`   | 登入 shell（在 `.zshrc` 之後） |
| 離開時 | `~/.zlogout`  | 登入 shell 結束時              |

在 Ubuntu，啟動時各使用者設定檔前會先讀相應的 `/etc/zsh/` 設定檔（例如 `/etc/zsh/zprofile`）。離開登入 shell 時，先讀 `~/.zlogout`，再讀 `/etc/zsh/zlogout`。

- **登入 shell**：代表「登入了一次」的那個 shell，例如 WSL 從 Windows Terminal 開的分頁、`ssh 主機` 登入。`echo $0` 會顯示 `-zsh`（開頭有 `-`）
- **互動 shell**：有提示列、等你打指令的 shell。開終端機的都是；跑腳本、`zsh -c`、`ssh 主機 指令` 不是

## 誰會讀哪個檔

| 啟動方式                                                      | `~/.zshenv` | `~/.zprofile` | `~/.zshrc` | `~/.config/environment.d/`     |
| ------------------------------------------------------------- | ----------- | ------------- | ---------- | ------------------------------ |
| WSL 從 Windows Terminal 開分頁、`ssh 主機` 登入（登入＋互動） | ✅          | ✅            | ✅         | ❌                             |
| 桌面上開終端機視窗（互動、非登入，例如 GNOME Terminal 預設）  | ✅          | ❌            | ✅         | 視終端機的啟動方式而定         |
| 非互動的 zsh（`zsh -c`、腳本、`ssh 主機 指令`）               | ✅          | ❌            | ❌         | —                              |
| systemd user 服務                                             | ❌          | ❌            | ❌         | ✅                             |
| 從桌面啟動的 GUI 程式                                         | ❌          | ❌            | ❌         | 視桌面工作階段如何啟動程式而定 |
| cron                                                          | ❌          | ❌            | ❌         | ❌                             |

`.zshenv` 提供 zsh 所需的 PATH。Ubuntu 桌面若要讓圖形程式找到這些工具，或 WSL、遠端伺服器要在 systemd 使用者服務使用這些工具，再補 `environment.d`。
兩邊都加了同樣的路徑也沒關係，`.zshenv` 的 `typeset -U` 會去掉重複。

## 三個地方各放什麼

```zsh title="~/.zshenv"
typeset -U path PATH
path=($HOME/.local/bin $HOME/bin $HOME/.local/share/mise/shims $HOME/.cargo/bin $path)
```

每個 zsh 都會讀，所以放**最基本、所有情況都要有的路徑**。mise 用 shims，不在這裡執行 `mise activate`，因為 `.zshenv` 連腳本都會讀，要保持輕快。

| 路徑                        | 放什麼                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| `~/.local/bin`              | 工具的安裝程式放進來的：uv、Claude Code、mise，以及 `uv tool install` 裝的指令 |
| `~/bin`                     | 自己寫的腳本。跟工具分開，一眼就分得出哪些是自己的                             |
| `~/.local/share/mise/shims` | mise 管理的工具入口                                                            |
| `~/.cargo/bin`              | rustup 與 Cargo 安裝的指令                                                     |

Ubuntu 預設的 `~/.profile` 也會把存在的 `~/.local/bin`、`~/bin` 加進 PATH。zsh 有自己的啟動檔，將這些路徑寫入 `.zshenv` 即可，目錄可以等安裝相應的工具時再建立。

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
PATH=${HOME}/.local/bin:${HOME}/bin:${HOME}/.local/share/mise/shims:${HOME}/.cargo/bin:${PATH}
```

systemd 使用者管理程式會讀取這些設定，再把環境傳給它啟動的服務。其他程式能否取得同樣的 PATH 取決於啟動方式。GNOME Terminal 是由使用者服務提供的例子。格式是一行一個 `KEY=VALUE`，支援 `${變數}`。請使用完整路徑或變數，並省略 `export`、`~` 與 `$(指令)`。 [systemd 的 environment.d 手冊](https://www.freedesktop.org/software/systemd/man/latest/environment.d.html)

修改後執行 `systemctl --user daemon-reload` 重讀。已經在跑的服務要重啟才會拿到新值，圖形程式可能需要登出桌面工作階段再登入。

:::caution[檔名要排在 99-environment.conf 後面]
各目錄的 `.conf` 按檔名排序，後讀到的同名變數會覆蓋前面的值。如果 `/etc/environment` 有設定 PATH，較早的設定可能被 `99-environment.conf` 蓋過。`999-path.conf` 排在它後面，以上一個 PATH 值為基礎加上工具目錄。
:::

## ~/.zprofile：這套設定不用它

`.zprofile` 只有登入 shell 會讀。桌面上開的終端機預設不是登入 shell、腳本也不是，PATH 寫在這裡就會時有時無，所以 PATH 統一放 `.zshenv`，`.zprofile` 留空或不建立。

| 不是登入 shell（不讀 `.zprofile`）          | 是登入 shell（會讀）                         |
| ------------------------------------------- | -------------------------------------------- |
| 桌面上開的終端機視窗（GNOME Terminal 預設） | WSL 從 Windows Terminal 開的分頁             |
| VS Code 的內建終端機（Linux 預設）          | `ssh 主機` 登入                              |
| 在 zsh 裡再打 `zsh` 開的子 shell            | 文字模式的 tty 登入                          |
| 執行腳本、`zsh -c`、`ssh 主機 指令`         | tmux 開的視窗與窗格（tmux 預設開登入 shell） |
| cron、systemd 服務呼叫的 shell              | `zsh -l`、`su - 使用者`                      |

常見的舊寫法是在 `.zprofile` 寫 `source ~/.profile`，借用 Ubuntu 預設 `~/.profile` 裡「把 `~/.local/bin` 加進 PATH」的那段。PATH 改由 `.zshenv` 管理後，這行就不需要了。

`.zprofile` 適合放「每次登入只要做一次」的事；目前沒有這種需求。`.zlogin`、`.zlogout` 也一樣用不到。

:::note[macOS 不一樣]
macOS 的 `/etc/zprofile` 會執行 `path_helper` 重排 PATH，`.zshenv` 加的路徑可能被擠到後面，所以 macOS 上常見把 PATH 寫在 `.zprofile`。這本書以 Linux 為主，照 `.zshenv` 的做法即可。
:::

## cron 要自己寫

Ubuntu 的 cron 預設用 `/bin/sh` 執行工作，使用者 crontab 的 PATH 預設為 `/usr/bin:/bin`，不會讀取 zsh 的啟動設定。可以在 `crontab -e` 最上面自行指定：

```text title="crontab（節錄）"
PATH=/home/<你>/.local/bin:/home/<你>/bin:/home/<你>/.local/share/mise/shims:/home/<你>/.cargo/bin:/usr/local/bin:/usr/bin:/bin
```

crontab 的變數設定不會展開 `$HOME`。用 `printf '%s\n' "$HOME"` 查實際的家目錄，再以它替換範例中的 `/home/<你>`。用 `crontab -l` 核對儲存的 PATH。 [Ubuntu 的 crontab 手冊](https://manpages.ubuntu.com/manpages/resolute/en/man5/crontab.5.html)

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
