!macro customInstall
  DetailPrint "Checking Microsoft Edge WebView2 Runtime..."
  ExecWait '"$INSTDIR\Dynamic Island.exe" --ensure-webview' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Microsoft Edge WebView2 Runtime belum tersedia. Periksa koneksi internet, lalu jalankan installer kembali."
    Abort
  ${EndIf}
  DetailPrint "Registering login startup..."
  ExecWait '"$INSTDIR\Dynamic Island.exe" --register-startup' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Startup otomatis belum dapat diaktifkan. Coba aktifkan melalui menu tray setelah aplikasi dibuka."
  ${EndIf}
!macroend

!macro customUnInstall
  ExecWait '"$INSTDIR\Dynamic Island.exe" --unregister-startup' $0
!macroend
