"""Save game screenshots posted from the browser into Images/.

Godot web builds draw to a <canvas>, and the browser pane's own screenshots
come back as downscaled JPGs. This tiny server lets a page POST its canvas
as a PNG data URL so the file lands here at full resolution.

    python3 -I scripts/screenshot_receiver.py [OUT_DIR]   # default: Images/

Run it in the background, then paste SNIPPET (printed on start) into the
game's page with the browser's JavaScript tool and call
`await __save('<Game> Title')` / `await __save('<Game> In Game 1')`.
Each call writes `<name> Screenshot YYYY-MM-DD HHMMSS.png`. Stop the server
when done. It only listens on 127.0.0.1:8799.
"""
import base64
import http.server
import os
import sys
import urllib.parse

PORT = 8799
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else
                      os.path.join(os.path.dirname(__file__), "..", "Images"))

SNIPPET = """window.__save = async (name) => { const d=new Date(), p=n=>String(n).padStart(2,'0'); const ts=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; const f=`${name} Screenshot ${ts}.png`; const r=await fetch('http://127.0.0.1:%d/'+encodeURIComponent(f),{method:'POST',body:document.querySelector('canvas').toDataURL('image/png')}); return f+' '+await r.text(); };
window.__hold = (key, ms) => new Promise(r => { const code = key.length===1 ? 'Key'+key.toUpperCase() : key; const o={key, code, bubbles:true}; const c=document.querySelector('canvas'); for (const t of [c, window]) t.dispatchEvent(new KeyboardEvent('keydown',o)); setTimeout(()=>{ for (const t of [c, window]) t.dispatchEvent(new KeyboardEvent('keyup',o)); r('done'); }, ms); });""" % PORT


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        name = os.path.basename(urllib.parse.unquote(self.path.lstrip("/")))
        if not name.endswith(".png"):
            self.send_response(400)
            self._cors()
            self.end_headers()
            return
        data = self.rfile.read(int(self.headers["Content-Length"])).decode()
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
