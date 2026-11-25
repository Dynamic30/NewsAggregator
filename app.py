import importlib.util
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent / "backend"
module_path = backend_dir / "main.py"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

spec = importlib.util.spec_from_file_location("main", module_path)
if spec is None or spec.loader is None:
    raise ImportError(f"Could not load module from {module_path}")

module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
app = module.app

# for cloudflare workers, for deployment
try:
    from workers import asgi
    Default = asgi.entrypoint(app)
except ImportError:
    pass
