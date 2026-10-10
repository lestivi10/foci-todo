"""Exercise packaged assets, CRUD, and persistence across container replacement.

Requires a built image and Docker. Uses a unique disposable container and volume;
never touches the application's normal Compose volume or a developer database.
"""

import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request
from uuid import uuid4


def docker(*args: str) -> str:
    return subprocess.check_output(["docker", *args], text=True).strip()


def request(base: str, path: str, method: str = "GET", body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        base + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        content = response.read()
        return response.status, json.loads(content) if content else None


def start(image: str, name: str, volume: str) -> str:
    docker(
        "run",
        "-d",
        "--name",
        name,
        "-p",
        "127.0.0.1::8000",
        "-v",
        f"{volume}:/data",
        image,
    )
    address = docker("port", name, "8000/tcp")
    base = f"http://{address}"
    for _ in range(60):
        try:
            if request(base, "/api/health")[0] == 200:
                return base
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(0.5)
    raise RuntimeError(f"Container did not become ready: {docker('logs', name)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default="daylist:local")
    args = parser.parse_args()
    suffix = uuid4().hex[:12]
    name, volume = f"daylist-smoke-{suffix}", f"daylist-smoke-data-{suffix}"
    docker("volume", "create", volume)
    try:
        base = start(args.image, name, volume)
        with urllib.request.urlopen(base, timeout=5) as response:
            assert response.status == 200 and b'<div id="root">' in response.read()
        status, task = request(
            base, "/api/todos", "POST", {"title": "Container persistence"}
        )
        assert status == 201
        path = f"/api/todos/{task['id']}"
        _, updated = request(base, path, "PATCH", {"isCompleted": True})
        assert updated["isCompleted"] is True
        docker("rm", "-f", name)
        base = start(args.image, name, volume)
        assert request(base, path)[1] == updated, (
            "Data did not survive container replacement"
        )
        assert request(base, path, "DELETE")[0] == 204
        assert request(base, "/api/todos")[1] == []
        print("PASS: SPA, health, CRUD, and persistence across container replacement")
    finally:
        # Cleanup only the unique resources this invocation owns, including on failure.
        subprocess.run(["docker", "rm", "-f", name], check=False, capture_output=True)
        subprocess.run(
            ["docker", "volume", "rm", volume], check=False, capture_output=True
        )


if __name__ == "__main__":
    main()
