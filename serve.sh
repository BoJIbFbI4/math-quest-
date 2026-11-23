#!/bin/sh
# Serves the game on the home network so the iPad can open it. Stop with Ctrl+C.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8080}"
HOST="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
echo "Mac:  http://localhost:$PORT"
echo "iPad: http://$HOST.local:$PORT   (same Wi-Fi; Safari → Share → Add to Home Screen)"
# no-cache: after an update the iPad must not mix new and old files from its cache.
exec python3 -c '
import sys, http.server
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
http.server.ThreadingHTTPServer(("0.0.0.0", int(sys.argv[1])), Handler).serve_forever()
' "$PORT"
