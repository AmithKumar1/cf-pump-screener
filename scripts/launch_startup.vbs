Set WshShell = CreateObject("WScript.Shell")

' 1. Set working directory to the project root
WshShell.CurrentDirectory = "D:\update3\cf-pump-screener"

' 2. Launch node server directly and silently in the background (0 = hidden, False = non-blocking)
WshShell.Run """C:\Program Files\nodejs\node.exe"" --experimental-strip-types src/server.ts", 0, False

' 3. Wait 2 seconds for server initialization
WScript.Sleep 2000

' 4. Open dashboard in default browser
WshShell.Run "cmd /c start http://localhost:8787/", 0, False
