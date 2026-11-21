---
title: 換電腦要手動帶走的東西
description: dotfiles 只放設定、不放秘密。私鑰、token、憑證這些要自己搬；哪些該複製、哪些重新登入就好。
---

dotfiles 管的是**設定**，換電腦時一條指令就能套回來。但**秘密**（私鑰、token、憑證）不該進 dotfiles 的 repo，要另外搬。

## 怎麼傳

兩台電腦都在時，直接用 ssh 傳，不經過雲端硬碟或聊天軟體：

```bash
# 在新電腦上，從舊電腦拉
old=old-machine # 換成舊電腦的 SSH 別名
rsync -a -e ssh --chmod=D700,F600 "$old:~/.secrets/" "$HOME/.secrets/"
```

`-e ssh` 明確指定 SSH，`--chmod=D700,F600` 將收到的目錄與檔案分別設成 700 與 600。搬完可用 `stat` 確認目錄權限，再用 checksum 做一次模擬同步。同步後來源未再變動時，第二條命令不應列出待更新項目。

```bash
stat -c '%a %n' "$HOME/.secrets"
rsync -anci -e ssh --chmod=D700,F600 "$old:~/.secrets/" "$HOME/.secrets/"
```

## 先盤點：還有沒有在用

舊電腦上常累積很多早就沒用的憑證和設定，搬之前先確認，不用的直接刪掉，比整包帶走乾淨。只看檔名、日期和「誰會讀它」，不用打開秘密的內容：

```bash
ls -l --time-style=long-iso ~/.cloudflared ~/.gnupg   # 最後修改時間：很久沒動的多半已經沒用
gpg --list-secret-keys                                 # 沒有私鑰，~/.gnupg 就只剩別人的公鑰
nmcli -f NAME,TYPE,TIMESTAMP-REAL connection show      # VPN 連線最後一次用是什麼時候
rg -l 'git-credentials|GIT_AUTH_TOKEN' ~/projects      # 專案裡有沒有指令或設定會讀這個檔
```

## 一定要複製

| 類別              | 常見位置                                                     | 說明                                                                                        |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 自己的秘密資料夾  | 例如 `~/.secrets/`                                           | 把 token、`.env`、各種私鑰集中放一個資料夾（權限 700），換電腦只要搬這一個                  |
| ssh 私鑰          | `~/.ssh/id_ed25519` 等（含 `.pub`）                          | 也可以在新電腦產生新金鑰，再到 GitHub、各伺服器重新登記；比較安全，但要登記的地方多就很麻煩 |
| sops 的 age 私鑰  | `~/.config/sops/age/keys.txt`                                | 弄丟了，用它加密的檔案就再也解不開                                                          |
| GPG 私鑰          | `~/.gnupg/`                                                  | 有用 GPG 簽 commit 或加密時。`gpg --list-secret-keys` 沒列出東西就不用帶                    |
| Cloudflare Tunnel | `~/.cloudflared/cert.pem`、`~/.cloudflared/<tunnel-id>.json` | 見下面〈cloudflared 留下的檔案〉，不是每個檔都要帶                                          |

### cloudflared 留下的檔案

依建立 tunnel 的方式不同，`~/.cloudflared/` 裡的檔案用途也不同：

| 做了什麼                           | 留下的檔案                 | 綁在哪                                                           | 換電腦                     |
| ---------------------------------- | -------------------------- | ---------------------------------------------------------------- | -------------------------- |
| `cloudflared tunnel login`         | `cert.pem`                 | **帳號**（選定的網域）：有它才能用指令建立、列出、刪除 tunnel    | 帶走，或在新電腦重新 login |
| `cloudflared tunnel create <名稱>` | `<tunnel-id>.json`         | **每個 tunnel 一個**：執行那個 tunnel 用的憑證                   | 還要跑這個 tunnel 就帶走   |
| 在 Cloudflare 網頁後台建立 tunnel  | 不留檔案，網頁給一串 token | 每個 tunnel 一個 token，用 `cloudflared tunnel run --token …` 跑 | 不用帶，token 從後台再拿   |
| `cloudflared access login <網址>`  | `<網址>-token` 這類檔案    | 每個受 Access 保護的網站一個，短期有效                           | 不用帶，過期就重新登入     |

## 工作用的設定

只有工作電腦需要的設定，換工作電腦時一起搬（細節以公司的做法為準）：

- **只屬於某台的 ssh 主機**：例如 `~/.ssh/config.d/work.conf`，見 [ssh 設定](/setup/ssh/)。每台都一樣的個人主機交給 dotfiles
- **雲端與 k8s 的設定**：`~/.kube/config`、`~/.aws/`、`~/.config/gcloud/configurations/`（gcloud 的命名設定，記專案與帳號，不含登入憑證）
- **本機跑的 k8s 叢集**（例如 k3s）：屬於系統層的資料，照該工具官方的備份還原步驟搬
- **公司的私有 Go module**：要兩項設定搭配，見下一節

### 私有 Go module 怎麼拿到權限

`go` 抓 module 時一律用 https 網址。公司的私有 module 靠這兩項設定，改走 ssh 金鑰，不需要任何 token：

```bash title="~/.config/go/env"
GOPRIVATE=git.example.com/*
```

```ini title="~/.gitconfig（附加）"
[url "git@git.example.com:"]
	insteadOf = https://git.example.com/
```

- `GOPRIVATE`：這些 module 不走公開的 proxy，也不查公開的校驗資料庫，`go` 直接用 git 抓
- `insteadOf`：git 抓 `https://git.example.com/…` 時改走 ssh，用的是你的 ssh 金鑰

少了 `insteadOf`，`go get` 會卡在要帳號密碼。

## 重新取得就好

這些登入資訊跟機器綁在一起（有些存在系統的金鑰圈），複製檔案過去不一定能用：

- gh：`gh auth login`，再 `gh auth setup-git` 讓 git 透過 gh 認證
- Claude Code、Codex、gcloud、wrangler、docker、GitHub Copilot
- VPN：通常跟對方重新要一份設定檔（例如 `.ovpn`）匯入，比從舊電腦搬憑證省事

### `~/.git-credentials` 不要帶

`git config credential.helper store` 會讓 git 把 https 的帳密存成明碼的 `~/.git-credentials`，格式是 `https://帳號:token@主機`。誰讀得到這個檔，就拿得到 token。

先確認它還有沒有人用：任何一層都沒設 `credential.helper`，git 就不會讀這個檔。

```bash
git config --show-origin --get-all credential.helper   # 沒有輸出 = 沒有人用 store
```

| `credential.helper`      | 存在哪                                         |
| ------------------------ | ---------------------------------------------- |
| `store`                  | `~/.git-credentials` 明碼檔                    |
| `cache`                  | 記憶體，預設 15 分鐘後忘記                     |
| `libsecret`              | 系統的金鑰圈（GNOME Keyring）                  |
| `gh auth setup-git` 設的 | 交給 gh，用 gh 登入時存的 token（GitHub 專用） |

新電腦要用 https 存取 GitHub，跑 `gh auth setup-git` 就好，不要再用 `store`。刪掉舊檔之後，記得也到網站上撤銷那個 token。

## 不用帶

- 應用程式自己的狀態與快取：`~/.config` 底下大部分的資料夾、`~/.cache`
- 有雲端同步的：例如 VS Code 開了 Settings Sync，新電腦登入同一個帳號就會同步回來

## 秘密放檔案，還是交給金鑰圈

GNOME 桌面常用 **GNOME Keyring** 存放秘密。桌面登入時，PAM 若拿得到密碼且符合金鑰圈的密碼，通常會解鎖 Login 金鑰圈。程式可透過 D-Bus 的 Secret Service（例如 libsecret）存取，實際儲存方式依工具與環境而異。SSH agent 用途另有分工，負責金鑰簽署。

|                   | 檔案（例如 `~/.secrets/`） | GNOME Keyring                                                                                 |
| ----------------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| 解鎖              | 依檔案與目錄權限存取       | 使用 PAM 或手動解鎖                                                                           |
| WSL、伺服器       | 讀法都一樣                 | 需要自行安排使用者 D-Bus、Secret Service 與解鎖流程                                           |
| 從 ssh 遠端連進來 | 依遠端帳號的檔案權限       | 同一使用者的 SSH 工作階段要連得上使用者 D-Bus，且對應金鑰圈已解鎖。桌面鎖定狀態無法確認這兩項 |
| 換電腦            | 複製一個資料夾             | 重新登入各工具                                                                                |

用遠端帳號執行 `busctl --user --no-pager list` 可確認使用者匯流排是否可達，並查看 `org.freedesktop.secrets` 是否已提供服務。再用工具本身確認能否取用其登入狀態。冷開機後只走 SSH 時，金鑰圈可能仍未解鎖。

互動式工具可以把登入交給金鑰圈。需要在無人登入時執行的腳本與服務，可讀取只有服務帳號能讀的檔案。

要給人看的密碼（例如伺服器的登入密碼）適合放密碼管理工具，例如 Bitwarden（開源、免費版就夠用，可以自架）或 1Password（付費，介面與指令列 `op` 比較完整）。兩者都能從指令列取值：

```bash
export BW_SESSION="$(bw unlock --raw)"  # Bitwarden，已登入後解鎖
bw get password '<項目名稱>'
bw lock
unset BW_SESSION
op read "op://<保險庫>/<項目>/password"  # 1Password
```

## 參考連結

- [GNOME Keyring](https://wiki.gnome.org/Projects/GnomeKeyring)
- [GNOME Keyring 的 PAM 解鎖](https://wiki.gnome.org/Projects/GnomeKeyring/Pam)
- [freedesktop.org：Secret Service API](https://specifications.freedesktop.org/secret-service/latest/)
- [rsync 指令手冊](https://rsync.samba.org/ftp/rsync/rsync.1.html)
- [Bitwarden CLI](https://bitwarden.com/help/cli/)、[1Password CLI](https://developer.1password.com/docs/cli/)
- [sops](https://github.com/getsops/sops)
- [cloudflared：tunnel 的憑證檔](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/local-management/tunnel-permissions/)
- [git：credential helpers](https://git-scm.com/docs/gitcredentials)
- [Go：GOPRIVATE](https://go.dev/ref/mod#private-modules)
