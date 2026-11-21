---
title: 自己寫的小工具
description: 放在 ~/bin 的幾支腳本：一鍵修 Markdown 與 YAML 排版、讓 sudo 跳密碼視窗、定期清 Go 編譯快取、裁影片頭尾。
---

自己寫的腳本放 `~/bin`，跟工具安裝程式放進 `~/.local/bin` 的東西分開（見 [PATH 擺法](/setup/path/)）。
交給 dotfiles 管理時，來源檔名加 `executable_` 前綴，套用後就有執行權限。

## mdfix、ymlfix：一鍵修排版

markdownlint 會挑出表格沒對齊、pipe 兩側沒空格（MD060），但 `--fix` 不會幫你對齊表格。
這兩支用 Bun 內建的格式化工具 `bun fmt` 直接排好，Markdown 的結果跟 prettier 一字不差。

```sh title="~/bin/mdfix"
#!/bin/sh
set -eu
[ "$#" -gt 0 ] || { echo "usage: mdfix <markdown_file...>" >&2; exit 1; }
exec bun --config=/dev/null fmt --no-script --no-config --no-editorconfig --ignore-path=/dev/null "$@"
```

`ymlfix` 一樣，最後多一個 `--print-width=100`。

格式固定一種、指名的檔案一定要排，所以關掉所有會改變行為的專案設定：

| 參數                      | 為什麼                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `--config=/dev/null`      | 不讀專案的 `bunfig.toml`。專案常在 `[fmt]` 的 `ignorePatterns` 排除 `*.md`，不關的話會顯示「Formatted 0 files」、什麼都沒做 |
| `--no-config`             | 不讀 `.prettierrc` 等 prettier 設定                                                                                         |
| `--no-editorconfig`       | 不讀 `.editorconfig`                                                                                                        |
| `--ignore-path=/dev/null` | 不讀 `.gitignore`、`.prettierignore`                                                                                        |
| `--no-script`             | `package.json` 有 `fmt` script 時，`bun fmt` 會改跑那個 script，檔案不會被排                                                |

同一份檔案各跑 8 次的平均（含啟動）：

| 做法                       | 時間      |
| -------------------------- | --------- |
| `docker run` prettier 映像 | 約 500 ms |
| `bunx prettier@3`          | 約 170 ms |
| `bun fmt`                  | 約 4 ms   |

`bun fmt` 修不了要判斷內容的問題，例如 code block 沒標語言（MD040），那要自己補。
先用 `bun fmt --help --all` 確認工具支援這些旗標，再執行 `mdfix README.md`。如果檔案在 Git 裡，`git diff -- README.md` 可以核對排版改動。

## claude-askpass：讓 sudo 跳密碼視窗

AI 代理（例如 Claude Code）執行的指令沒有終端機可以輸入密碼。`sudo -A` 會改呼叫 `SUDO_ASKPASS` 指定的程式來要密碼，
這支用 zenity 在桌面跳出密碼框，密碼直接交給 sudo，代理看不到。

```bash
SUDO_ASKPASS="$HOME/bin/claude-askpass" sudo -k -A -p "要執行：確認 askpass" -- true
```

- Ubuntu 25.10 起預設改用 sudo-rs。上游從 0.2.11 支援 `-A`，Ubuntu 26.04 隨附的 0.2.13 可用 `sudo --help` 確認有 `--askpass`
- 先用 `command -v zenity` 確認有密碼視窗工具。若缺少，Ubuntu 或啟用了 WSLg 的 Ubuntu WSL 都可用 `sudo apt install zenity` 安裝
- GNOME 會查 `loginctl` 的 `LockedHint` 與閒置時間。WSL 嘗試用 `tasklist.exe` 找 `LogonUI.exe` 判斷 Windows 鎖定。狀態查不到時由視窗逾時結束
- `-k` 讓這次命令忽略既有的驗證紀錄，`-A` 選用密碼視窗。sudoers 仍決定是否需要驗證。如果政策要求密碼，上例會顯示視窗，驗證成功時 `true` 回傳 0

## go-cache-trim：定期清 Go 編譯快取

Go 的編譯快取沒有大小上限，Go 會定期修剪一段時間未用的項目。用 `go env GOCACHE` 查位置，通常是 `~/.cache/go-build`。
這支腳本超過門檻就刪掉快取，下次編譯會重建。先執行 `go-cache-trim --dry-run` 核對目錄、大小和門檻，再用 systemd user timer 定期執行。

```ini title="~/.config/systemd/user/go-cache-trim.service"
[Service]
Type=oneshot
Environment=GO_CACHE_MAX_GB=30
ExecStart=%h/bin/go-cache-trim
Nice=19
IOSchedulingClass=idle
```

```ini title="~/.config/systemd/user/go-cache-trim.timer"
[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now go-cache-trim.timer
systemctl --user list-timers go-cache-trim.timer   # 確認下次執行時間
```

- `%h` 是 systemd 的寫法，代表家目錄
- `Persistent=true`：timer 停止期間錯過一次或多次時，timer 再啟用會補跑一次。user timer 通常要等使用者登入才會啟用
- 腳本先檢查快取根目錄有沒有 Go 放的 `README`，確認真的是 Go 的快取才刪

chezmoi 會放好 unit 檔。要在套用後自動啟用 timer，可用 `run_onchange_after_` 腳本執行同一組 `systemctl` 指令，並把 unit 檔的雜湊值放在註解裡，讓 unit 有變更時重跑。如果首次套用時無法連到 user manager，等它可用後手動執行上面的三個指令。

## vtrim：裁掉影片頭尾

錄完螢幕常要剪掉開頭準備和結尾停止錄影的幾秒：

```bash
vtrim recording.mp4 5 2   # 裁掉開頭 5 秒、結尾 2 秒，輸出 recording_trimmed.mp4
```

以總長 8 秒的 MP4 為例，裁掉開頭 5 秒、尾端 2 秒，輸入端的停止時間就是第 6 秒。可以用 ffprobe 檢查輸出的片長：

```bash
ffmpeg -n -ss 5 -to 6 -i recording.mp4 -map 0 -c copy recording_trimmed.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 recording_trimmed.mp4
```

- `-c copy` 直接複製串流，`-map 0` 避免自動選軌時省略額外音軌。輸入檔需有容器副檔名，輸出沿用它
- 腳本把 `-ss`、`-to` 放在 `-i` 前當作輸入選項。這樣尋址會保留需要的關鍵影格。起點及片長會隨關鍵影格與來源格式而異，適合快速裁切
- 腳本用 `ffprobe` 自動取得總長，先完成暫存輸出才建立成品檔名。成品存在或 ffmpeg 失敗時會報錯，保留原檔
- 需要 ffmpeg：`sudo apt install ffmpeg`

## 參考連結

- [Bun：bun fmt](https://bun.com/docs/format)
- [FFmpeg：指令選項、尋址與串流選擇](https://ffmpeg.org/ffmpeg.html)
- [sudo-rs](https://github.com/trifectatechfoundation/sudo-rs)
- [Ubuntu：sudo-rs 指令手冊](https://manpages.ubuntu.com/manpages/resolute/man8/sudo-rs.8.html)
- [Go：預設編譯快取的位置](https://go.dev/src/cmd/go/internal/cache/default.go)
- [systemd.timer](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)
- [chezmoi：source state attributes](https://www.chezmoi.io/reference/source-state-attributes/)、[run scripts](https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/)
