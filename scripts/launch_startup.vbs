Set WshShell = CreateObject("WScript.Shell")

' 1. Start the server hidden in the background (0 = hidden window, non-blocking)
WshShell.Run "cmd /c ""cd /d D:\update3\cf-pump-screener && node --experimental-strip-types src/server.ts""", 0, False

' 2. Wait 2 seconds for server initialization
WScript.Sleep 2000

' 3. Automatically launch the Bloomberg Dashboard at http://localhost:8787/
WshShell.Run "cmd /c start http://localhost:8787/", 0, False
