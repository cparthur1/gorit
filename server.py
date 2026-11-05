import http.server
import socketserver
import os
import sys
import shutil
import subprocess
import threading
import re
import atexit
import argparse
import json
import urllib.parse
import socket
import html
import email
import email.policy
from datetime import datetime

DEFAULT_PORT = 8080
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_LOCK = threading.Lock()

def get_lan_ips():
    """
    Discovers all non-loopback IPv4 addresses on the host machine.
    Uses routing trick, hostname lookup, and network interface inspection.
    """
    ips = []

    # Method 1: Outbound route lookup via UDP socket (does not send network packets)
    for target in [('8.8.8.8', 80), ('1.1.1.1', 80), ('192.168.1.1', 80), ('10.255.255.255', 80)]:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.settimeout(0.3)
                s.connect(target)
                ip = s.getsockname()[0]
                if ip and not ip.startswith('127.') and ip != '0.0.0.0' and ip not in ips:
                    ips.append(ip)
                    break
        except Exception:
            continue

    # Method 2: Hostname resolution
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith('127.') and ip != '0.0.0.0' and ip not in ips:
                ips.append(ip)
    except Exception:
        pass

    # Method 3: Network interface inspection (ifconfig / ip addr)
    for cmd in [['ip', 'route', 'get', '1.1.1.1'], ['ip', 'addr'], ['ifconfig']]:
        try:
            out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, text=True)
            for match in re.finditer(r'(?:src\s+|inet\s+(?:addr:)?)([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)', out):
                ip = match.group(1)
                if not ip.startswith('127.') and not ip.startswith('169.254.') and ip != '0.0.0.0' and ip not in ips:
                    ips.append(ip)
        except Exception:
            continue

    return ips

def format_size(size_bytes):
    """Formats byte count into human-readable size (B, KB, MB, GB)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

def get_file_icon(name, is_dir):
    """Returns a visual clean SVG icon corresponding to file type or directory."""
    if is_dir:
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'
    ext = os.path.splitext(name)[1].lower()
    if ext in ('.html', '.htm'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>'
    elif ext in ('.js', '.ts', '.py', '.sh', '.bash'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>'
    elif ext in ('.css', '.scss', '.less'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"></path></svg>'
    elif ext in ('.json', '.xml', '.yaml', '.yml'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
    elif ext in ('.md', '.txt', '.log'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
    elif ext in ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>'
    elif ext in ('.pdf', '.doc', '.docx'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
    elif ext in ('.zip', '.tar', '.gz', '.bak'):
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.55" y2="4.24"></line><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22.76" x2="12" y2="12"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>'
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>'

def get_data_filepath():
    """Finds or defaults path to data.json."""
    local_path = os.path.join(Handler.directory, "data.json")
    if os.path.exists(local_path):
        return local_path
    script_path = os.path.join(SCRIPT_DIR, "data.json")
    if os.path.exists(script_path):
        return script_path
    return local_path

def get_backup_dir():
    """Finds or defaults backup directory path."""
    return os.path.join(os.path.dirname(get_data_filepath()), "backups")

def get_persisted_data():
    """Reads data from data.json if it exists."""
    data_file = get_data_filepath()
    with DATA_LOCK:
        if os.path.exists(data_file):
            try:
                with open(data_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[ERROR] Could not read {data_file}: {e}", flush=True)
                bak_file = data_file + ".bak"
                if os.path.exists(bak_file):
                    try:
                        with open(bak_file, "r", encoding="utf-8") as f:
                            print(f"[INFO] Successfully recovered data from {bak_file}", flush=True)
                            return json.load(f)
                    except Exception as e2:
                        print(f"[ERROR] Could not read backup {bak_file}: {e2}", flush=True)
    return None

def save_persisted_data(data):
    """Atomically writes data to data.json on the host device and creates a safety backup."""
    data_file = get_data_filepath()
    with DATA_LOCK:
        try:
            if os.path.exists(data_file) and os.path.getsize(data_file) > 0:
                try:
                    shutil.copy2(data_file, data_file + ".bak")
                except Exception:
                    pass

            tmp_file = data_file + ".tmp"
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_file, data_file)
            return True, None
        except Exception as e:
            print(f"[ERROR] Failed to save {data_file}: {e}", flush=True)
            return False, str(e)

def create_host_backup(data=None):
    """Creates a timestamped backup copy of user data in the backups directory."""
    data_file = get_data_filepath()
    backup_dir = get_backup_dir()
    with DATA_LOCK:
        try:
            os.makedirs(backup_dir, exist_ok=True)
            if data is None:
                if not os.path.exists(data_file):
                    return False, "No data file to backup"
                with open(data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"studyflow_backup_{timestamp}.json"
            backup_filepath = os.path.join(backup_dir, backup_filename)

            with open(backup_filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            return True, backup_filename
        except Exception as e:
            return False, str(e)

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

class Handler(http.server.SimpleHTTPRequestHandler):
    directory = SCRIPT_DIR

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=Handler.directory, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/data':
            self.handle_get_data()
        elif parsed.path == '/api/status':
            self.handle_get_status()
        elif parsed.path == '/api/backups':
            self.handle_list_backups()
        elif parsed.path in ('/files', '/files/', '/browse', '/browse/'):
            self.handle_browse_directory(parsed)
        else:
            super().do_GET()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/files', '/files/', '/browse', '/browse/'):
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
        elif parsed.path in ('/api/data', '/api/status', '/api/backups'):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
        else:
            super().do_HEAD()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/data':
            self.handle_save_data()
        elif parsed.path == '/api/backup':
            self.handle_create_backup()
        elif parsed.path == '/api/restore':
            self.handle_restore_backup()
        elif parsed.path in ('/upload', '/api/upload'):
            self.handle_file_upload(parsed)
        else:
            self.send_error(404, "Not Found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/data':
            self.handle_save_data()
        else:
            self.send_error(404, "Not Found")

    def handle_get_data(self):
        data = get_persisted_data()
        if data is None:
            data = []
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_save_data(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0:
                self.send_json_response(400, {"error": "Empty request body"})
                return
            raw_body = self.rfile.read(length).decode('utf-8')
            data = json.loads(raw_body)
        except Exception as e:
            self.send_json_response(400, {"error": f"Invalid JSON payload: {e}"})
            return

        success, err = save_persisted_data(data)
        if success:
            data_file = get_data_filepath()
            num_subjects = len(data) if isinstance(data, list) else (len(data.get("subjects", [])) if isinstance(data, dict) else 0)
            now_iso = datetime.now().isoformat()
            print(f"[Gorit Autosave] Persisted {num_subjects} subjects locally to {data_file}", flush=True)
            self.send_json_response(200, {
                "status": "ok",
                "message": "Data successfully persisted to host device",
                "saved_at": now_iso,
                "count": num_subjects
            })
        else:
            self.send_json_response(500, {"error": f"Failed to persist data: {err}"})

    def handle_get_status(self):
        data_file = get_data_filepath()
        exists = os.path.exists(data_file)
        size = os.path.getsize(data_file) if exists else 0
        data = get_persisted_data() or []
        count = len(data) if isinstance(data, list) else len(data.get("subjects", []))
        self.send_json_response(200, {
            "status": "running",
            "mode": getattr(self.server, "mode", "unknown"),
            "port": getattr(self.server, "server_port", DEFAULT_PORT),
            "directory": Handler.directory,
            "storage_file": data_file,
            "exists": exists,
            "size_bytes": size,
            "subjects_count": count,
            "lan_ips": get_lan_ips()
        })

    def handle_create_backup(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = None
            if length > 0:
                raw_body = self.rfile.read(length).decode('utf-8')
                data = json.loads(raw_body)
        except Exception:
            data = None

        success, filename = create_host_backup(data)
        if success:
            self.send_json_response(200, {
                "status": "ok",
                "message": "Backup created on host device",
                "filename": filename
            })
        else:
            self.send_json_response(500, {"error": f"Failed to create backup: {filename}"})

    def handle_list_backups(self):
        backups = []
        backup_dir = get_backup_dir()
        if os.path.exists(backup_dir):
            for fname in sorted(os.listdir(backup_dir), reverse=True):
                if fname.endswith(".json"):
                    fpath = os.path.join(backup_dir, fname)
                    backups.append({
                        "filename": fname,
                        "size_bytes": os.path.getsize(fpath),
                        "created_at": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat()
                    })
        self.send_json_response(200, {"backups": backups})

    def handle_restore_backup(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0:
                self.send_json_response(400, {"error": "Empty request body"})
                return
            raw_body = self.rfile.read(length).decode('utf-8')
            payload = json.loads(raw_body)

            backup_dir = get_backup_dir()
            if "filename" in payload:
                filename = os.path.basename(payload["filename"])
                target_file = os.path.join(backup_dir, filename)
                if not os.path.exists(target_file):
                    self.send_json_response(404, {"error": "Backup file not found"})
                    return
                with open(target_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            elif "data" in payload:
                data = payload["data"]
            elif isinstance(payload, list):
                data = payload
            else:
                self.send_json_response(400, {"error": "Invalid restore payload"})
                return

            success, err = save_persisted_data(data)
            if success:
                num_subjects = len(data) if isinstance(data, list) else len(data.get("subjects", []))
                self.send_json_response(200, {
                    "status": "ok",
                    "message": "Data successfully restored",
                    "count": num_subjects,
                    "data": data
                })
            else:
                self.send_json_response(500, {"error": f"Failed to restore data: {err}"})
        except Exception as e:
            self.send_json_response(400, {"error": str(e)})

    def handle_browse_directory(self, parsed):
        """Generates a responsive, modern HTML file browser with upload & instant download capabilities."""
        query = urllib.parse.parse_qs(parsed.query)
        subpath = query.get('subpath', [''])[0].strip().replace('\\', '/')
        uploaded_msg = query.get('uploaded', [''])[0].strip()

        # Sanitize and resolve target path to prevent path traversal
        normalized_subpath = os.path.normpath(subpath).lstrip('/')
        if normalized_subpath == '.' or not normalized_subpath:
            target_dir = Handler.directory
            rel_display = ""
        else:
            target_dir = os.path.abspath(os.path.join(Handler.directory, normalized_subpath))
            if not (target_dir == Handler.directory or target_dir.startswith(Handler.directory + os.sep)):
                target_dir = Handler.directory
                rel_display = ""
            else:
                rel_display = normalized_subpath

        if not os.path.isdir(target_dir):
            self.send_error(404, "Directory Not Found")
            return

        entries = []
        try:
            for entry in sorted(os.scandir(target_dir), key=lambda e: (not e.is_dir(), e.name.lower())):
                if entry.name.startswith('.'):
                    continue
                stat = entry.stat()
                is_dir = entry.is_dir()
                entry_rel = os.path.join(rel_display, entry.name).replace('\\', '/') if rel_display else entry.name

                if is_dir:
                    url = f"/files?subpath={urllib.parse.quote(entry_rel)}"
                else:
                    url = "/" + urllib.parse.quote(entry_rel)

                entries.append({
                    "name": entry.name,
                    "is_dir": is_dir,
                    "icon": get_file_icon(entry.name, is_dir),
                    "size": "-" if is_dir else format_size(stat.st_size),
                    "raw_size": stat.st_size if not is_dir else 0,
                    "mtime": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                    "url": url,
                    "rel_path": entry_rel
                })
        except Exception as e:
            self.send_error(500, f"Failed to list directory: {e}")
            return

        # Breadcrumbs
        breadcrumbs = ['<a href="/files">Home</a>']
        if rel_display:
            parts = rel_display.split('/')
            accum = []
            for part in parts:
                accum.append(part)
                accum_path = "/".join(accum)
                breadcrumbs.append(f'<a href="/files?subpath={urllib.parse.quote(accum_path)}">{html.escape(part)}</a>')
        breadcrumbs_html = " / ".join(breadcrumbs)

        # Parent directory link
        parent_link_html = ""
        if rel_display:
            parent_rel = os.path.dirname(rel_display).replace('\\', '/')
            parent_url = f"/files?subpath={urllib.parse.quote(parent_rel)}" if parent_rel else "/files"
            parent_link_html = f'''
            <tr>
              <td colspan="4" style="padding: 0.65rem 1rem;">
                <a href="{parent_url}" class="table-link" style="color: var(--primary);">
                  📁 <strong>.. (Parent Directory)</strong>
                </a>
              </td>
            </tr>'''

        # File rows
        rows_html = []
        for e in entries:
            name_escaped = html.escape(e["name"])
            if e["is_dir"]:
                actions_html = f'<a href="{e["url"]}" class="btn-action">Open ➔</a>'
            else:
                actions_html = f'<a href="{e["url"]}" download="{name_escaped}" class="btn-action btn-download">Download ↓</a>'

            rows_html.append(f'''
            <tr>
              <td class="file-name-cell">
                <span class="file-icon">{e["icon"]}</span>
                <a href="{e["url"]}" class="table-link"><strong>{name_escaped}</strong></a>
              </td>
              <td class="file-size-cell">{e["size"]}</td>
              <td class="file-date-cell">{e["mtime"]}</td>
              <td class="file-action-cell">{actions_html}</td>
            </tr>''')

        if not entries and not rel_display:
            rows_html.append('<tr><td colspan="4" class="empty-cell">Directory is currently empty.</td></tr>')

        # Check if Gorit index.html is available
        has_app = os.path.exists(os.path.join(Handler.directory, "index.html"))
        app_button_html = '<a href="/" class="header-btn">Open Gorit</a>' if has_app else ''

        # Upload message alert
        upload_alert_html = ""
        if uploaded_msg:
            upload_alert_html = f'''
            <div class="alert-success">
              ✓ Successfully uploaded: <strong>{html.escape(uploaded_msg)}</strong>
            </div>'''

        current_mode = getattr(self.server, "mode", "lan").upper()

        page_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gorit - Instant HTTP File Server</title>
  <style>
    :root {{
      --bg: #0b0f19;
      --surface: #131b2e;
      --surface-border: #22314d;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #0284c7;
      --success: #34d399;
      --success-bg: rgba(52, 211, 153, 0.12);
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --radius: 10px;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 1.5rem;
      min-height: 100vh;
    }}
    .container {{
      max-width: 960px;
      margin: 0 auto;
    }}
    .header {{
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--surface-border);
    }}
    .header-title {{
      font-size: 1.4rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }}
    .badge-mode {{
      font-size: 0.72rem;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-weight: 600;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }}
    .header-actions {{
      display: flex;
      gap: 0.5rem;
    }}
    .header-btn {{
      background: var(--primary);
      color: #0b0f19;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 0.5rem 0.9rem;
      border-radius: var(--radius);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }}
    .header-btn:hover {{
      background: var(--primary-hover);
      color: white;
    }}
    .card {{
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }}
    .breadcrumbs {{
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }}
    .breadcrumbs a {{
      color: var(--primary);
      text-decoration: none;
    }}
    .breadcrumbs a:hover {{
      text-decoration: underline;
    }}
    .alert-success {{
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid var(--success);
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }}
    .upload-section {{
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
      background: rgba(255, 255, 255, 0.02);
      padding: 1rem 1.25rem;
      border-radius: var(--radius);
      border: 1px dashed var(--surface-border);
    }}
    .upload-title {{
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
    }}
    .upload-form {{
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }}
    .file-input {{
      font-size: 0.82rem;
      color: var(--text-muted);
    }}
    .btn-upload {{
      background: var(--surface-border);
      color: var(--text);
      border: 1px solid var(--surface-border);
      padding: 0.45rem 0.9rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.2s;
    }}
    .btn-upload:hover {{
      background: var(--primary);
      color: #0b0f19;
      border-color: var(--primary);
    }}
    .table-wrapper {{
      overflow-x: auto;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }}
    th {{
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--surface-border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }}
    td {{
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: middle;
    }}
    tr:hover td {{
      background: rgba(255, 255, 255, 0.02);
    }}
    .file-name-cell {{
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }}
    .file-icon {{
      font-size: 1.1rem;
      flex-shrink: 0;
    }}
    .table-link {{
      color: var(--text);
      text-decoration: none;
      word-break: break-all;
    }}
    .table-link:hover {{
      color: var(--primary);
      text-decoration: underline;
    }}
    .file-size-cell, .file-date-cell {{
      color: var(--text-muted);
      white-space: nowrap;
      font-size: 0.82rem;
    }}
    .file-action-cell {{
      text-align: right;
      white-space: nowrap;
    }}
    .btn-action {{
      display: inline-block;
      text-decoration: none;
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      background: rgba(56, 189, 248, 0.12);
      color: var(--primary);
      border: 1px solid rgba(56, 189, 248, 0.25);
      transition: all 0.15s ease;
    }}
    .btn-action:hover {{
      background: var(--primary);
      color: #0b0f19;
    }}
    .btn-download {{
      background: rgba(52, 211, 153, 0.12);
      color: var(--success);
      border-color: rgba(52, 211, 153, 0.25);
    }}
    .btn-download:hover {{
      background: var(--success);
      color: #0b0f19;
    }}
    .empty-cell {{
      text-align: center;
      color: var(--text-muted);
      padding: 2.5rem 1rem;
    }}
    .footer-note {{
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: center;
      margin-top: 2rem;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <span>📁 Instant HTTP File Server</span>
        <span class="badge-mode">{current_mode} MODE</span>
      </div>
      <div class="header-actions">
        {app_button_html}
      </div>
    </div>

    {upload_alert_html}

    <div class="card">
      <div class="breadcrumbs">
        📍 <strong>Location:</strong> {breadcrumbs_html}
      </div>

      <div class="upload-section">
        <div class="upload-title">📤 Upload File to LAN Server</div>
        <form action="/upload" method="post" enctype="multipart/form-data" class="upload-form">
          <input type="hidden" name="subpath" value="{html.escape(rel_display)}">
          <input type="file" name="upload_file" required class="file-input">
          <button type="submit" class="btn-upload">Upload File</button>
        </form>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Last Modified</th>
              <th style="text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            {parent_link_html}
            {''.join(rows_html)}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer-note">
      Gorit Instant HTTP File Server • LAN & Cross-Device Access Active
    </div>
  </div>
</body>
</html>"""

        body = page_html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_file_upload(self, parsed):
        """Processes multipart file upload and saves file to the active directory."""
        content_type = self.headers.get('Content-Type', '')
        if not content_type.startswith('multipart/form-data'):
            self.send_json_response(400, {"error": "Content-Type must be multipart/form-data"})
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0 or length > 500 * 1024 * 1024:
                self.send_json_response(400, {"error": "Invalid Content-Length (max 500MB)"})
                return

            raw_body = self.rfile.read(length)
            header_bytes = f"Content-Type: {content_type}\r\n\r\n".encode('utf-8')
            msg = email.message_from_bytes(header_bytes + raw_body, policy=email.policy.default)

            target_subpath = ""
            for part in msg.iter_parts():
                if part.get_param('name', header='content-disposition') == 'subpath':
                    subpath_val = part.get_payload(decode=True).decode('utf-8', errors='ignore').strip().replace('\\', '/')
                    target_subpath = os.path.normpath(subpath_val).lstrip('/')
                    if target_subpath == '.':
                        target_subpath = ""

            target_dir = os.path.abspath(os.path.join(Handler.directory, target_subpath)) if target_subpath else Handler.directory
            if not (target_dir == Handler.directory or target_dir.startswith(Handler.directory + os.sep)):
                target_dir = Handler.directory
                target_subpath = ""

            os.makedirs(target_dir, exist_ok=True)

            saved_files = []
            for part in msg.iter_parts():
                fname = part.get_filename()
                if fname:
                    safe_name = os.path.basename(fname).strip()
                    if not safe_name:
                        continue
                    payload = part.get_payload(decode=True)
                    dest_path = os.path.join(target_dir, safe_name)
                    with open(dest_path, "wb") as f:
                        f.write(payload)
                    saved_files.append(safe_name)

            if not saved_files:
                self.send_json_response(400, {"error": "No file received in upload"})
                return

            accept = self.headers.get('Accept', '')
            if 'text/html' in accept or not accept:
                redirect_url = f"/files?uploaded={urllib.parse.quote(', '.join(saved_files))}"
                if target_subpath:
                    redirect_url += f"&subpath={urllib.parse.quote(target_subpath)}"
                self.send_response(303)
                self.send_header('Location', redirect_url)
                self.end_headers()
            else:
                self.send_json_response(200, {
                    "status": "ok",
                    "message": "File(s) uploaded successfully",
                    "saved_files": saved_files,
                    "target_dir": target_dir
                })
        except Exception as e:
            self.send_json_response(500, {"error": f"File upload failed: {e}"})

    def send_json_response(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def start_tunnel(port, protocol="http2"):
    """Starts cloudflared tunnel --url http://localhost:<port> in the background."""
    if not shutil.which("cloudflared"):
        print("\n[WARN] 'cloudflared' command was not found in your PATH.", flush=True)
        print("   To install Cloudflare Tunnel, visit:", flush=True)
        print("   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/", flush=True)
        print("   Continuing with local/LAN server only...\n", flush=True)
        return None

    cmd = ["cloudflared", "tunnel", "--no-autoupdate", "--no-prechecks", "--retries", "10"]
    if protocol:
        cmd.extend(["--protocol", protocol])
    cmd.extend(["--url", f"http://localhost:{port}"])

    print(f"\nStarting Cloudflare tunnel: {' '.join(cmd)}", flush=True)
    print("Connecting to Cloudflare edge network...", flush=True)

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
    except Exception as e:
        print(f"[ERROR] Failed to start cloudflared: {e}\n", flush=True)
        return None

    def monitor_tunnel_output():
        state = {"url": None, "announced": False}
        lock = threading.Lock()

        def announce_ready(conn_info=""):
            with lock:
                if state["announced"]:
                    return
                state["announced"] = True
                print("\n" + "=" * 62, flush=True)
                print(f"🌐 CLOUDFLARE TUNNEL ACTIVE & READY{conn_info}", flush=True)
                print(f"Public URL: {state['url']}", flush=True)
                print("   (Open this link from anywhere in the world on any device)", flush=True)
                print("=" * 62 + "\n", flush=True)

        for line in iter(proc.stdout.readline, ''):
            if not line:
                break
            match = re.search(r'(https://[a-zA-Z0-9.-]+\.trycloudflare\.com)', line)
            if match and not state["url"]:
                state["url"] = match.group(1)
                print(f"[cloudflared] Assigned URL: {state['url']}", flush=True)
                print("[cloudflared] Establishing connection to Cloudflare Edge...", flush=True)
                # Fallback timer in case log phrasing changes in future versions
                fallback = threading.Timer(6.0, announce_ready)
                fallback.daemon = True
                fallback.start()

            if "Registered tunnel connection" in line:
                loc_match = re.search(r'location=([a-zA-Z0-9]+)', line)
                conn_info = f" (PoP: {loc_match.group(1)})" if loc_match else ""
                announce_ready(conn_info)
            elif "ERR" in line or "error" in line.lower():
                if "ping_group_range" in line.lower() or "icmp" in line.lower():
                    continue
                if "quic" in line.lower() and "dial" in line.lower():
                    continue
                print(f"[cloudflared] {line.strip()}", flush=True)

        if proc.poll() is not None:
            print(f"\n[cloudflared] Tunnel process stopped (code {proc.returncode}).", flush=True)

    thread = threading.Thread(target=monitor_tunnel_output, daemon=True)
    thread.start()
    return proc

def stop_tunnel(proc):
    """Terminates the cloudflared process cleanly."""
    if proc and proc.poll() is None:
        print("\nStopping Cloudflare tunnel...", flush=True)
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()

def ask_mode():
    """
    Prompts the user interactively on each terminal run to choose
    between local (localhost), LAN (Local Area Network), and WWW (Cloudflare tunnel).
    """
    if not sys.stdin.isatty():
        return "local"

    lan_ips = get_lan_ips()
    lan_hint = f" ({lan_ips[0]})" if lan_ips else ""

    print("\n" + "=" * 62, flush=True)
    print("Gorit HTTP Server - Network Access Selection", flush=True)
    print("=" * 62, flush=True)
    print("Choose server access mode:", flush=True)
    print("  [1] local  - Localhost only (127.0.0.1 - private to this device)", flush=True)
    print(f"  [2] LAN    - Local Area Network (instant HTTP file serve on Wi-Fi{lan_hint})", flush=True)
    print("  [3] WWW    - Cloudflare Tunnel (public internet link via cloudflared)", flush=True)
    print("-" * 62, flush=True)

    while True:
        try:
            choice = input("Select mode [local/LAN/WWW] (localhost/LAN/cloudfare) [1]: ").strip().lower()
            if not choice:
                return "local"
            if choice in ("1", "local", "localhost", "loc", "l"):
                return "local"
            elif choice in ("2", "lan", "wifi", "network", "net"):
                return "lan"
            elif choice in ("3", "www", "cloudflare", "cloudfare", "cf", "tunnel", "w", "c"):
                return "www"
            else:
                print(f"[!] Invalid choice: '{choice}'. Please select: 1 (local), 2 (LAN), or 3 (WWW).", flush=True)
        except (KeyboardInterrupt, EOFError):
            print("\n[INFO] Exiting...", flush=True)
            sys.exit(0)

def run_server(port=DEFAULT_PORT, mode="local", directory=None, protocol="http2", bind_address=None, enable_tunnel=None):
    # Support backward compatibility where enable_tunnel boolean was passed
    if enable_tunnel is not None and mode is None:
        mode = "www" if enable_tunnel else "local"
    elif mode is None:
        mode = "local"
    mode = mode.lower()
    if directory:
        Handler.directory = os.path.abspath(directory)
    else:
        Handler.directory = SCRIPT_DIR

    # Determine bind address
    if bind_address:
        bind_host = bind_address
    elif mode == "local":
        bind_host = "127.0.0.1"
    else:
        # LAN or WWW mode binds to all interfaces
        bind_host = "0.0.0.0"

    data_file = get_data_filepath()
    existing_data = get_persisted_data()
    if existing_data is not None:
        count = len(existing_data) if isinstance(existing_data, list) else len(existing_data.get("subjects", []))
        print(f"\n[Gorit] Local persistent storage loaded: {data_file} ({count} subjects)", flush=True)
    else:
        print(f"\n[Gorit] Local persistent storage initialized: {data_file} (ready for autosave)", flush=True)

    lan_ips = get_lan_ips()

    for p in range(port, port + 10):
        try:
            with ThreadedTCPServer((bind_host, p), Handler) as httpd:
                httpd.mode = mode
                httpd.server_port = p

                print("\n" + "=" * 64, flush=True)
                if mode == "local":
                    print("Gorit Server Running (LOCAL MODE)", flush=True)
                    print("-" * 64, flush=True)
                    print(f"👉 Localhost:    http://localhost:{p}", flush=True)
                    print(f"                 http://127.0.0.1:{p}", flush=True)
                    print(f"📁 Serving Dir:  {Handler.directory}", flush=True)
                    print(f"📂 File Browser: http://localhost:{p}/files", flush=True)
                    print("-" * 64, flush=True)
                    print("🔒 Access restricted to this machine only (127.0.0.1)", flush=True)
                elif mode == "lan":
                    print("Gorit Instant HTTP File Server (LAN MODE)", flush=True)
                    print("-" * 64, flush=True)
                    print(f"👉 Localhost:    http://localhost:{p}", flush=True)
                    if lan_ips:
                        for ip in lan_ips:
                            print(f"👉 LAN URL:      http://{ip}:{p}", flush=True)
                    else:
                        print(f"👉 LAN URL:      http://<your-device-ip>:{p}", flush=True)
                    print(f"📁 Serving Dir:  {Handler.directory}", flush=True)
                    browser_host = lan_ips[0] if lan_ips else "localhost"
                    print(f"📂 File Browser: http://{browser_host}:{p}/files", flush=True)
                    print("-" * 64, flush=True)
                    print("📱 Instant LAN File Serving:", flush=True)
                    print("   Connect other devices (phones, tablets, PCs) to the same", flush=True)
                    print("   Wi-Fi network and open:", flush=True)
                    if lan_ips:
                        for ip in lan_ips:
                            print(f"   👉 http://{ip}:{p}", flush=True)
                    else:
                        print(f"   👉 http://<your-device-ip>:{p}", flush=True)
                elif mode == "www":
                    print("Gorit Server Running (WWW / CLOUDFLARE MODE)", flush=True)
                    print("-" * 64, flush=True)
                    print(f"👉 Localhost:    http://localhost:{p}", flush=True)
                    if lan_ips:
                        for ip in lan_ips:
                            print(f"👉 LAN URL:      http://{ip}:{p}", flush=True)
                    print(f"👉 WWW URL:      Connecting to Cloudflare network...", flush=True)
                    print(f"📁 Serving Dir:  {Handler.directory}", flush=True)
                    print("-" * 64, flush=True)
                    print("🌍 Establishing Cloudflare Tunnel for public internet access...", flush=True)
                print("=" * 64, flush=True)

                tunnel_proc = None
                if mode == "www":
                    tunnel_proc = start_tunnel(p, protocol=protocol)
                    if tunnel_proc:
                        atexit.register(stop_tunnel, tunnel_proc)

                print("\nPress Ctrl+C to stop the server.\n", flush=True)

                try:
                    httpd.serve_forever()
                except KeyboardInterrupt:
                    print("\nShutting down server...", flush=True)
                finally:
                    if tunnel_proc:
                        stop_tunnel(tunnel_proc)
                break
        except OSError:
            print(f"Port {p} in use, trying {p+1}...", flush=True)
            continue

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Gorit Local Development & Instant HTTP File Server")
    parser.add_argument("port", nargs="?", type=int, default=DEFAULT_PORT, help=f"Port to run on (default: {DEFAULT_PORT})")
    parser.add_argument("-d", "--dir", "--directory", dest="directory", default=None, help="Directory to serve files from (default: project folder)")
    parser.add_argument("-b", "--bind", default=None, help="Specify alternate bind address (e.g. 127.0.0.1 or 0.0.0.0)")
    parser.add_argument("-m", "--mode", choices=["local", "lan", "www"], default=None, help="Server mode: local (localhost), lan (LAN / Wi-Fi), www (Cloudflare tunnel)")
    parser.add_argument("--local", "-l", action="store_const", dest="mode", const="local", help="Run in local-only mode (localhost)")
    parser.add_argument("--lan", action="store_const", dest="mode", const="lan", help="Run in LAN mode (Wi-Fi / Local Area Network)")
    parser.add_argument("--www", "--cloudflare", action="store_const", dest="mode", const="www", help="Run in WWW mode (Cloudflare tunnel)")
    parser.add_argument("--tunnel", "-t", action="store_const", dest="mode", const="www", help="Activate Cloudflare tunnel without asking (WWW mode)")
    parser.add_argument("--no-tunnel", action="store_const", dest="mode", const="local", help="Local access only without asking (Local mode)")
    parser.add_argument("--protocol", default="http2", choices=["http2", "quic"], help="Tunnel transport protocol (default: http2)")

    args = parser.parse_args()

    selected_mode = args.mode
    if selected_mode is None:
        selected_mode = ask_mode()

    run_server(
        port=args.port,
        mode=selected_mode,
        directory=args.directory,
        protocol=args.protocol,
        bind_address=args.bind
    )
