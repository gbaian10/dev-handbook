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

## 一定要複製

| 類別                  | 常見位置                                                    | 說明                                                                                        |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 自己的秘密資料夾      | 例如 `~/.secrets/`                                          | 把 token、`.env`、各種私鑰集中放一個資料夾（權限 700），換電腦只要搬這一個                  |
| ssh 私鑰              | `~/.ssh/id_ed25519` 等（含 `.pub`）                         | 也可以在新電腦產生新金鑰，再到 GitHub、各伺服器重新登記；比較安全，但要登記的地方多就很麻煩 |
| 只屬於某台的 ssh 主機 | `~/.ssh/config.d/work.conf` 等                              | 見 [ssh 設定](/setup/ssh/)；每台都一樣的個人主機交給 dotfiles                               |
| sops 的 age 私鑰      | `~/.config/sops/age/keys.txt`                               | 弄丟了，用它加密的檔案就再也解不開                                                          |
| VPN 憑證              | 例如 `~/.cert/nm-openvpn/`                                  | NetworkManager 匯入 OpenVPN 設定時放的憑證與私鑰                                            |
| Cloudflare Tunnel     | `~/.cloudflared/`                                           | Tunnel 的憑證，不容易重新產生                                                               |
| GPG                   | `~/.gnupg/`                                                 | 有用 GPG 簽 commit 或加密時                                                                 |
| 雲端與 k8s 的設定     | `~/.kube/config`、`~/.aws/`、`~/.config/rclone/rclone.conf` | 帶走要用的設定與另存的憑證。工具快取可重建，登入工作階段可重新取得                          |

## 重新登入就好

這些工具的登入資訊跟機器綁在一起（有些存在系統的金鑰圈），複製檔案過去不一定能用：

- gh：`gh auth login`，再 `gh auth setup-git` 讓 git 透過 gh 認證
- Claude Code、Codex、gcloud、wrangler、docker、GitHub Copilot

`~/.git-credentials` 是明碼存放的 token，不要複製，改用 `gh auth setup-git`。

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
