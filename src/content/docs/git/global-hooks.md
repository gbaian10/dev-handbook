---
title: 全域 pre-commit hook
description: 用 git 的設定式 hook，讓每個有 .pre-commit-config.yaml 的 repo 自動跑 pre-commit，不必逐一 pre-commit install。
---

[pre-commit](https://pre-commit.com) 平常要在每個 repo 執行一次 `pre-commit install`，忘了就沒有檢查。
git 2.54 起可以在設定檔裡定義 hook，寫在 `~/.gitconfig` 一次就套用到所有 repo。

:::caution[先了解風險]
全域掛上 hook 之後，clone **任何** repo 後第一次 commit，就會執行對方 `.pre-commit-config.yaml` 指定的指令。
`--skip-on-missing-config` 只會跳過「沒有設定檔」的 repo，擋不住「設定檔有問題」的 repo。
pre-commit 官方也因此不建議全域安裝。

在不熟悉的 repo commit 之前，先看過它的 `.pre-commit-config.yaml`；不想跑時用 `git commit --no-verify` 跳過這一次。
:::

## 需要什麼

- **git 2.55 以上**。Ubuntu 26.04 內建的 2.53 還沒有設定式 hook，寫了也不會生效；用[新電腦從零開始](/setup/new-machine/)裡的 PPA 升級
- **pre-commit 4.6 以上，而且在 PATH 裡**。用 `git --version` 和 `pre-commit --version` 確認。啟用後，Git 找不到 `pre-commit` 時，commit 或 push 會失敗

## 設定

```ini title="~/.gitconfig（附加）"
[hook "pre-commit.pre-commit"]
	event = pre-commit
	command = pre-commit hook-impl --hook-type=pre-commit --skip-on-missing-config --
[hook "pre-commit.commit-msg"]
	event = commit-msg
	command = pre-commit hook-impl --hook-type=commit-msg --skip-on-missing-config --
[hook "pre-commit.pre-push"]
	event = pre-push
	command = pre-commit hook-impl --hook-type=pre-push --skip-on-missing-config --
```

或用指令寫入：

```bash
for ev in pre-commit commit-msg pre-push; do
  git config --global hook.pre-commit.$ev.event $ev
  git config --global hook.pre-commit.$ev.command "pre-commit hook-impl --hook-type=$ev --skip-on-missing-config --"
done
```

官方的全域範例設定 `pre-commit` 事件，這裡再依相同格式加入 `commit-msg` 與 `pre-push`。 [pre-commit 的設定式 hook 說明](https://pre-commit.com/#usage-with-git-254-hook-configuration) · [git hook 手冊](https://git-scm.com/docs/git-hook)

| 地方                            | 為什麼                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| hook 名稱用 `pre-commit.<事件>` | 依 pre-commit 的命名慣例，避開 Git 已知的事件名稱                                                              |
| 結尾的 `--`                     | 把 pre-commit 的選項和 Git 傳給 hook 的位置參數分開，讓 `commit-msg` 能收到訊息檔名，`pre-push` 能收到遠端資訊 |
| `--skip-on-missing-config`      | 沒有 `.pre-commit-config.yaml` 的 repo 直接跳過，不然每個 repo 都會報錯                                        |

:::note[名稱不含點會怎樣]
早期常見的寫法是區段名直接用事件名（`[hook "pre-commit"]`），在 2.54 可以用，升到 2.55 後會出現：

```text
fatal: hook friendly-name 'pre-commit' collides with a known event name; please choose a different friendly-name
```

而且只在真的觸發 hook 時才出錯（commit、checkout、clone 等），看起來像隨機發作。改名就好，`event` 與 `command` 不用動：

```bash
git config --global --rename-section hook.pre-commit 'hook.pre-commit.pre-commit'
git config --global --rename-section hook.commit-msg 'hook.pre-commit.commit-msg'
git config --global --rename-section hook.pre-push   'hook.pre-commit.pre-push'
```

:::

## 不要再執行 pre-commit install

`pre-commit install` 會在 repo 的 `.git/hooks/` 再裝一份，加上全域這份，每個 hook 會跑兩次。
用了全域 hook，只要確認這三種事件沒有重複掛上 pre-commit。其他工具仍可能各自有 hook。

已經裝過的 repo，在該 repo 裡移除：

```bash
pre-commit uninstall
pre-commit uninstall --hook-type commit-msg
pre-commit uninstall --hook-type pre-push
```

## 確認

到一個有 `.pre-commit-config.yaml` 的 repo：

```bash
for ev in pre-commit commit-msg pre-push; do
  printf '%-11s → ' "$ev"
  git hook list "$ev"
done
# pre-commit  → pre-commit.pre-commit
# commit-msg  → pre-commit.commit-msg
# pre-push    → pre-commit.pre-push
```

若其中一個事件多出檔案路徑，檢查該檔案是否也是 pre-commit 產生的 hook。

## 跳過或關掉 hook

| 想要                          | 做法                                                 | 範圍                                                                         |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| 某個 repo 永遠不跑全域 hook   | 在該 repo 執行下方的 `git config`（不加 `--global`） | 寫在該 repo 的 `.git/config`，不進版控；GUI 工具、systemd 服務 commit 也生效 |
| 某個 repo 固定跳過某幾個 hook | 在該 repo 的 `mise.local.toml` 設 `SKIP` 環境變數    | 只在有啟動 mise 的終端機生效                                                 |
| 只跳過這一次                  | `git commit --no-verify`、`git push --no-verify`     | 這一次                                                                       |
| 只關掉這一次的某個事件        | `git -c hook.pre-commit.pre-push.enabled=false push` | 這一次                                                                       |

### 整個 repo 關掉

在該 repo 裡執行，只影響這個 repo：

```bash
for ev in pre-commit commit-msg pre-push; do
  git config hook.pre-commit.$ev.enabled false
done
git hook list pre-commit   # 顯示 disabled
```

要恢復就 `git config --unset hook.pre-commit.<事件>.enabled`。

### 固定跳過某幾個 hook

pre-commit 會讀 `SKIP` 環境變數，值是用逗號分隔的 **hook id** 或別名。要跳過整個事件時，使用上表的 Git 選項。 [pre-commit 的單次略過說明](https://pre-commit.com/#temporarily-disabling-hooks)

```bash
SKIP=ruff,mypy git commit -m "…"
```

想在某個專案固定生效，寫進該專案的 `mise.local.toml`（已經在[全域忽略檔](/git/config/#git-全域忽略檔)裡，不會被提交）：

```toml title="mise.local.toml"
[env]
SKIP = "ruff,mypy"
```

`SKIP` 只存在 mise 有啟動的 shell 裡；從 GUI 工具或 systemd 服務 commit 時不會生效。

:::note[`.pre-commit-config.yaml` 裡的 `ci: skip`]
設定檔裡的 `ci:` 區塊（例如 `skip: [...]`）是給 [pre-commit.ci](https://pre-commit.ci) 雲端服務用的，本機的 pre-commit 不會讀。
:::

## 要知道的副作用

- **單點依賴**：所有 repo 都靠這份設定。刪除設定會停用全域檢查，命令失效則可能讓 commit 或 push 中止
- **PATH**：GUI 程式或 systemd 服務可能找不到 `pre-commit`。見 [PATH 擺法](/setup/path/#實際案例服務裡-commit-找不到-pre-commit)
