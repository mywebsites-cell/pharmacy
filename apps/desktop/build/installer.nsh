!macro customInstall
  ; Copy bundled ffmpeg.dll from resources to installation root so Electron can load it
  SetOutPath "$INSTDIR"
  ; If the resources path contains ffmpeg.dll, copy it next to the exe
  StrCmp $INSTDIR "" 0 +2
  CopyFiles "$INSTDIR\\resources\\ffmpeg.dll" "$INSTDIR\\ffmpeg.dll"
  ; Also try libffmpeg.dll just in case a differently-named build was bundled
  CopyFiles "$INSTDIR\\resources\\libffmpeg.dll" "$INSTDIR\\libffmpeg.dll"
!macroend

!macro customUnInstall
  ; Remove copied ffmpeg files on uninstall
  Delete "$INSTDIR\\ffmpeg.dll"
  Delete "$INSTDIR\\libffmpeg.dll"
!macroend
