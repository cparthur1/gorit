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
        else:
            super().do_GET()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/api/data', '/api/status', '/api/backups'):
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
                    print("-" * 64, flush=True)
                    print("🔒 Access restricted to this machine only (127.0.0.1)", flush=True)
                elif mode == "lan":
                    print("Gorit Server Running (LAN MODE)", flush=True)
                    print("-" * 64, flush=True)
                    print(f"👉 Localhost:    http://localhost:{p}", flush=True)
                    if lan_ips:
                        for ip in lan_ips:
                            print(f"👉 LAN URL:      http://{ip}:{p}", flush=True)
                    else:
                        print(f"👉 LAN URL:      http://<your-device-ip>:{p}", flush=True)
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
