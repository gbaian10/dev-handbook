---
title: ssh 設定
description: 用 Include 把 ~/.ssh/config 拆成多個檔，哪些交給 dotfiles、哪些每台自己放；多個 GitHub 帳號怎麼分。
---

主機一多，`~/.ssh/config` 就會變成一大串。拆成多個檔之後，共用的非機密設定交給 dotfiles 管理，組織或合作方的連線設定只放在有相應存取權限的主機。

## 拆成多個檔

ssh 會自動讀 `~/.ssh/config`，其他使用者設定檔用 `Include` 載入。把它放在主檔的第一個指令，讓各主機的設定先於共用預設讀到。

```text title="~/.ssh/config"
Include ~/.ssh/config.d/*.conf

Host *
  IdentitiesOnly yes
  AddKeysToAgent yes
  ForwardAgent no

Host * !github.personal
  IdentityFile ~/.ssh/id_ed25519
```

```text title="~/.ssh/config.d/"
personal.conf    ← 每台都一樣的個人主機，交給 dotfiles
work.conf        ← 組織的連線設定，只放在獲授權的主機
vendor.conf      ← 合作方的連線設定
```

- 用 `mkdir -p ~/.ssh/config.d && chmod 700 ~/.ssh ~/.ssh/config.d` 建目錄。各設定檔存好後設成 600，例如 `chmod 600 ~/.ssh/config ~/.ssh/config.d/personal.conf`
- `*.conf` 依**檔名排序**讀進來；資料夾不存在或是空的都不會報錯。備份檔取名成 `work.conf.bak` 這種不是 `.conf` 結尾的，就不會被讀進去
- 改完不用重新載入：ssh 每次連線都重新讀設定
- Ubuntu 的系統設定 `/etc/ssh/ssh_config` 也用 `Include /etc/ssh/ssh_config.d/*.conf`

:::caution[先載入各主機的設定]
少了 `Include`，別名可能會被當成 DNS 名稱，`git fetch` 就會收到 `Could not resolve hostname`。OpenSSH 允許在 `Host` 或 `Match` 區塊內條件式載入。這裡每個主機都需要讀拆出的設定，因此把 `Include` 放在第一個區塊之前。
:::

## 先讀到的贏

ssh 把 `Include` 的檔案原地展開，從上往下讀；每次連線時，**所有符合的 `Host` 區塊都會套用**，但同一個設定項**只採用第一次讀到的值**。

所以擺放的規則是：

| 放哪裡            | 放什麼           | 為什麼                                           |
| ----------------- | ---------------- | ------------------------------------------------ |
| 主檔最上面        | `Include`        | 各主機的設定要先被讀到                           |
| `config.d/*.conf` | 各主機自己的區塊 | 一個主機別名只寫在一個檔裡，檔案順序就不影響結果 |
| 主檔後段          | `Host *`         | 用前面還沒設定的選項補上共用預設                 |

把共用的 `Host *` 留在主檔後段。如果拆出的檔案先替所有主機設定某個值，後讀到的個別主機設定就蓋不過它。

`IdentityFile`、`LocalForward`、`RemoteForward` 會累加。上例的 `Host * !github.personal` 讓一般主機使用預設金鑰，並將個人別名排除在這把金鑰的適用範圍外。

## 確認最後拿到什麼

沒有一條指令能印出「整份合併後的設定」，因為結果是依主機決定的。看某一台：

```bash
host=github.personal # 換成要檢查的別名
ssh -G "$host"       # 印出最後套用的設定，不建立連線
ssh -G "$host" | rg '^(hostname|proxyjump|identityfile|identityagent|identitiesonly) '
ssh -vvv -G "$host" 2>&1 | rg 'Reading configuration' # 依序讀了哪些檔
```

`-v` 是 verbose，連不上時用 `ssh -v <主機>` 看卡在哪一步；`v` 疊越多印得越細。這些訊息印在 stderr，接管線要加 `2>&1`。

## 多個 GitHub 帳號

同一台電腦有工作和個人兩個 GitHub 帳號時，個人帳號另取一個主機別名。先為個人帳號準備金鑰並將公鑰登記到 GitHub，再調整範例的私鑰路徑。 [GitHub 的 SSH 金鑰設定](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

```text title="~/.ssh/config.d/personal.conf"
Host github.personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/personal_ed25519
  IdentityAgent none
```

clone 個人 repo 時用別名，例如 `git clone git@github.personal:username/project.git`。將 `username/project` 換成實際的擁有者與 repo 名稱。工作帳號照常用 `github.com`。

確認三個選項的分工：

| 設定                 | 作用                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `IdentityAgent none` | 這個別名停用 agent，私鑰有密碼時可能要手動輸入。如果想讓 agent 代簽，保留 `IdentitiesOnly yes` 並確認有效的 `IdentityFile` 只有個人金鑰 |
| `User git`           | GitHub SSH 使用固定的登入名稱 `git`，這行讓 `ssh -T github.personal` 可以省略 `git@`                                                    |
| `IdentitiesOnly yes` | 沿用主檔的共用設定，限制可用身分。若有多個符合的 `IdentityFile`，那些金鑰仍都可用，agent 裡已載入的相符金鑰還可能優先                   |

確認認成哪個帳號：

```bash
ssh -T git@github.personal
# Hi <帳號>! You've successfully authenticated, but GitHub does not provide shell access.
```

先用 `ssh -G github.personal` 核對生效的金鑰清單，再看 GitHub 問候中的帳號。GitHub 的這個測試即使驗證成功也會回傳狀態碼 1。

不想每次 clone 都手動改網址，可以讓 git 自動改寫，見 [git 設定〈多個 GitHub 帳號〉](/git/config/#多個-github-帳號)。

## ForwardAgent

`ForwardAgent yes` 會讓遠端主機上的程式向本機的 SSH agent 要求簽署，例如在伺服器上執行 `git pull`。遠端具備存取轉送 socket 權限的程序也能在連線期間要求簽署，所以只在信任且確實需要的主機啟用。

- `Host *` 預設寫 `no`，真的需要的主機在自己的區塊寫 `yes`
- 經跳板機連線用 `ProxyJump` 就好，不需要轉發 agent：`ProxyJump` 是從你這台直接認證

## 密碼不要寫在設定檔

常見的壞習慣是在 `Host` 上方的註解寫下那台的登入密碼。設定檔會被複製、備份、同步，密碼就跟著到處跑。密碼放進密碼管理工具（例如 Bitwarden、1Password），設定檔只留連線設定。

## VS Code 開 `.conf` 會被改掉縮排

縮排對 ssh 沒有任何意義，只是給人看。但 VS Code 裝了 nginx 擴充套件時，`.conf` 會被當成 nginx 設定，開著存檔自動排版（`editor.formatOnSave`）就會把縮排整理掉。

Remote - SSH 系列的擴充套件提供 `ssh_config` 這個語言模式（語法上色、補全），但只認 `~/.ssh/config`。把 `config.d` 也指定過去：

```json title="VS Code settings.json"
"files.associations": {
  "**/.ssh/config.d/*.conf": "ssh_config"
}
```

## ssh 與 sshd

| 程式   | 角色                               | 設定檔                                                  | 什麼時候讀設定       |
| ------ | ---------------------------------- | ------------------------------------------------------- | -------------------- |
| `ssh`  | 用戶端，你連出去時執行             | `~/.ssh/config`、`/etc/ssh/ssh_config`                  | 每次執行都重新讀     |
| `sshd` | 伺服器，在被連的機器上等別人連進來 | `/etc/ssh/sshd_config`、`/etc/ssh/sshd_config.d/*.conf` | 啟動或重新載入時讀取 |

需要接受連線的 Ubuntu 主機才需要安裝 `openssh-server`。共用伺服器的服務設定由管理員處理。先查 `systemctl status ssh.socket ssh.service` 確認啟動模式，再用 `sudo sshd -t` 檢查修改後的設定。

- 使用 `ssh.socket` 時，Ubuntu 24.04 LTS 起會由 systemd generator 讀取 sshd 設定的埠號與位址。先用 `systemctl cat ssh.socket` 查有無獨立的覆寫設定，再執行 `sudo systemctl daemon-reload` 和 `sudo systemctl restart ssh.socket`。
- 由 `ssh.service` 直接監聽時，依 Ubuntu 的文件執行 `sudo systemctl restart ssh.service`。

保留原連線，從另一個終端機測試新連線，再關閉原工作階段。 [Ubuntu 的 OpenSSH 伺服器說明](https://documentation.ubuntu.com/server/how-to/security/openssh-server/)

## 參考連結

- [ssh_config(5)](https://man.openbsd.org/ssh_config)：每個設定項的說明，含 `Include` 與「先讀到的贏」的規則
- [GitHub：Testing your SSH connection](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)
- [Ubuntu：SSH socket activation](https://discourse.ubuntu.com/t/sshd-now-uses-socket-based-activation-ubuntu-22-10-and-later/30189)
