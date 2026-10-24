# Pengembangan Dynamic Island

## Arsitektur v0.2

UI memakai React, TypeScript, Vite, dan Motion. Host `native/WindowsHost` adalah executable C# x64 yang menargetkan .NET Framework 4.8 dan memakai WebView2 Evergreen bersama milik Windows. Windows 10 2004+ dan Windows 11 menyertakan .NET Framework 4.8 atau versi kompatibelnya. Distribusi tidak membundel Electron, Chromium, Node.js, atau runtime .NET mandiri.

`WindowsHost/Program.cs` menangani window transparan/topmost, monitor utama, DPI, tray, single instance, WebView2, dan IPC. `ActivityService.cs` menangani validasi command, preferensi, timer persisten, dan baterai lewat `GetSystemPowerStatus`. Clock timer terpisah dari polling media agar menunggu WinRT tidak menahan hitung mundur.

Layanan GSMTC, Core Audio, dan notifikasi berada di `native/WindowsHost/Services` dan berjalan langsung pada STA host. Implementasi Electron dan helper .NET 10 lama telah dihapus.

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
| `npm run test:ui` | Regresi animasi panel, scrollbar, dan alur notifikasi dengan data simulasi |
| `npm run test:startup` | Integrasi registry startup, opt-out, pindah lokasi, dan uninstall pada key sementara |
| `npm run build` | Build Vite dan WindowsHost |
| `npm start` | Jalankan hasil build |
| `npm run test:smoke` | Uji host, UI, timer, penyimpanan, dan restart |
| `npm run pack` | Stage ke `release/webview-unpacked` |
| `npm run test:smoke -- --packaged` | Uji executable distribusi |
| `npm run dist:win` | Buat installer NSIS dan ZIP |
| `npm run pack:msix` | Stage dan buat MSIX melalui Windows SDK |

`electron-builder` hanya membungkus folder `--prepackaged`, tanpa mengemas runtime Electron. `electronVersion` hanya memenuhi metadata tool packaging; package/runtime Electron tidak lagi menjadi dependensi npm. Staging menyalin executable/config, dependency managed, loader WebView2 x64, adapter desktop, dan UI. PDB, XML docs, WPF, loader x86/ARM64, dan runtime .NET tidak disertakan.

Smoke test memeriksa snapshot OS, command tidak valid, round-trip volume/mute yang sedang berlaku, timer start/pause/resume/finish/cancel, persistensi dan pemulihan setelah restart, layout, Escape, dan clean shutdown. Lokal juga memeriksa hit testing Windows asli serta transparansi lewat screenshot sebelum/sesudah overlay. Audio lokal harus tersedia; pada CI endpoint audio boleh unavailable. Semua pengujian memakai profil sementara.

Tetap verifikasi manual: pergantian perangkat audio, playback/seek pada pemutar lain, cabut/pasang charger, sleep/resume, monitor/DPI, klik di atas aplikasi elevated/exclusive fullscreen, dan izin notifikasi pada MSIX terpasang.

## Distribusi dan runtime

Installer sekitar 1,24 MB; ZIP sekitar 0,89 MB; folder aplikasi sekitar 3 MB. Ukuran ini tidak termasuk runtime WebView2 bersama, profil, dan cache. Installer memakai kompresi solid. Tidak ada auto-update aplikasi.

Auto startup aktif secara default melalui nilai `Dynamic Island` di `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, dengan path executable dalam tanda kutip. Installer mendaftarkannya setelah WebView2 tersedia; ZIP mendaftarkannya saat pertama dijalankan dan memperbarui path saat dibuka dari lokasi baru. Menu tray **Jalankan saat login Windows** menyimpan pilihan di `HKCU\Software\Andika\DynamicIsland\StartupEnabled`, sehingga pembaruan tidak mengaktifkan kembali pilihan yang dimatikan. Uninstaller menghapus entri startup hanya bila masih menunjuk salinan yang dihapus. Pengaturan Startup Windows tetap berlaku. `npm start`, `ISLAND_TEST=1`, dan profil kustom tidak mendaftarkan startup. ZIP harus disimpan di lokasi tetap; hapus entri melalui tray sebelum menghapus folder ZIP.

Installer menjalankan `--ensure-webview`. Jika runtime tersedia, tidak ada unduhan tambahan. Jika belum, host mengunduh bootstrapper resmi Microsoft melalui HTTPS, memverifikasi kepercayaan Authenticode dan publisher Microsoft, lalu menjalankan `/silent /install`. Kegagalan menghentikan pemasangan dengan petunjuk mencoba kembali. Jalur runtime-belum-terpasang masih memerlukan verifikasi pada Windows bersih; lokal memakai runtime yang sudah tersedia. ZIP memerlukan WebView2 terpasang. Installer aplikasi belum ditandatangani sehingga SmartScreen dapat muncul.

Profil `%APPDATA%/dynamic-island` kompatibel dengan versi sebelumnya; `ISLAND_PROFILE_DIR` memilih profil lain. Preferensi/timer disimpan melalui penggantian file atomik. Timer memakai deadline UTC, pulih setelah restart/sleep, dan memakai suara sistem ketika selesai. Baterai dibaca langsung melalui Win32 tanpa PowerShell. Media/audio dipoll setiap 500 ms tanpa tumpang tindih.

Window maksimum 460 × 320 DIP, 12 DIP dari sisi atas work area monitor utama. Area kosong dan sudut membulat meneruskan klik; host memeriksa cursor terhadap DOM karena WebView2 tidak meneruskan mousemove selama click-through. Tray menyediakan Tampilkan, Sembunyikan, Keluar; instance kedua menampilkan instance pertama.

Notifikasi memerlukan identitas MSIX dan izin Windows serta dinonaktifkan secara default. Ikon lonceng membuka panel status akses dan kontrol izin/aktivasi. EXE dan ZIP menampilkan penjelasan kebutuhan MSIX. Menutup tampilan tidak menghapus notifikasi Windows. Pengujian unpacked dan data simulasi tidak membuktikan izin MSIX.

## GitHub Release

Workflow berjalan pada push `main`/`master`, PR, tag `v*`, atau manual. CI menjalankan lint, unit test, build, packaging MSIX, dan smoke test pada executable staging. MSIX harus di bawah 5 MB. Artifact MSIX/checksum disimpan 14 hari; screenshot disimpan 7 hari. Build tanpa secret boleh menghasilkan MSIX unsigned untuk pemeriksaan, tetapi rilis bertag wajib ditandatangani.

Untuk rilis, ubah versi package/lockfile, commit, push, dan push tag `v` + versi package. Contoh versi berikutnya:

```sh
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release v0.2.4" -m "Co-authored-by: Codex <noreply@openai.com>"
git push origin main
git tag v0.2.4
git push origin v0.2.4
```

Setelah pemeriksaan lulus, tag push menerbitkan Release dengan MSIX, sertifikat publik DynamicIsland.cer, checksum SHA256, dan release notes. Push branch/manual hanya menghasilkan artifact. Ketika workflow mengunggah ulang tag yang sudah memiliki Release, aset installer/ZIP lama dihapus setelah MSIX berhasil diunggah. Release historis lain tidak diubah.

## MSIX dan signing

Manifest mendeklarasikan `runFullTrust`, `globalMediaControl`, dan `userNotificationListener`. Skrip MSIX memakai versi package saat ini dan mencari MakeAppx di Windows SDK atau `.tools/windows-sdk`; `MAKEAPPX_PATH` dapat menentukan lokasi lain. Output unsigned secara default.

Signing lokal memakai `MSIX_CERTIFICATE_PATH`, `MSIX_CERTIFICATE_PASSWORD`, dan `SIGNTOOL_PATH`. Subject sertifikat harus cocok dengan publisher; gunakan `-Publisher` untuk mengubahnya. `MSIX_TIMESTAMP_URL` mengaktifkan timestamp RFC 3161. Skrip tidak membuat sertifikat, mengubah trust store, atau memasang paket. Verifikasi signature menerima error untrusted root untuk sertifikat self-signed; kegagalan signature lain menghentikan packaging. Jangan commit sertifikat/kunci. Pengguna MSIX tetap membutuhkan WebView2 dan App Installer.

### Setup GitHub Actions

Di repository **Settings → Secrets and variables → Actions**, siapkan:

| Jenis | Nama | Nilai |
| --- | --- | --- |
| Secret | `MSIX_CERTIFICATE_BASE64` | Isi PFX (termasuk private key) dalam Base64 |
| Secret | `MSIX_CERTIFICATE_PASSWORD` | Password PFX |
| Variable | `MSIX_PUBLISHER` | Subject sertifikat; default `CN=Andika` |
| Variable | `MSIX_TIMESTAMP_URL` | Server timestamp; default `http://timestamp.digicert.com` |

Runner `windows-2025` menyediakan Windows SDK (MakeAppx/SignTool); workflow memasang Node.js 24 dan .NET 10. PFX hanya ditulis ke folder sementara runner dan dihapus setelah packaging. Jangan memasukkan secret ke PR dari sumber yang tidak dipercaya.

Untuk pengujian pribadi, buat sertifikat self-signed satu kali di PowerShell. Simpan PFX dan password yang sama untuk rilis berikutnya, serta backup di tempat aman:

```powershell
$signingDirectory = Join-Path $env:USERPROFILE 'DynamicIslandSigning'
New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
$certificate = New-SelfSignedCertificate -Type Custom -Subject 'CN=Andika' -FriendlyName 'Dynamic Island MSIX' -KeyUsage DigitalSignature -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(2) -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
$password = Read-Host 'Password PFX' -AsSecureString
$pfxPath = Join-Path $signingDirectory 'DynamicIsland.pfx'
Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $password | Out-Null
Export-Certificate -Cert $certificate -FilePath (Join-Path $signingDirectory 'DynamicIsland.cer') | Out-Null
[Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath)) | Set-Clipboard
# Paste clipboard ke secret MSIX_CERTIFICATE_BASE64, lalu kosongkan clipboard.
```

Sertifikat self-signed tidak otomatis dipercaya komputer pengguna. Workflow menyertakan file publik `DynamicIsland.cer` pada Release; private key tetap hanya di Actions secret dan backup lokal. Di komputer tujuan, jalankan PowerShell **sebagai Administrator** untuk mempercayai sertifikat penerbit, lalu pasang paket sebagai pengguna biasa:

```powershell
Import-Certificate -FilePath .\DynamicIsland.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople
# Jalankan perintah berikut di PowerShell biasa:
Add-AppxPackage -Path .\Dynamic-Island-0.2.5-x64.msix
```

Untuk distribusi publik tanpa impor sertifikat manual, gunakan sertifikat code signing yang dipercaya Windows atau layanan signing yang sesuai; publisher manifest harus mengikuti subject sertifikat tersebut. MSIX unsigned hasil build lokal tidak bisa langsung diinstal. Smoke test CI memeriksa host staging, belum membuktikan pemasangan MSIX, startup, atau izin notifikasi; periksa hal tersebut pada paket terpasang sebelum rilis publik.

Referensi: [distribusi WebView2](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution), [.NET Framework pada Windows](https://learn.microsoft.com/dotnet/framework/install/versions-and-dependencies), [GSMTC](https://learn.microsoft.com/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager), [Core Audio](https://learn.microsoft.com/windows/win32/api/endpointvolume/nn-endpointvolume-iaudioendpointvolume).
