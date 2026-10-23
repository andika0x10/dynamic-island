# Dynamic Island for Windows

Overlay baterai desktop berbasis Electron, React, TypeScript, Vite, dan Motion for React. Pill hitam berada di tengah atas monitor utama, dengan presentasi compact dan expanded yang terinspirasi Dynamic Island iPhone.

## Menjalankan

Gunakan Windows 10/11 dengan Node.js **22.18+ atau 24+** dan npm. Test TypeScript menggunakan type stripping bawaan Node. Windows PowerShell dan layanan CIM/WMI harus tersedia untuk membaca baterai.

```sh
npm install
npm run dev
```

Electron mengunduh binary pada penggunaan pertama; koneksi internet diperlukan. Jika download otomatis bermasalah, jalankan `npx install-electron --no`.

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Vite di `http://127.0.0.1:5173`, HMR React, restart Electron saat main/preload berubah |
| `npm run dev:web` | Preview browser; tidak mengklaim data baterai perangkat |
| `npm run typecheck` | Periksa tipe renderer, konfigurasi Vite, dan Electron |
| `npm run lint` | Pemeriksaan Oxlint |
| `npm test` | Test normalisasi, kegagalan query, dan query CIM nyata pada Windows |
| `npm run build` | Build renderer ke `dist` dan main/preload ke `dist-electron` |
| `npm start` | Jalankan build lokal; jalankan build terlebih dahulu |
| `npm run pack` | Build aplikasi Windows unpacked ke `release/win-unpacked` |
| `npm run test:smoke` | Uji build lokal menggunakan Playwright Electron |
| `npm run test:smoke -- --dev` | Uji renderer Vite dan preload Electron dalam mode development |
| `npm run test:smoke -- --packaged` | Uji executable unpacked setelah `npm run pack` |

Executable: `release/win-unpacked/Dynamic Island.exe`. Ini distribusi unpacked tanpa installer atau code signing. Tidak ada auto-start atau auto-update. Screenshot smoke test tersimpan di `test-results`.

## Interaksi

- Klik pill untuk membuka detail, klik lagi atau tekan Escape saat window memiliki fokus untuk menutup.
- Perubahan sumber daya membuka detail selama empat detik; detail yang dibuka manual tetap terbuka.
- Tray menyediakan Tampilkan, Sembunyikan, dan Keluar. Klik dua kali tray untuk menampilkan overlay. Membuka aplikasi kedua menampilkan instance yang sudah berjalan.
- Area di luar pill, termasuk sudut transparannya, meneruskan klik ke window di bawah. Overlay tampil tanpa mengambil fokus saat startup.
- Canvas berukuran 420 × 220 DIP; pill compact 180 × 40, expanded 360 × 150. Posisi berada 12 DIP di bawah work area monitor utama. Canvas dan pill dibatasi pada work area kecil; perubahan resolusi/DPI/display menghitung ulang posisi.
- Reduced motion mengikuti preferensi sistem; perubahan ukuran langsung dan transisi opacity singkat tetap tersedia.

## Arsitektur dan data

`electron/main.ts` menangani window, tray, single instance, display, dan power events. `electron/battery.ts` menjalankan query PowerShell `Get-CimInstance Win32_Battery` dengan `windowsHide`, timeout lima detik, dan output JSON. Pembacaan dilakukan saat startup, setiap 30 detik, saat AC/baterai berubah, dan setelah resume. Query tidak bertumpuk; event saat query berlangsung menjadwalkan satu pembacaan berikutnya.

`electron/preload.ts` dibundle menjadi CommonJS mandiri untuk sandbox. Main process dibundle menjadi ESM. React tetap menggunakan konfigurasi Vite dan React Compiler yang ada. Alur dev mengelola Vite dan proses Electron; penghentian normal/Ctrl+C menghentikan turunan Electron juga. Port 5173 menggunakan strictPort sehingga konflik port gagal dengan jelas.

API `window.desktop` bertipe di `shared/desktop.ts`:

- `getBattery(): Promise<BatterySnapshot>` — snapshot terbaru.
- `onBattery(callback): () => void` — langganan dan fungsi unsubscribe.
- `setClickThrough(boolean): void` — hit-testing area overlay.

Snapshot memuat `availability` (`available`, `absent`, `unavailable`), `percentage` (angka 0–100 atau null), `source` (`ac`, `battery`, `unknown`), dan `charging` (`charging`, `full`, `discharging`, `unknown`). Beberapa baterai menggunakan rata-rata persentase valid, bukan rata-rata berbobot kapasitas. Tidak ada baterai berbeda dari kegagalan query. Data gagal tidak ditampilkan sebagai persentase lama; aplikasi mencoba lagi sesuai jadwal.

Tersambung AC **tidak berarti sedang charging**. Status WMI 2 hanya memastikan akses ke AC; status charging tetap tidak diketahui. Status 6–9 berarti charging, status 3 penuh, dan `powerMonitor` menentukan sumber AC/baterai. Informasi bergantung pada laporan firmware/WMI dan dapat terlambat. Preview browser menampilkan “Integrasi Windows tersedia di Electron”, tanpa mock persentase.

Renderer berjalan dengan sandbox, context isolation, tanpa Node integration. IPC memeriksa pengirim main frame dan payload boolean. Renderer tidak mendapat akses shell atau IPC generik. Navigasi, window baru, dan permission request diblokir. Produksi memuat aset lokal dengan base relatif dan CSP.

## Validasi

Test baterai mencakup charging vs AC, penuh, discharging, status/level tidak diketahui, beberapa baterai, tanpa baterai, output rusak, serta error/timeout melalui injected runner. Smoke test memeriksa preload, snapshot nyata, konfigurasi keamanan/window, transparansi CSS dan hit-test sudut, expand/Escape, reduced motion, event display/resume, serta penolakan popup.

Untuk pengujian perangkat langsung: cabut/pasang charger; pastikan detail otomatis menutup setelah empat detik dan detail manual bertahan. Klik aplikasi di belakang area transparan, coba tray, buka executable kedua, suspend/resume, serta ubah monitor utama dan DPI. Event sintetis smoke test tidak menggantikan pengujian fisik ini. Click-through forwarding Electron memiliki keterbatasan di atas aplikasi yang berjalan sebagai Administrator; exclusive fullscreen dan secure desktop tidak dijamin.

## Referensi desain dan teknis

- [Apple Live Activities HIG](https://developer.apple.com/design/human-interface-guidelines/live-activities): compact, minimal, expanded, informasi singkat, margin membulat konsentris, dan kontinuitas transisi. Tahap ini mengimplementasikan compact/expanded untuk satu aktivitas baterai; minimal dua aktivitas ditunda.
- [Motion layout animations](https://motion.dev/docs/react-layout-animations): dipilih karena integrasi state React, spring, dan transisi konten; GSAP tidak diperlukan pada tahap ini.
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) dan [custom window styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles): transparansi, always-on-top, dan click-through.
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security): isolasi renderer dan pembatasan IPC.
- [Microsoft Win32_Battery](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-battery): persentase dan arti status baterai.

Integrasi media, volume, dan notifikasi Windows belum termasuk. UI menggunakan font sistem Windows, tanpa aset atau font proprietary Apple.
