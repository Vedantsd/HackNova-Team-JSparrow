"""
CommitFlow All-in-One Startup Script
Starts both the Flask Backend (port 5000) and Vite Frontend (port 5173) simultaneously.
Press Ctrl+C at any time to cleanly stop both services.
"""

import sys
import os
import subprocess
import threading
import time
import signal
import webbrowser

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))

# ANSI terminal colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"

def stream_output(pipe, prefix, color):
    """Streams process output line-by-line with color-coded prefix."""
    try:
        for line in iter(pipe.readline, ''):
            if not line:
                break
            print(f"{color}[{prefix}]{RESET} {line.rstrip()}", flush=True)
    except Exception:
        pass
    finally:
        pipe.close()

def main():
    print(f"\n{BOLD}{CYAN}================================================================={RESET}")
    print(f"{BOLD}  CommitFlow — Meeting-to-Execution Automation Platform{RESET}")
    print(f"  Starting Flask Backend (Neon + Gemini) & Vite Frontend...")
    print(f"{BOLD}{CYAN}================================================================={RESET}\n")

    # 1. Verify .env file exists
    env_file = os.path.join(ROOT_DIR, ".env")
    if not os.path.exists(env_file):
        example_file = os.path.join(ROOT_DIR, ".env.example")
        if os.path.exists(example_file):
            print(f"{YELLOW}[Setup] .env file not found. Creating from .env.example...{RESET}")
            import shutil
            shutil.copyfile(example_file, env_file)

    # 2. Launch Backend (Python Flask on port 5000)
    backend_script = os.path.join(ROOT_DIR, "server", "app.py")
    backend_cmd = [sys.executable, backend_script]
    print(f"{CYAN}--> [1/2] Starting Flask Backend on port 5000...{RESET}")
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace"
    )

    # 3. Launch Frontend (Vite on port 5173)
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    print(f"{GREEN}--> [2/2] Starting Vite Frontend on port 5173...{RESET}")
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace"
    )

    # 4. Stream output in daemon threads
    t_back = threading.Thread(
        target=stream_output,
        args=(backend_proc.stdout, "Backend:5000", CYAN),
        daemon=True
    )
    t_front = threading.Thread(
        target=stream_output,
        args=(frontend_proc.stdout, "Frontend:5173", GREEN),
        daemon=True
    )
    t_back.start()
    t_front.start()

    # 5. Display ready banner and optionally open browser
    def open_browser_banner():
        time.sleep(2.5)
        print(f"\n{BOLD}{GREEN}-----------------------------------------------------------------{RESET}")
        print(f"{BOLD}  CommitFlow is running successfully!{RESET}")
        print(f"  * Frontend UI : {BOLD}http://localhost:5173{RESET}")
        print(f"  * Backend API : {BOLD}http://localhost:5000{RESET}")
        print(f"  * Health Check: {BOLD}http://localhost:5000/api/health{RESET}")
        print(f"  * Press {BOLD}Ctrl+C{RESET} to stop both services.")
        print(f"{BOLD}{GREEN}-----------------------------------------------------------------{RESET}\n", flush=True)
        try:
            webbrowser.open("http://localhost:5173")
        except Exception:
            pass

    threading.Thread(target=open_browser_banner, daemon=True).start()

    # 6. Clean shutdown handler
    def shutdown_services(signum=None, frame=None):
        print(f"\n{YELLOW}Shutting down CommitFlow services...{RESET}", flush=True)
        try:
            if backend_proc.poll() is None:
                backend_proc.terminate()
        except Exception:
            pass

        try:
            if frontend_proc.poll() is None:
                frontend_proc.terminate()
        except Exception:
            pass

        time.sleep(1)

        # Force kill on Windows if processes still linger
        if backend_proc.poll() is None:
            backend_proc.kill()
        if frontend_proc.poll() is None:
            frontend_proc.kill()

        print(f"{GREEN}All CommitFlow processes stopped cleanly.{RESET}")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_services)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown_services)

    # 7. Monitor process health
    try:
        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None:
                print(f"{YELLOW}[Backend] Process exited with return code {backend_proc.poll()}.{RESET}")
                shutdown_services()
            if frontend_proc.poll() is not None:
                print(f"{YELLOW}[Frontend] Process exited with return code {frontend_proc.poll()}.{RESET}")
                shutdown_services()
    except KeyboardInterrupt:
        shutdown_services()

if __name__ == "__main__":
    main()
