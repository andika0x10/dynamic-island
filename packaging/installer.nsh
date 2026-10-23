!macro customInstall
  DetailPrint "Checking Microsoft Edge WebView2 Runtime..."
  ExecWait '"$INSTDIR\Dynamic Island.exe" --ensure-webview' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Microsoft Edge WebView2 Runtime belum tersedia. Periksa koneksi internet, lalu jalankan installer kembali."
    Abort
  ${EndIf}
!macroend
