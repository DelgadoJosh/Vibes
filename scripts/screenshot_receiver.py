"""Save game screenshots posted from the browser into Images/.

Godot web builds draw to a <canvas>, and the browser pane's own screenshots
come back as downscaled JPGs. This tiny server lets a page POST its canvas
as a PNG data URL so the file lands here at full resolution.

    python3 -I scripts/screenshot_receiver.py [OUT_DIR]   # default: Images/

Run it in the background, then paste SNIPPET (printed on start) into the
game's page with the browser's JavaScript tool and call
`await __save('<Game> Title')` / `await __save('<Game> In Game 1')`.
Each call writes `<name> Screenshot YYYY-MM-DD HHMMSS.png`. Stop the server
when done. It only listens on 127.0.0.1:8799, and only accepts pages served from
localhost or 127.0.0.1 (any port), so another website open meanwhile can't drop
files into Images/ (security audit 2026-11-25).
"""
import base64
import http.server
import os
import re
import sys
import urllib.parse

PORT = 8799
LOCAL_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$")
MAX_BYTES = 64 * 1024 * 1024
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else
                      os.path.join(os.path.dirname(__file__), "..", "Images"))

SNIPPET = """window.__save = async (name) => { const d=new Date(), p=n=>String(n).padStart(2,'0'); const ts=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; const f=`${name} Screenshot ${ts}.png`; const r=await fetch('http://127.0.0.1:%d/'+encodeURIComponent(f),{method:'POST',body:document.querySelector('canvas').toDataURL('image/png')}); return f+' '+await r.text(); };
window.__hold = (key, ms) => new Promise(r => { const code = key.length===1 ? 'Key'+key.toUpperCase() : key; const o={key, code, bubbles:true}; const c=document.querySelector('canvas'); for (const t of [c, window]) t.dispatchEvent(new KeyboardEvent('keydown',o)); setTimeout(()=>{ for (const t of [c, window]) t.dispatchEvent(new KeyboardEvent('keyup',o)); r('done'); }, ms); });""" % PORT


class Handler(http.server.BaseHTTPRequestHandler):
    def _local(self):
        # Browsers always send Origin on a cross-origin POST; a local tool may send none.
        origin = self.headers.get("Origin")
        return origin is None or bool(LOCAL_ORIGIN.match(origin))

    def _cors(self):
        origin = self.headers.get("Origin")
        if origin and LOCAL_ORIGIN.match(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _refuse(self, code):
        self.send_response(code)
        self._cors()
        self.end_headers()

    def do_OPTIONS(self):
        if not self._local():
            return self._refuse(403)
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if not self._local():
            return self._refuse(403)
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            return self._refuse(413)
        name = os.path.basename(urllib.parse.unquote(self.path.lstrip("/")))
        if not name.endswith(".png"):
            return self._refuse(400)
        data = self.rfile.read(length).decode()
        path = os.path.join(OUT, name)
        with open(path, "wb") as f:
            f.write(base64.b64decode(data.split(",", 1)[1]))
        print("saved", path, flush=True)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print(f"Saving to {OUT} on http://127.0.0.1:{PORT}\nPaste into the game page:\n{SNIPPET}", flush=True)
    http.server.HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
