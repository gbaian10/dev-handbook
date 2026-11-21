---
title: git 設定
description: 全域的 ~/.gitconfig 與 ~/.config/git/ignore，每一行在做什麼。
---

這兩個檔案很少改，內容直接列在這裡。

:::tip[用 dotfiles 工具管理]
建議把這兩個檔案交給 dotfiles 工具（例如 chezmoi）管理，不要每台機器手動複製。
名字、email 這類每台機器可能不同的值做成樣板變數，新機器套用時才填。
:::

## git 全域設定檔

檔案位置：`~/.gitconfig`

```ini title="~/.gitconfig"
[user]
	name = 你的名字
	email = you@example.com
[init]
	defaultBranch = main
[core]
	autocrlf = input
	editor = code --wait
[push]
	default = current

[alias]
	s = status
	cm = commit -m
	l = log --oneline --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'
	lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --date=relative
```

| 設定                        | 作用                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `init.defaultBranch = main` | `git init` 建出來的分支叫 main                                                                                                        |
| `core.autocrlf = input`     | 將判定為文字的檔案加入索引時，把 CRLF 轉成 LF。checkout 不做相反轉換，可由 repo 的 `.gitattributes` 指定個別規則                      |
| `core.editor = code --wait` | commit 訊息、rebase 等用 VS Code 編輯。沒有 VS Code 的機器（例如共用伺服器）改成 `vim`                                                |
| `push.default = current`    | `git push` 無指定 refspec 時，推到同名的遠端分支。若還要設定 upstream，可用 `git push -u origin <分支>` 或啟用 `push.autoSetupRemote` |
| `alias.s`、`cm`             | `git s` ＝ `git status`，`git cm "訊息"` ＝ `git commit -m "訊息"`                                                                    |
| `alias.l`、`lg`             | 一行一個 commit 的彩色 log；`lg` 多了分支圖與相對時間                                                                                 |

## git 全域忽略檔

檔案位置：`~/.config/git/ignore`

所有 repo 共用的 ignore，只放**個人工具產生、不該進任何 repo** 的檔案。專案自己的產物仍然寫在各 repo 的 `.gitignore`。

未設定 `core.excludesFile` 時，Git 預設讀取 `$XDG_CONFIG_HOME/git/ignore`。未設定 `XDG_CONFIG_HOME` 時，預設位置就是 `~/.config/git/ignore`。
網路上常見的 `~/.gitignore_global` 是早年流傳的慣例，要多寫一行 `core.excludesfile` 才會生效。

```text title="~/.config/git/ignore"
mise.local.toml

**/.claude/settings.local.json

.playwright-mcp/
```

| 規則                             | 是什麼                                      |
| -------------------------------- | ------------------------------------------- |
| `mise.local.toml`                | mise 的本機覆寫設定，放個人的環境變數與路徑 |
| `**/.claude/settings.local.json` | Claude Code 的個人本機設定（權限等）        |
| `.playwright-mcp/`               | Playwright MCP 把截圖與快照存在目前目錄底下 |

## git 讀取忽略規則的順序

git 會從四個地方讀忽略規則，優先順序由高到低：

| 優先 | 來源                                             | 範圍                        | 進版控           |
| ---- | ------------------------------------------------ | --------------------------- | ---------------- |
| 1    | 指令參數（例如 `git ls-files --exclude=<規則>`） | 只有這次指令                | 否               |
| 2    | 各目錄的 `.gitignore`                            | 該目錄與底下的子目錄        | 是，整個團隊共用 |
| 3    | `.git/info/exclude`                              | 只有這個 repo、只有這台機器 | 否               |
| 4    | 全域忽略檔 `~/.config/git/ignore`                | 這台機器上所有 repo         | 否               |

- 同一個檔案符合好幾條規則時，**優先順序高的來源說了算**；同一個來源裡，**越後面的規則**說了算
- `.gitignore` 可以放在任何子目錄，越深層的檔案優先於上層的
- `!規則` 可以把被忽略的檔案撈回來，但**上層目錄已經整個被忽略時撈不回來**，git 根本不會進去那個目錄看
- 忽略規則只影響**還沒被追蹤**的檔案。已經 commit 過的檔案要先 `git rm --cached <檔案>`，忽略才會生效

選哪一個放：專案產物寫 `.gitignore`；只有自己這份 checkout 要忽略的寫 `.git/info/exclude`；自己所有 repo 都要忽略的個人工具檔寫全域忽略檔。

不確定是哪條規則擋住某個檔案時，用 `git check-ignore -v` 查，會印出來源檔案、行號與規則：

```bash
git check-ignore -v mise.local.toml
# /home/<你>/.config/git/ignore:1:mise.local.toml	mise.local.toml
```

## 確認

```bash
git config --global --list
git check-ignore -v mise.local.toml   # 會顯示是 ~/.config/git/ignore 的哪一行擋住的
```

## 不同目錄用不同身分

同一台機器上，工作和個人的 repo 常要用不同的名字與 email。用 `includeIf` 依目錄載入另一份設定：

```ini title="~/.gitconfig（附加）"
[includeIf "gitdir:~/personal/"]
	path = ~/personal/.gitconfig
```

```ini title="~/personal/.gitconfig"
[user]
	name = 個人名字
	email = personal@example.com
```

`~/personal/` 底下的 repo 都會改用這份的 `user`；其他地方照舊。路徑結尾的 `/` 不能省，代表「這個目錄底下全部」。

在該目錄下的 repo 執行 `git config --show-origin --get user.email`，應該會看到個人設定檔與個人 email。

## 多個 GitHub 帳號

ssh 端先替個人帳號取一個主機別名（例如 `github.personal`），見 [ssh 設定〈多個 GitHub 帳號〉](/setup/ssh/#多個-github-帳號)。

GitHub 提供的 SSH clone 網址使用 `github.com`。用 `insteadOf`，從網頁複製 SSH 或 HTTPS 網址時都能自動換成個人別名。

```ini title="~/.gitconfig（附加）"
[url "git@github.personal:<個人帳號>/"]
	insteadOf = git@github.com:<個人帳號>/
	insteadOf = https://github.com/<個人帳號>/
	insteadOf = ssh://git@github.com/<個人帳號>/
```

- 網址開頭符合 `insteadOf` 的，連線時改成前面的 `url`；三行分別對應 ssh、https、`ssh://` 三種網址寫法
- 這個範例匹配網址中的擁有者前綴。由其他帳號或組織擁有的 repo 繼續走原網址
- `git remote -v` 與 `git remote get-url origin` 顯示的是改寫後的網址。要看原值，用 `git config --get remote.origin.url`
- 私人 repo 的 https 網址也會改走 ssh，所以不用另外設定 https 的登入

用自己的帳號與 repo 名稱換掉範例，確認輸出以 `git@github.personal:` 開頭。這個指令只展開網址。

```bash
git ls-remote --get-url 'https://github.com/<個人帳號>/<repo>.git'
```

也可以用上面的 `includeIf`，讓特定目錄內已建立的 repo 一律用個人金鑰連 GitHub。把以下設定放在 `includeIf` 載入的設定檔。較長的全域前綴仍有優先權。這組對應保留網址的擁有者與 repo 路徑。

```ini title="~/personal/.gitconfig"
[url "git@github.personal:"]
	insteadOf = git@github.com:
	insteadOf = https://github.com/
	insteadOf = ssh://git@github.com/
```

## 參考連結

- [git-config：url.\<base\>.insteadOf](https://git-scm.com/docs/git-config#Documentation/git-config.txt-urlbaseinsteadOf)
- [git-config：Git 設定檔與條件式 include](https://git-scm.com/docs/git-config)
- [gitignore：忽略規則來源與優先順序](https://git-scm.com/docs/gitignore)

- [GitAlias](https://github.com/GitAlias/gitalias)：整理好的大量 git alias，挑需要的複製進 `[alias]`
