---
title: 用 chezmoi 管理 dotfiles
description: 把 ~/.zshrc 這類設定檔收進 git repo，新電腦一條指令套回來；依主機類型產生不同內容、套用時自動裝工具。
---

[chezmoi](https://www.chezmoi.io) 把家目錄的設定檔（dotfiles）收進一個 git repo。換電腦時 `chezmoi init` 下載 repo、`chezmoi apply` 寫回家目錄。
它跟「直接把 `~/.zshrc` 丟進 git」的差別是：同一份 repo 可以依機器產生不同內容、記住檔案權限，還能在套用時順便裝工具。

適用 Ubuntu 桌面（`desktop`）、Windows 上的 WSL（`wsl`）和個人遠端伺服器（`personal-server`）。共用伺服器（`shared-server`）只使用已檢查過、整份都適合放在該主機的 repo，並挑選需要的 shell 設定。

## 安裝

用 mise 裝（見[新電腦從零開始](/setup/new-machine/)第 9 步）：

```bash
mise use -g chezmoi
chezmoi --version
```

這裡用 mise 統一管理版本，官方也提供其他安裝方式。 [chezmoi 安裝說明](https://www.chezmoi.io/install/) · [mise use](https://mise.jdx.dev/cli/use.html)

## 建立自己的 dotfiles repo

先在 GitHub 建一個空的 `dotfiles` repo。若含個人資訊，選私人 repo，並先依[裝機頁的 GitHub 步驟](/setup/new-machine/#用-mise-裝-gh登入-github)確認 SSH 已登入正確帳號。本例假設第 3、4 步已建立 `~/.gitconfig` 和 `~/.zshrc`，加入前先檢查這兩個檔案有無敏感設定。

```bash
chezmoi init                       # 建立來源目錄 ~/.local/share/chezmoi（一個 git repo）
chezmoi add ~/.zshrc ~/.gitconfig  # 把現有的設定檔複製進來
chezmoi managed                    # 應列出 .zshrc 與 .gitconfig
```

執行 `chezmoi cd` 開啟位於來源 repo 的子 shell。將下方的 `YOUR-USERNAME` 換成你的 GitHub 帳號，確認暫存內容後，再執行 commit 和 push。

```bash
git branch -M main
git remote add origin 'git@github.com:YOUR-USERNAME/dotfiles.git'
git add -A
git diff --cached
```

核對暫存內容後，提交並推送。

```bash
git commit -m "init" && git push -u origin main
git status -sb
exit
```

- 推送成功後，`git status -sb` 應顯示目前分支追蹤 `origin/main`；`exit` 回到原本的 shell
- 來源目錄預設是 `~/.local/share/chezmoi`，可用 `chezmoi source-path` 查實際位置
- `chezmoi add` 會**複製**檔案進來，之後改設定要改來源目錄裡的那份，再 `chezmoi apply` 寫回家目錄

這裡依官方流程建立來源 repo，示範用 SSH 推到 GitHub，並多檢查一次將要提交的內容。 [chezmoi 快速入門](https://www.chezmoi.io/quick-start/)

## 檔名的意思

git 只記得檔案有沒有執行權限，所以 chezmoi 把「套用後是什麼檔、什麼權限」寫在來源的檔名裡：

| 來源檔名                         | 套用到          | 意思                                                                |
| -------------------------------- | --------------- | ------------------------------------------------------------------- |
| `dot_zshrc`                      | `~/.zshrc`      | `dot_` 換成 `.`                                                     |
| `private_dot_ssh/private_config` | `~/.ssh/config` | `private_` 移除群組及其他人的權限。在本例通常是資料夾 700、檔案 600 |
| `bin/executable_mytool`          | `~/bin/mytool`  | `executable_`：加上執行權限                                         |
| `dot_gitconfig.tmpl`             | `~/.gitconfig`  | `.tmpl` 結尾：先經過範本處理，再寫出去                              |

`chezmoi add` 依原檔的屬性命名。例如 `~/.ssh/config` 原本是 600，加入時會有 `private_`。用 `chezmoi source-path ~/.ssh/config` 可核對名稱。 [chezmoi 來源屬性](https://www.chezmoi.io/reference/source-state-attributes/)

## 依主機類型切換

同一份 repo 可依四種主機類型產生不同內容。在來源 repo 根目錄放 `.chezmoi.toml.tmpl`，用 `chezmoi init` 產生本機設定。

```text title=".chezmoi.toml.tmpl"
{{- $machine := promptChoiceOnce . "machine" "主機類型" (list "desktop" "wsl" "personal-server" "shared-server") -}}
umask = 0o022

[data]
    machine = {{ $machine | quote }}
{{- if ne $machine "shared-server" }}
    {{- $email := promptStringOnce . "email" "git user.email" }}
    email = {{ $email | quote }}
{{- end }}
```

答案預設存到 `~/.config/chezmoi/chezmoi.toml`。只要對應的值仍存在，重跑 `chezmoi init` 時就會沿用。用 `chezmoi data` 核對 `machine` 和 `email`，共用伺服器的範例不會詢問或寫入 email。 [chezmoi 的主機類型範本](https://www.chezmoi.io/user-guide/manage-machine-to-machine-differences/)

將來源的 `dot_gitconfig` 改名為 `dot_gitconfig.tmpl`，保留原有設定，依下列範例替換 email 和編輯器欄位。若桌面或 WSL 沒有 `code`，請改用已安裝的編輯器。

```text title="dot_gitconfig.tmpl（節錄）"
[user]
	email = {{ .email | quote }}
[core]
{{- if eq .machine "personal-server" }}
	editor = vim
{{- else }}
	editor = code --wait
{{- end }}
```

若要略過整個檔案，在 `.chezmoiignore` 寫下套用後的相對路徑。這個檔本身也會經過範本處理。

```text title=".chezmoiignore"
README.md
{{- if eq .machine "shared-server" }}
.gitconfig
.ssh
bin/mytool
{{- end }}
```

| 寫法            | 意思                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| `{{- … }}`      | 開頭的 `-` 吃掉前面的空白與換行，產生的檔案才不會多出空行                         |
| `umask = 0o022` | 統一計算一般檔案及目錄的目標權限，避免不同終端機的 umask 讓部分檔案被列成權限有變 |

執行 `chezmoi managed` 確認共用伺服器的輸出沒有 `.gitconfig` 和 `.ssh`。`.chezmoiignore` 只影響套用目標，clone 時仍會下載來源 repo 及其版本歷史。 [chezmoi 的忽略規則](https://www.chezmoi.io/reference/special-files/chezmoiignore/) · [chezmoi umask](https://www.chezmoi.io/reference/configuration-file/umask/)

## 套用時順便做事：run 腳本

`run_` 開頭的檔案不會放進家目錄，而是在 `chezmoi apply` 時**執行**。最常用的是 `run_onchange_`：內容有變才跑。

先依[裝機頁](/setup/new-machine/#裝-mise設定-path)裝好 mise，並從已有非機密工具清單的主機執行 `chezmoi add ~/.config/mise/config.toml`。下例使用普通檔案存放清單。用 `chezmoi source-path ~/.config/mise/config.toml` 核對檔名，若不同，將範本內的 `include` 路徑換成實際的來源相對路徑。

```bash title="run_onchange_after_10-mise-install.sh.tmpl"
#!/bin/bash
# mise 清單的雜湊：清單一改，這支腳本的內容就跟著變，chezmoi 才會重跑它
# {{ include "dot_config/mise/config.toml" | sha256sum }}
set -eu
mise install
```

| 片段         | 意思                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| `run_`       | 套用時執行，不是放進家目錄的檔案                                                |
| `onchange_`  | 第一次或內容跟上次成功執行時不同才跑，chezmoi 會記住內容的雜湊                  |
| `after_`     | 所有設定檔寫好**之後**才跑（`before_` 則是之前）                                |
| `10-`        | 多支腳本依檔名排序執行                                                          |
| 雜湊那行註解 | 少了它，腳本本身從來不變，就只會在第一次套用時跑；加了它，mise 清單一改就會重跑 |

用 `chezmoi status` 看腳本是否待執行。成功套用後，下一次執行同一份設定時應略過該腳本。若缺少前置條件，讓腳本以非 0 結束，修正後再套用。共用伺服器只執行自己或管理員已看過、適合該主機的腳本。 [chezmoi 套用腳本](https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/)

## 新電腦套用

```bash
chezmoi init 'git@github.com:YOUR-USERNAME/dotfiles.git'
chezmoi diff
```

先把 `YOUR-USERNAME` 換成你的帳號。這個 SSH 網址需要有效的 GitHub SSH 存取權。在共用伺服器，請換成適合該主機的非機密 repo，以該主機獲准的方式讀取。

`chezmoi init` 會 clone 來源 repo 並在需要時產生 chezmoi 本身的設定。它先保留受管理的目標檔案。第一次套用可能覆蓋已存在的設定，先用 `chezmoi diff` 檢查變更和腳本，再執行下列指令。 [chezmoi init](https://www.chezmoi.io/reference/commands/init/) · [chezmoi diff](https://www.chezmoi.io/reference/commands/diff/) · [chezmoi apply](https://www.chezmoi.io/reference/commands/apply/)

```bash
chezmoi apply
chezmoi status
```

曾用 chezmoi 寫過的檔案若又被手動改動，`apply` 可能詢問是否覆蓋。確定結果後可用 `exec zsh` 重新載入 shell 設定。熟悉自己的 repo 後，也可用 `chezmoi init --apply` 加上 repo 網址，合併初始化和套用。

`status` 有兩欄。第一欄是上次寫入後的本機變更，第二欄是下次套用會做的事。`A` 是新增、`D` 是刪除、`M` 是修改，第二欄的 `R` 是待執行的腳本。沒有輸出表示沒有列出任何受管理項目的變更或待執行腳本。 [chezmoi status](https://www.chezmoi.io/reference/commands/status/)

## 平常怎麼改

| 想做什麼                        | 指令                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| 改某個設定                      | `chezmoi edit ~/.zshrc`（開來源檔），改完 `chezmoi apply`                                          |
| 直接改了家目錄的檔，想收回 repo | `chezmoi re-add ~/.zshrc`（只適用已管理的非範本檔案）                                              |
| 範本檔（`.tmpl`）被直接改了     | `re-add` 不支援範本。`chezmoi merge ~/.gitconfig` 開三方合併，把要留的修改寫進來源範本             |
| 看 repo 跟家目錄差在哪          | `chezmoi diff`                                                                                     |
| 推上 GitHub                     | `chezmoi cd` 進入來源目錄，檢查內容後依序 `git add`、`git commit`、`git push`                      |
| 拉其他電腦推上來的改動          | `chezmoi update` 會拉取並套用。想先預覽，可用 `chezmoi git -- pull --rebase` 後再跑 `chezmoi diff` |
| 改了 `.chezmoi.toml.tmpl`       | 跑 `chezmoi init` 重新產生本機設定。若是拉遠端範本並願意直接套用，可用 `chezmoi update --init`     |

改完可用 `chezmoi status`、在來源 repo 用 `git status -sb` 檢查。 [chezmoi re-add](https://www.chezmoi.io/reference/commands/re-add/) · [chezmoi update](https://www.chezmoi.io/reference/commands/update/)

### 家目錄和 repo 不一樣時

chezmoi 會記住上次寫進每個檔案的內容。檔案在那之後被手動改過，`apply` 或 `update` 就會停下來問：

```text
.zshrc has changed since chezmoi last wrote it?
diff, overwrite, all-overwrite, skip, quit
```

先選 `diff` 看差在哪。要保留家目錄的修改就選 `skip`，再用上表的 `re-add` 或 `merge` 收回 repo；不要的話選 `overwrite`。
習慣先跑 `chezmoi diff`，就不會在套用途中才發現。

兩台電腦都改了 repo、都要推時，跟一般 git 一樣：後推的那台先 `chezmoi update`（會 rebase），同一行都被改過才需要到 `chezmoi cd` 裡解衝突。

chezmoi 也能在 `edit`、`add` 之後自動提交與推送（設定 `git.autoCommit`、`git.autoPush`），但每存一次檔就推一次，自動產生的提交訊息也過不了 commitizen 這類檢查，不建議開。 [chezmoi merge](https://www.chezmoi.io/reference/commands/merge/)

### 讓 AI 也照這個流程改

請 AI 改 `~/.zshrc` 這類檔案時，它預設會直接改家目錄那份，下次套用就被蓋掉。可以在全域的 `~/.claude/CLAUDE.md`（Codex 是 `~/.codex/AGENTS.md`）加一條規則，而且這份檔案本身也交給 chezmoi 管理，每台電腦都會有：

```markdown
- 家目錄的設定檔多半由 chezmoi 管理：改之前用 `chezmoi source-path <檔案>` 確認，
  有管理就先問我要寫進 chezmoi 來源（各台同步）還是只改這台。
  寫進來源時直接改來源檔（`chezmoi edit` 會開編輯器，AI 不能用），`chezmoi diff` 確認後再 `chezmoi apply <檔案>`；
  提交、推送要我同意才做。
```

## 不要放進 repo 的東西

dotfiles repo 只放**設定**，不放**秘密**：私鑰、token、`.env`、雲端憑證都不要加進來，換電腦時另外搬，見[換電腦要手動帶走的東西](/setup/migrate/)。

另外兩類通常也不收：

- **程式自己會改的設定檔**：例如 Claude Code 的 `~/.claude/settings.json`、Codex 的 `~/.codex/config.toml`。收進來的話，程式改了、chezmoi 又改回去，兩邊互相覆蓋。改成在 repo 的 README 用文字記下要設定哪些值
- **有雲端同步的**：例如 VS Code 開了 Settings Sync

可以在來源 repo 的 `.pre-commit-config.yaml` 設定 `detect-private-key`，在 commit 時檢查私鑰內容。 [pre-commit 的私鑰檢查](https://github.com/pre-commit/pre-commit-hooks#detect-private-key) · [全域 pre-commit hook](/git/global-hooks/)

## 不動家目錄，先看產生結果

改了範本時，可將受管理的輸出寫到新的暫存目錄。以下範例適用於自己已檢查過、只包含本頁這類範本與腳本的 repo。

```bash
preview=$(mktemp -d) &&
  mkdir "$preview/output" &&
  chezmoi apply --destination "$preview/output" --persistent-state "$preview/state.boltdb" --exclude scripts &&
  ls -la "$preview/output"
```

`--destination` 只改輸出位置，`--persistent-state` 把這次的狀態放在暫存目錄，`--exclude scripts` 略過來源 repo 的 run 腳本。chezmoi 仍會讀本機設定及來源，範本中的 `exec` 或設定檔的 hooks 仍可執行。要看另一種主機類型，可在套用指令加 `--config` 並指定另一份包含適當 `[data]` 的設定檔。 [chezmoi 全域旗標](https://www.chezmoi.io/reference/command-line-flags/global/) · [chezmoi hooks](https://www.chezmoi.io/reference/configuration-file/hooks/)

## 參考連結

- [chezmoi 快速入門](https://www.chezmoi.io/quick-start/)
- [來源檔名的屬性（dot_、private_、executable_…）](https://www.chezmoi.io/reference/source-state-attributes/)
- [範本與 `.chezmoi.toml.tmpl`](https://www.chezmoi.io/user-guide/templating/)
- [run 腳本](https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/)
- [`.chezmoiignore`](https://www.chezmoi.io/reference/special-files/chezmoiignore/)
