# Dynamic Island for Windows

Overlay desktop berbasis Electron, React, TypeScript, Motion, dan helper native C#. Menghadirkan pill compact, dua aktivitas dalam pill + bubble, kontrol expanded, dan perubahan bentuk spring yang terinspirasi Dynamic Island iPhone. UI berbahasa Indonesia; ini aplikasi Windows dengan integrasi OS Windows.

## Menjalankan

Prasyarat: Windows 10 **2004/19041+** atau Windows 11 x64, Node.js **22.18+ atau 24+**, npm, dan **.NET 10 SDK**. Windows PowerShell/CIM dipakai untuk membaca baterai. Runtime .NET sudah disertakan dalam hasil publish sehingga pengguna executable tidak perlu memasang SDK/runtime.

```sh
npm install
npm run build:native
npm run dev
```

Build native mencari SDK pada `.tools/dotnet/dotnet.exe`, lalu `dotnet` di PATH. Gunakan `DOTNET_EXECUTABLE` untuk lokasi lain. `npm run dev` mengelola Vite/HMR dan restart Electron; setelah mengubah C#, jalankan ulang build native dan Electron. Tray menyediakan Tampilkan, Sembunyikan, Pengaturan & timer, dan Keluar.

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Overlay Electron, Vite strict port 5173 |
| `npm run dev:web` | Preview browser tanpa data Windows; `/#settings` untuk pengaturan |
| `npm run typecheck` | Pemeriksaan tipe renderer/main/preload |
| `npm run lint` | Oxlint |
| `npm test` | Baterai, timer, pemilihan aktivitas, validasi IPC/protokol |
| `npm run build:native` | Publish helper Windows self-contained x64 |
| `npm run build` | Typecheck, build renderer/Electron, publish helper |
| `npm start` | Jalankan hasil build lokal |
| `npm run test:native` | Uji helper terhadap audio/media Windows asli |
| `npm run test:smoke` | Smoke UI dengan helper dinonaktifkan dan fixture aktivitas |
| `npm run test:smoke -- --dev` | Smoke UI lewat Vite |
| `npm run test:smoke -- --native` | Smoke Electron dengan integrasi Windows asli |
| `npm run pack` | Distribusi unpacked ke `release/win-unpacked` |
| `npm run test:smoke -- --packaged` | Uji executable unpacked dan helper yang dibundel |
| `npm run pack:msix` | Build unpacked kemudian validasi dan pembuatan MSIX |

Jalankan `release/win-unpacked/Dynamic Island.exe` bersama seluruh isi foldernya. Tidak ada autostart atau auto-update. Preview browser tidak mengarang persentase baterai atau lagu. Fixture media/notifikasi hanya dipakai untuk pengujian.

## Aktivitas dan interaksi

- **Baterai:** pembacaan CIM saat startup, setiap 30 detik, perubahan AC/baterai, dan resume. Detail charger muncul empat detik. AC tidak selalu berarti charging; firmware dapat melaporkan status tidak diketahui. Tanpa baterai dibedakan dari gagal baca.
- **Musik:** metadata, artwork lokal, timeline, previous/play/pause/next, dan seek dari sesi media aktif Windows (GSMTC). Aplikasi pemutar harus mengekspos sesi media; kontrol hanya aktif jika didukung sesi tersebut. Waveform merupakan animasi status pemutaran, bukan pengukuran audio.
- **Volume:** volume master dan mute output default multimedia Windows melalui Core Audio. Perubahan dari keyboard/aplikasi lain memunculkan indikator tiga detik. Output audio dicari ulang setiap pembacaan agar perpindahan perangkat tertangani. Slider mengirim nilai saat dilepas atau sesudah input keyboard.
- **Timer:** buat dari pengaturan; jeda, lanjutkan, batalkan, dan konfirmasi selesai melalui expanded. Deadline ditangani main process, dipersistenkan, serta dihitung ulang setelah sleep/restart. Bunyi selesai menggunakan suara sistem Windows, mengikuti pengaturan suara OS. Tidak membangunkan komputer yang tidur.
- **Notifikasi:** memerlukan MSIX terpasang dan izin Windows yang diberikan melalui tombol di pengaturan. Fitur dapat dimatikan secara terpisah. Pembacaan pertama menjadi baseline; riwayat lama tidak diputar ulang. Notifikasi terbaru tampil enam detik. Menutup tampilan tidak menghapus notifikasi asli Windows. Isi tidak ditulis ke log atau penyimpanan aplikasi.

Klik pill/bubble untuk membuka aktivitas; klik header atau Escape saat window fokus untuk menutup. Kontrol di dalam panel tidak menutupnya. Pilih aktivitas lain melalui tombol di bagian bawah. Detail yang dibuka manual dipertahankan ketika ada event baru. Ketika tertutup, timer selesai mendapat prioritas, lalu notifikasi, volume, dan charger; sesudahnya kembali ke media/timer aktif dengan baterai sebagai fallback. Maksimal dua aktivitas terlihat sekaligus.

Canvas maksimum 460 × 320 DIP, 12 DIP di bawah work area monitor utama. Compact 190 × 40; expanded lebar 400 dengan tinggi 200–270 sesuai konten. Window dibatasi work area dan diposisikan ulang saat display/DPI berubah. Area transparan dan sudut membulat meneruskan klik. Reduced motion mengikuti perubahan preferensi sistem. Click-through di atas aplikasi elevated dan exclusive fullscreen tetap bergantung perilaku Electron/Windows.

## Struktur modular

| Modul | Tanggung jawab |
| --- | --- |
| `src/App.tsx` | Komposisi overlay/pengaturan saja |
| `src/island` | Shell, prioritas aktivitas, animasi, hit-testing |
| `src/features` | UI baterai, media, volume, timer, notifikasi, pengaturan |
| `src/platform` | Adapter desktop/browser dan subscription snapshot |
| `src/shared` | UI dasar, hook umum, formatting, token global |
| `shared/contracts` | Snapshot, capability, command, dan validasi |
| `electron/main.ts` | Bootstrap dan lifecycle window |
| `electron/ipc` / `electron/overlay` | IPC, keamanan, penempatan, tray |
| `electron/services` | Baterai, state timer, orkestrasi aktivitas, native client |
| `electron/settings` | Preferensi dan timer persisten dengan atomic file replacement |
| `native/WindowsBridge` | Layanan C# terpisah untuk Media, Audio, Notifications, Protocol |

Fitur renderer tidak mengakses Node/OS atau internal fitur lain. Shell menyusun fitur melalui kontrak bersama. CSS Modules mengisolasi style, sedangkan warna dan tipografi dasar berada pada global tokens. Renderer memakai context isolation, sandbox, dan tanpa Node integration. Navigasi, popup, dan permission browser ditolak.

API `window.desktop` mempertahankan `getBattery`, `onBattery`, dan `setClickThrough`; menambahkan `getActivity`, `onActivity`, serta `command`. Subscription mengembalikan unsubscribe. Command dibatasi pada media/seek, volume/mute, timer, preferensi, izin/tutup notifikasi, dan pengaturan. Main process memvalidasi pengirim main frame serta payload. Tidak tersedia shell atau IPC generik untuk renderer.

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

Unit test mencakup normalisasi baterai, timer pause/resume/restart/sleep, data persisten rusak, prioritas/manual pin, expiry, command tidak valid, helper hilang, dan snapshot native rusak. Smoke UI mengambil screenshot compact, expanded, dua aktivitas, musik, timer, dan pengaturan; memeriksa Escape, reduced motion, transparansi, hit-test sudut, IPC, dan single instance. Screenshot disimpan di `test-results`.

Native smoke menggunakan nilai volume/mute yang sedang berlaku sehingga tidak sengaja mengubah preferensi audio. Smoke desktop memakai profil terpisah dan menonaktifkan bunyi pengujian timer. Pembacaan media dapat unavailable jika tidak ada sesi pemutar; pembacaan audio memerlukan perangkat output.

Tetap verifikasi secara manual: cabut/pasang charger, playback/seek pada pemutar yang dipakai, pergantian perangkat audio, klik aplikasi di belakang overlay, sleep/resume, monitor/DPI, serta alur izin dan notifikasi baru setelah MSIX ditandatangani dan dipasang. Validasi MakeAppx dan pengujian unpacked tidak membuktikan izin notifikasi pada paket terpasang. Tidak ada simulasi Face ID, AirDrop, panggilan, atau navigasi iPhone.

Referensi: [Apple Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities), [GSMTC](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager), [Core Audio](https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nn-endpointvolume-iaudioendpointvolume), [Notification Listener](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener), dan [MakeAppx](https://learn.microsoft.com/en-us/windows/msix/package/create-app-package-with-makeappx-tool).
