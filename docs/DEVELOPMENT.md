# Pengembangan Dynamic Island

## Arsitektur v0.2

UI memakai React, TypeScript, Vite, dan Motion. Host `native/WindowsHost` adalah executable C# x64 yang menargetkan .NET Framework 4.8 dan memakai WebView2 Evergreen bersama milik Windows. Windows 10 2004+ dan Windows 11 menyertakan .NET Framework 4.8 atau versi kompatibelnya. Distribusi tidak membundel Electron, Chromium, Node.js, atau runtime .NET mandiri.

`WindowsHost/Program.cs` menangani window transparan/topmost, monitor utama, DPI, tray, single instance, WebView2, dan IPC. `ActivityService.cs` menangani validasi command, preferensi, timer persisten, dan baterai lewat `GetSystemPowerStatus`. Clock timer terpisah dari polling media agar menunggu WinRT tidak menahan hitung mundur.

Layanan GSMTC dan Core Audio berada di `native/WindowsHost/Services` dan berjalan langsung pada STA host. Implementasi Electron dan helper .NET 10 lama telah dihapus.

`src/platform/webview.js` menyediakan kontrak `window.desktop` sebelum React berjalan. UI disajikan dari virtual origin `https://island.local`. Host menerima pesan hanya dari dokumen yang diizinkan, memvalidasi command, dan menolak navigasi, popup, permission, download, serta host objects. Tidak ada API shell/file generik. CSP membatasi resource. DevTools hanya aktif dengan `ISLAND_TEST=1`; smoke test memakai CDP localhost pada proses tes.

## Build dan pengujian

Siapkan Windows x64, Node.js 22.18+ atau 24+, npm, dan .NET 10 SDK untuk kompilasi. Reference assemblies .NET Framework diambil melalui NuGet; pengguna aplikasi tidak memerlukan SDK.

```sh
npm ci
npm run dev
```

`npm run dev` membangun lalu menjalankan host. Untuk iterasi UI dengan HMR tanpa integrasi Windows, gunakan `npm run dev:web`. Build dan mulai ulang host setelah perubahan untuk menguji integrasi desktop. SDK dicari di `.tools/dotnet/dotnet.exe`, lalu PATH; `DOTNET_EXECUTABLE` dapat memilih lokasi lain.

| Perintah | Fungsi |
| --- | --- |
| `npm run typecheck` | Periksa tipe UI dan konfigurasi Vite |
| `npm run lint` | Oxlint |
| `npm test` | Regresi pemilihan aktivitas, kontrak command, timeline media, dan sisa waktu timer |
| `npm run test:ui` | Regresi panel musik, timer, volume, baterai, dan scrollbar |
| `npm run test:startup` | Integrasi registry startup, opt-out, pindah lokasi, dan uninstall pada key sementara |
| `npm run build` | Build Vite dan WindowsHost |
| `npm start` | Jalankan hasil build |
| `npm run test:smoke` | Uji host, UI, timer, penyimpanan, dan restart |
| `npm run pack` | Stage ke `release/webview-unpacked` |
| `npm run test:smoke -- --packaged` | Uji executable distribusi |
| `npm run dist:win` | Buat installer EXE NSIS |

`electron-builder` hanya membungkus folder `--prepackaged`, tanpa mengemas runtime Electron. `electronVersion` hanya memenuhi metadata tool packaging; package/runtime Electron tidak lagi menjadi dependensi npm. Staging menyalin executable/config, dependency managed, loader WebView2 x64, adapter desktop, dan UI. PDB, XML docs, WPF, loader x86/ARM64, dan runtime .NET tidak disertakan.

Smoke test memeriksa snapshot OS, command tidak valid, round-trip volume/mute yang sedang berlaku, timer start/pause/resume/finish/cancel, persistensi dan pemulihan setelah restart, layout, Escape, dan clean shutdown. Lokal juga memeriksa hit testing Windows asli serta transparansi lewat screenshot sebelum/sesudah overlay. Audio lokal harus tersedia; pada CI endpoint audio boleh unavailable. Semua pengujian memakai profil sementara.

Tetap verifikasi manual: pergantian perangkat audio, playback/seek pada pemutar lain, cabut/pasang charger, sleep/resume, monitor/DPI, klik di atas aplikasi elevated/exclusive fullscreen, dan startup setelah login.

## Distribusi dan runtime

Installer sekitar 1,24 MB; folder aplikasi sekitar 3 MB. Ukuran ini tidak termasuk runtime WebView2 bersama, profil, dan cache. Installer memakai kompresi solid. Tidak ada auto-update aplikasi.

Auto startup aktif secara default melalui nilai `Dynamic Island` di `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, dengan path executable dalam tanda kutip. Installer mendaftarkannya setelah WebView2 tersedia. Menu tray **Jalankan saat login Windows** menyimpan pilihan di `HKCU\Software\Andika\DynamicIsland\StartupEnabled`, sehingga pembaruan tidak mengaktifkan kembali pilihan yang dimatikan. Uninstaller menghapus entri startup hanya bila masih menunjuk salinan yang dihapus. Pengaturan Startup Windows tetap berlaku. `npm start`, `ISLAND_TEST=1`, dan profil kustom tidak mendaftarkan startup.

Installer menjalankan `--ensure-webview`. Jika runtime tersedia, tidak ada unduhan tambahan. Jika belum, host mengunduh bootstrapper resmi Microsoft melalui HTTPS, memverifikasi kepercayaan Authenticode dan publisher Microsoft, lalu menjalankan `/silent /install`. Kegagalan menghentikan pemasangan dengan petunjuk mencoba kembali. Jalur runtime-belum-terpasang masih memerlukan verifikasi pada Windows bersih; lokal memakai runtime yang sudah tersedia. Installer aplikasi belum ditandatangani sehingga SmartScreen dapat muncul.

Profil `%APPDATA%/dynamic-island` kompatibel dengan versi sebelumnya; `ISLAND_PROFILE_DIR` memilih profil lain. Preferensi/timer disimpan melalui penggantian file atomik. Timer memakai deadline UTC, pulih setelah restart/sleep, dan memakai suara sistem ketika selesai. Baterai dibaca langsung melalui Win32 tanpa PowerShell. Media/audio dipoll setiap 500 ms tanpa tumpang tindih.

Window maksimum 460 × 320 DIP, 12 DIP dari sisi atas work area monitor utama. Area kosong dan sudut membulat meneruskan klik; host memeriksa cursor terhadap DOM karena WebView2 tidak meneruskan mousemove selama click-through. Tray menyediakan Tampilkan, Sembunyikan, Keluar; instance kedua menampilkan instance pertama.

Pembaca notifikasi Windows dan packaging MSIX telah dihapus. Rilis memakai installer EXE; pengguna MSIX lama perlu uninstall melalui Settings → Apps sebelum memasang EXE.

## GitHub Release

Workflow berjalan pada push `main`/`master`, PR, tag `v*`, atau manual. CI menjalankan lint, unit test, build, dan smoke test pada executable terpaket. Installer harus di bawah 5 MB. Artifact installer/checksum disimpan 14 hari; screenshot disimpan 7 hari.

Untuk rilis, ubah versi package/lockfile, commit, push, dan push tag `v` + versi package. Contoh versi berikutnya:

```sh
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release v0.2.7" -m "Co-authored-by: Codex <noreply@openai.com>"
git push origin main
git tag v0.2.7
git push origin v0.2.7
```

Setelah pemeriksaan lulus, tag push menerbitkan Release dengan installer EXE, checksum SHA256, dan release notes. Push branch/manual hanya menghasilkan artifact.

Saat merilis ulang versi yang sama, workflow mengunggah installer/checksum terlebih dahulu lalu menghapus aset MSIX, sertifikat publik, dan ZIP pada Release tersebut. Rilis historis lain tetap tersedia.
