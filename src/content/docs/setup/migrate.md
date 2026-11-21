---
title: 換電腦要手動帶走的東西
description: dotfiles 只放設定、不放秘密。私鑰、token、憑證這些要自己搬；哪些該複製、哪些重新登入就好。
---

dotfiles 管的是**設定**，換電腦時一條指令就能套回來。但**秘密**（私鑰、token、憑證）不該進 dotfiles 的 repo，要另外搬。

秘密遷移只適用於 Ubuntu 桌面、Windows 上的 WSL 和個人遠端伺服器。共用伺服器只套用所需的非機密設定。

## 怎麼傳

兩台電腦都能透過 SSH 連線時，可直接用 rsync 傳。兩端都需要安裝 `rsync`，舊電腦還要能接受 SSH 連線。先依 [SSH 設定](/setup/ssh/)核對連線。在範例中將 `example.com` 換成舊電腦可連線的 SSH 位址或別名。

```bash
# 在新電腦上，從舊電腦拉
old=example.com
mkdir -p -m 700 "$HOME/.secrets" && chmod 700 "$HOME/.secrets"
rsync -a -e ssh --chmod=D700,F600 "$old:~/.secrets/" "$HOME/.secrets/"
```

`-e ssh` 明確指定 SSH，`--chmod=D700,F600` 將收到的目錄與檔案分別設成 700 與 600。搬完可用 `stat` 確認目錄權限，再用 checksum 做一次模擬同步。同步後來源未再變動時，第二條命令不應列出待更新項目。

```bash
stat -c '%a %n' "$HOME/.secrets"
rsync -anci -e ssh --chmod=D700,F600 "$old:~/.secrets/" "$HOME/.secrets/"
```

## 先盤點：還有沒有在用

搬之前先盤點憑證和設定的用途。修改時間只表示檔案上次改寫的時間，備用金鑰仍可能用來解密或復原。保留舊電腦的資料，等新電腦的登入、解密和服務都確認可用後，再清理確定已停用的憑證。

```bash
ls -l --time-style=long-iso ~/.cloudflared ~/.gnupg  # 查看檔名與修改時間
gpg --list-secret-keys                                # 查看 GnuPG 可用的私鑰
rg -l 'git-credentials|GIT_AUTH_TOKEN' ~/projects     # 查找引用憑證的專案檔案，只列檔名
```

把 `~/projects` 換成實際的專案目錄。GnuPG 列出的項目也可能包含硬體金鑰，仍需保留可用的硬體或備份。

使用 NetworkManager 管理 VPN 的 Ubuntu 桌面，可用 `nmcli -f NAME,TYPE,TIMESTAMP-REAL connection show` 查看連線記錄。 [NetworkManager 的 nmcli 手冊](https://networkmanager.dev/docs/api/latest/nmcli.html)

## 需要遷移的秘密

| 類別              | 常見位置                                                     | 說明                                                                       |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 自己的秘密資料夾  | 例如 `~/.secrets/`                                           | 把 token、`.env`、各種私鑰集中放一個資料夾（權限 700），換電腦只要搬這一個 |
| SSH 金鑰          | `~/.ssh/id_ed25519` 等（含 `.pub`）                          | 優先在新電腦產生新金鑰並重新登記。只有服務仍需要同一把金鑰時才移轉         |
| sops 的 age 私鑰  | `~/.config/sops/age/keys.txt`                                | 弄丟了，用它加密的檔案就再也解不開                                         |
| GPG 資料          | `~/.gnupg/`                                                  | 有用 GPG 簽 commit 或加密時，盤點金鑰、信任設定與硬體金鑰後再搬            |
| Cloudflare Tunnel | `~/.cloudflared/cert.pem`、`~/.cloudflared/<tunnel-id>.json` | 見下面〈cloudflared 留下的檔案〉，不是每個檔都要帶                         |

### cloudflared 留下的檔案

依建立 tunnel 的方式不同，`~/.cloudflared/` 裡的檔案用途也不同：

| 做了什麼                           | 留下的檔案                 | 綁在哪                                                           | 換電腦                     |
| ---------------------------------- | -------------------------- | ---------------------------------------------------------------- | -------------------------- |
| `cloudflared tunnel login`         | `cert.pem`                 | **Cloudflare 帳號**：可用它建立、列出與刪除該帳號的 tunnel       | 帶走，或在新電腦重新 login |
| `cloudflared tunnel create <名稱>` | `<tunnel-id>.json`         | **每個 tunnel 一個**：執行那個 tunnel 用的憑證                   | 還要跑這個 tunnel 就帶走   |
| 在 Cloudflare 網頁後台建立 tunnel  | 不留檔案，網頁給一串 token | 每個 tunnel 一個 token，用 `cloudflared tunnel run --token …` 跑 | 不用帶，token 從後台再拿   |
| `cloudflared access login <網址>`  | Access token 快取          | 登入受 Access 保護的應用程式，依工作階段期限到期                 | 在新電腦重新登入           |

## 工作用的設定

依組織的存取規則，把需要的設定移到有相應權限的主機。

- **只屬於某台的 ssh 主機**：例如 `~/.ssh/config.d/work.conf`，見 [ssh 設定](/setup/ssh/)。每台都一樣的個人主機交給 dotfiles
- **雲端與 k8s 的設定**：`~/.kube/config`、`~/.aws/`、`~/.config/gcloud/configurations/`（gcloud 的命名設定，記專案與帳號，不含登入憑證）
- **本機跑的 k8s 叢集**（例如 k3s）：屬於系統層的資料，照該工具官方的備份還原步驟搬
- **組織的私有 Go module**：見下一節

### 私有 Go module 怎麼拿到權限

如果私有 module 的 Git 來源網址是 HTTPS，可以設定 `GOPRIVATE` 並讓 Git 改走 SSH。先把公鑰登記到 Git 服務，再按服務提供的 SSH clone 網址調整下方的使用者與前綴。若已有 `GOPRIVATE`，將新前綴加入原有的逗號分隔清單。

```bash
go env -w 'GOPRIVATE=git.example.com'
```

```ini title="~/.gitconfig（附加）"
[url "git@git.example.com:"]
	insteadOf = https://git.example.com/
```

- `GOPRIVATE`：預設讓符合前綴的 module 略過公開 proxy 和校驗資料庫。個別設定的 `GONOPROXY` 或 `GONOSUMDB` 可以覆寫這個預設
- `insteadOf`：git 抓 `https://git.example.com/…` 時改走 ssh，用的是你的 ssh 金鑰

先用 `go env GOPRIVATE` 及 `git ls-remote --get-url https://git.example.com/team/repo.git` 核對前綴與改寫結果，再從 Go 專案執行 `go mod download` 驗證。Go 可能先以 HTTPS 查詢 `?go-get=1` 取得 repo 資訊，`insteadOf` 只改寫 Git 的連線。 [Go 的私有 module 說明](https://go.dev/ref/mod#private-modules)

## 重新取得就好

這些工具建議在新電腦重新登入。登入資訊可能存在舊電腦的系統金鑰圈，或已有各自的到期時間。

- gh：`gh auth login`。GitHub repo 若使用 HTTPS，再執行 `gh auth setup-git`
- Claude Code、Codex、gcloud、wrangler、docker、GitHub Copilot
- VPN：通常跟對方重新要一份設定檔（例如 `.ovpn`）匯入，比從舊電腦搬憑證省事

### `~/.git-credentials` 不要帶

`git config credential.helper store` 會讓 git 把 https 的帳密存成明碼的 `~/.git-credentials`，格式是 `https://帳號:token@主機`。誰讀得到這個檔，就拿得到 token。

在使用 HTTPS 的 repo 裡查看通用與網址專用的 helper 設定。看到 `store` 時，核對它是否用了自訂檔案路徑。

```bash
git config --show-origin --get-regexp '^credential(\..*)?\.helper$'
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
- [Bitwarden CLI](https://bitwarden.com/help/cli/)、[1Password CLI](https://www.1password.dev/cli)
- [sops](https://github.com/getsops/sops)
- [cloudflared：tunnel 的憑證檔](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/tunnel-permissions/)
- [cloudflared：使用 CLI 登入 Access](https://developers.cloudflare.com/cloudflare-one/tutorials/cli/)
- [git：credential helpers](https://git-scm.com/docs/gitcredentials)
- [Go：GOPRIVATE](https://go.dev/ref/mod#private-modules)
