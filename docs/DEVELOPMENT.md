# Dynamic Island for Windows

Overlay desktop berbasis Electron, React, TypeScript, Motion, dan helper native C#. Menghadirkan pill compact, dua aktivitas dalam pill + bubble, kontrol expanded, dan perubahan bentuk spring yang terinspirasi Dynamic Island iPhone. UI berbahasa Indonesia; ini aplikasi Windows dengan integrasi OS Windows.

## Menjalankan

Prasyarat: Windows 10 **2004/19041+** atau Windows 11 x64, Node.js **22.18+ atau 24+**, npm, dan **.NET 10 SDK**. Windows PowerShell/CIM dipakai untuk membaca baterai. Runtime .NET sudah disertakan dalam hasil publish sehingga pengguna executable tidak perlu memasang SDK/runtime.

```sh
npm install
npm run build:native
npm run dev
```

Build native mencari SDK pada `.tools/dotnet/dotnet.exe`, lalu `dotnet` di PATH. Gunakan `DOTNET_EXECUTABLE` untuk lokasi lain. `npm run dev` mengelola Vite/HMR dan restart Electron; setelah mengubah C#, jalankan ulang build native dan Electron. Tray menyediakan Tampilkan, Sembunyikan, dan Keluar. Timer tersedia melalui tab Timer di dalam Dynamic Island.

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Overlay Electron, Vite strict port 5173 |
| `npm run dev:web` | Preview browser tanpa data Windows |
| `npm run typecheck` | Pemeriksaan tipe renderer/main/preload |
| `npm run lint` | Oxlint |
| `npm test` | Baterai, timer, pemilihan aktivitas, validasi IPC/protokol |
| `npm run build:native` | Publish helper Windows self-contained x64 |
| `npm run build` | Typecheck, build renderer/Electron, publish helper |
| `npm start` | Jalankan hasil build lokal |
| `npm run test:native` | Uji helper terhadap audio/media Windows asli |
| `npm run test:native -- --protocol-only` | Uji protokol, antrean perintah, dan shutdown tanpa memerlukan perangkat audio |
| `npm run test:smoke` | Smoke UI dengan helper dinonaktifkan dan fixture aktivitas |
| `npm run test:smoke -- --dev` | Smoke UI lewat Vite |
| `npm run test:smoke -- --native` | Smoke Electron dengan integrasi Windows asli |
| `npm run pack` | Distribusi unpacked ke `release/win-unpacked` |
| `npm run test:smoke -- --packaged` | Uji executable unpacked dan helper yang dibundel |
| `npm run pack:msix` | Build unpacked kemudian validasi dan pembuatan MSIX |

Jalankan `release/win-unpacked/Dynamic Island.exe` bersama seluruh isi foldernya. Tidak ada autostart atau auto-update. Preview browser tidak mengarang persentase baterai atau lagu. Fixture media/notifikasi hanya dipakai untuk pengujian.

## Distribusi melalui GitHub Actions

Workflow **Windows build and release** berjalan pada push ke `master`/`main`, pull request, tag `v*`, atau melalui **Actions → Run workflow**. Runner Windows memakai Node.js 24 dan .NET 10, menjalankan lint, unit test, build, dan smoke UI Electron. Installer x64 `.exe` dan `SHA256SUMS.txt` tersedia pada artifact **dynamic-island-windows-x64-installer**; ZIP tersedia terpisah pada **dynamic-island-windows-x64-portable**. Artifact disimpan selama 14 hari. Pilih salah satu format distribusi, tidak perlu mengunduh keduanya. Screenshot UI disimpan terpisah selama 7 hari.

Paket menyertakan Electron dan runtime .NET agar dapat berjalan tanpa instalasi runtime tambahan. Locale Electron dibatasi ke Indonesia dan Inggris. Dependensi JavaScript sudah dibundel oleh Vite/esbuild, sehingga `node_modules` tidak disalin lagi ke `app.asar`. Ukuran unduhan installer berbeda dari ukuran folder aplikasi setelah dipasang.

Helper native memakai message loop STA Win32 tanpa Windows Forms dan dipublikasikan dengan trimming. Metadata JSON dihasilkan saat kompilasi; deklarasi COM audio dipertahankan utuh agar urutan vtable tidak berubah. Build membersihkan direktori publish terlebih dahulu agar library dari build lama tidak ikut dikemas. Trimmer masih melaporkan peringatan pada fallback generik WinRT dan aktivasi COM bawaan; smoke native memeriksa audio/media pada helper hasil trimming. Izin notifikasi MSIX tetap memerlukan verifikasi manual pada paket terpasang.

Installer menggunakan kompresi solid (`nsis.differentialPackage: false`) karena aplikasi belum menyediakan auto-update. CI menolak installer berukuran 100.000.000 byte atau lebih. ZIP memakai format kompresi berbeda dan dapat berukuran lebih besar daripada installer; batas 100 MB berlaku untuk installer, bukan ZIP atau folder terpasang.

Untuk rilis publik, ubah versi `package.json` dan lockfile melalui `npm version patch --no-git-tag-version` (atau `minor`/`major`), commit perubahan versi, lalu push commit dan tag yang sesuai:

```sh
git push origin main
git tag v0.1.1
git push origin v0.1.1
```

Tag harus sama dengan `v` + versi `package.json`. Setelah seluruh pemeriksaan lulus, workflow menerbitkan GitHub Release berisi installer, ZIP, checksum, dan release notes otomatis. Tag dengan suffix seperti `v0.2.0-beta.1` diterbitkan sebagai prerelease. Publikasi menggunakan `GITHUB_TOKEN` bawaan; tidak memerlukan personal access token. Push biasa dan run manual hanya menghasilkan artifact.

Pengguna dapat memasang installer atau mengekstrak seluruh ZIP lalu menjalankan `Dynamic Island.exe`. Distribusi ini belum ditandatangani dan Windows dapat menampilkan SmartScreen. Installer/ZIP tidak menyediakan identitas MSIX untuk izin notifikasi. MSIX tetap dibuat melalui alur terpisah di bawah. Build distribusi lokal: `npm run dist:win`. CI tidak menjalankan pengujian audio/media perangkat asli; pengujian tersebut tetap dilakukan pada Windows lokal.

## Aktivitas dan interaksi

- **Baterai:** pembacaan CIM saat startup, setiap 30 detik, perubahan AC/baterai, dan resume. Detail charger muncul empat detik. AC tidak selalu berarti charging; firmware dapat melaporkan status tidak diketahui. Tanpa baterai dibedakan dari gagal baca.
- **Musik:** metadata, artwork lokal, timeline, previous/play/pause/next, dan seek dari sesi media aktif Windows (GSMTC). Aplikasi pemutar harus mengekspos sesi media; kontrol hanya aktif jika didukung sesi tersebut. Waveform merupakan animasi status pemutaran, bukan pengukuran audio.
- **Volume:** volume master dan mute output default multimedia Windows melalui Core Audio. Perubahan dari keyboard/aplikasi lain memunculkan indikator tiga detik. Output audio dicari ulang setiap pembacaan agar perpindahan perangkat tertangani. Slider mengirim nilai saat dilepas atau sesudah input keyboard.
- **Timer:** buat dari tab Timer di dalam island; jeda, lanjutkan, batalkan, dan konfirmasi selesai melalui expanded. Deadline ditangani main process, dipersistenkan, serta dihitung ulang setelah sleep/restart. Bunyi selesai menggunakan suara sistem Windows, mengikuti pengaturan suara OS. Tidak membangunkan komputer yang tidur.
- **Notifikasi:** memerlukan MSIX terpasang dan izin Windows. UI settings telah dihapus; notifikasi nonaktif secara default dan belum memiliki kontrol izin di UI saat ini. Pembacaan pertama menjadi baseline; riwayat lama tidak diputar ulang. Notifikasi terbaru tampil enam detik. Menutup tampilan tidak menghapus notifikasi asli Windows. Isi tidak ditulis ke log atau penyimpanan aplikasi.

Klik pill/bubble untuk membuka aktivitas; klik header atau Escape saat window fokus untuk menutup. Kontrol di dalam panel tidak menutupnya. Pilih aktivitas lain melalui tombol di bagian bawah. Detail yang dibuka manual dipertahankan ketika ada event baru. Ketika tertutup, timer selesai mendapat prioritas, lalu notifikasi, volume, dan charger; sesudahnya kembali ke media/timer aktif dengan baterai sebagai fallback. Maksimal dua aktivitas terlihat sekaligus.

Canvas maksimum 460 × 320 DIP, 12 DIP di bawah work area monitor utama. Compact 190 × 40; expanded lebar 400 dengan tinggi yang diukur dari isi panel, termasuk pesan error, serta ruang terpisah untuk navigasi bawah. Window dibatasi work area dan diposisikan ulang saat display/DPI berubah. Area transparan dan sudut membulat meneruskan klik. Reduced motion mengikuti perubahan preferensi sistem. Click-through di atas aplikasi elevated dan exclusive fullscreen tetap bergantung perilaku Electron/Windows.

## Struktur modular

| Modul | Tanggung jawab |
| --- | --- |
| `src/App.tsx` | Komposisi overlay |
| `src/island` | Shell, prioritas aktivitas, animasi, hit-testing |
| `src/features` | UI baterai, media, volume, timer, notifikasi |
| `src/platform` | Adapter desktop/browser dan subscription snapshot |
| `src/shared` | UI dasar, hook umum, formatting, token global |
| `shared/contracts` | Snapshot, capability, command, dan validasi |
| `electron/main.ts` | Bootstrap dan lifecycle window |
| `electron/ipc` / `electron/overlay` | IPC, keamanan, penempatan, tray |
| `electron/services` | Baterai, state timer, orkestrasi aktivitas, native client |
| `electron/settings` | Preferensi dan timer persisten dengan atomic file replacement |
| `native/WindowsBridge` | Layanan C# terpisah untuk Media, Audio, Notifications, Protocol |

Fitur renderer tidak mengakses Node/OS atau internal fitur lain. Shell menyusun fitur melalui kontrak bersama. CSS Modules mengisolasi style, sedangkan warna dan tipografi dasar berada pada global tokens. Renderer memakai context isolation, sandbox, dan tanpa Node integration. Navigasi, popup, dan permission browser ditolak.

API `window.desktop` mempertahankan `getBattery`, `onBattery`, dan `setClickThrough`; menambahkan `getActivity`, `onActivity`, serta `command`. Subscription mengembalikan unsubscribe. Command dibatasi pada media/seek, volume/mute, timer, preferensi, izin/tutup notifikasi. Main process memvalidasi pengirim main frame serta payload. Tidak tersedia shell atau IPC generik untuk renderer.

Helper berkomunikasi melalui JSON per baris di stdin/stdout tanpa port jaringan. Polling native berjalan setiap 500 ms tanpa pembacaan bertumpuk. Command memiliki ID dan timeout; kegagalan proses membatalkan command, mengosongkan data native, dan mencoba restart maksimal tiga kali. Watchdog menghentikan helper yang tidak merespons selama 20 detik. Baterai dan timer tetap berjalan saat helper tidak tersedia.

Preferensi dan timer disimpan di `app.getPath('userData')/settings.json`. `ISLAND_PROFILE_DIR` dapat menentukan profil terpisah; smoke test otomatis memakai folder sementara agar tidak mengubah timer atau preferensi profil pengguna. `ISLAND_DISABLE_NATIVE=1` hanya berlaku pada build non-packaged dan digunakan smoke UI.

## MSIX dan signing

Packaging memerlukan Windows SDK Build Tools (`MakeAppx.exe`; `SignTool.exe` untuk signing). Skrip mencari tool x64 di Windows Kits atau `.tools/windows-sdk`. Alternatifnya atur `MAKEAPPX_PATH` dan `SIGNTOOL_PATH`.

`packaging/AppxManifest.xml` mendeklarasikan identitas `Andika.DynamicIsland`, publisher `CN=Andika`, serta capability `runFullTrust`, `globalMediaControl`, dan `userNotificationListener`. Skrip memvalidasi manifest melalui MakeAppx dan menghasilkan `release/Dynamic-Island-0.1.0-x64.msix`. Staging memakai folder unik di `release`; log MakeAppx berada di samping folder staging.

Tanpa sertifikat, hasilnya **unsigned** dan belum dapat dipasang secara normal. Untuk signing, sediakan `MSIX_CERTIFICATE_PATH` dan, jika diperlukan, `MSIX_CERTIFICATE_PASSWORD` melalui environment lokal. Subject sertifikat harus sama dengan publisher manifest. Untuk publisher lain:

```powershell
# Setelah npm run pack
./scripts/package-msix.ps1 -Publisher 'CN=Publisher Anda'
```

Skrip memakai sertifikat yang disediakan, tidak membuat sertifikat, mengubah trust store, atau memasang paket. Jangan commit kunci/sertifikat. Pemasangan paket dan pemberian izin notifikasi dilakukan pengguna. Build unpacked menampilkan status “Instal versi MSIX” untuk notifikasi.

## Validasi dan batas verifikasi

Unit test mencakup normalisasi baterai, timer pause/resume/restart/sleep, data persisten rusak, prioritas/manual pin, expiry, command tidak valid, helper hilang, dan snapshot native rusak. Smoke UI mengambil screenshot compact, expanded, dua aktivitas, musik, dan timer; memeriksa Escape, reduced motion, transparansi, hit-test sudut, IPC, dan single instance. Regresi layout memeriksa overflow, kontrol terpotong, dan jarak konten ke navigasi; mencakup baterai 100%, nama perangkat panjang, pesan error, serta window lebar 460/360 DIP. Screenshot disimpan di `test-results`.

Native smoke menggunakan nilai volume/mute yang sedang berlaku sehingga tidak sengaja mengubah preferensi audio. Smoke desktop memakai profil terpisah dan menonaktifkan bunyi pengujian timer. Pembacaan media dapat unavailable jika tidak ada sesi pemutar; pembacaan audio memerlukan perangkat output.

Tetap verifikasi secara manual: cabut/pasang charger, playback/seek pada pemutar yang dipakai, pergantian perangkat audio, klik aplikasi di belakang overlay, sleep/resume, monitor/DPI, serta alur izin dan notifikasi baru setelah MSIX ditandatangani dan dipasang. Validasi MakeAppx dan pengujian unpacked tidak membuktikan izin notifikasi pada paket terpasang. Tidak ada simulasi Face ID, AirDrop, panggilan, atau navigasi iPhone.

Referensi: [Apple Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities), [GSMTC](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager), [Core Audio](https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nn-endpointvolume-iaudioendpointvolume), [Notification Listener](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener), dan [MakeAppx](https://learn.microsoft.com/en-us/windows/msix/package/create-app-package-with-makeappx-tool).
