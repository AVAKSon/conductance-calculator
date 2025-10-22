import threading
import webview
import uvicorn

def start_backend():
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, app_dir="backend")

if __name__ == "__main__":
    # Run FastAPI in background
    t = threading.Thread(target=start_backend, daemon=True)
    t.start()

    # Launch frontend (point to your local index.html)
    webview.create_window("Conductance Calculator", "frontend/index.html")
    webview.start()
