"""Previs Web v2.0.0 optional, authenticated loopback-only Kimodo connector."""
import argparse
from collections import OrderedDict
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import secrets
import subprocess
import sys
import threading
from urllib.parse import urlsplit
import uuid

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / '2026-10-22-runtime'
WORKER = ROOT / '2026-10-22-worker.py'


def validate_origin(origin):
    parsed = urlsplit(origin)
    if (parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment
            or not parsed.hostname or parsed.port == 0):
        raise ValueError('Supply an exact origin without path or credentials')
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1')):
        raise ValueError('Origin requires HTTPS, except HTTP loopback development')
    if origin != f'{parsed.scheme}://{parsed.netloc}' or '*' in origin:
        raise ValueError('Invalid exact origin')
    return origin


def python_path():
    candidate = RUNTIME / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    return str(candidate) if candidate.is_file() else sys.executable


class Engine:
    def __init__(self):
        self.lock = threading.RLock()
        self.jobs = OrderedDict()
        self.process = None
        self.active = None

    def command(self, kind, args, job_id):
        if kind == 'setup':
            return [sys.executable, str(ROOT / '2026-10-22-bootstrap.py'), '--install'], None
        if kind == 'installModel':
            return [python_path(), str(WORKER), 'install-model'], None
        output = RUNTIME / ('2026-10-23-motion-' + job_id + '.json')
        return [python_path(), str(WORKER), 'generate', '--prompt', args['prompt'], '--duration',
                str(args['duration']), '--seed', str(args['seed']), '--output', str(output)], output

    def start(self, kind, args):
        with self.lock:
            if self.active:
                raise RuntimeError('A job is already running')
            job_id = str(uuid.uuid4())
            command, output = self.command(kind, args, job_id)
            env = dict(os.environ)
            env.pop('PREVIS_HF_TOKEN', None)
            token = args.get('token', '')
            if token:
                env['PREVIS_HF_TOKEN'] = token
            env['PYTHONDONTWRITEBYTECODE'] = '1'
            process = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            self.process, self.active = process, job_id
            self.jobs[job_id] = {'state': 'running', 'progress': {'type': 'progress', 'stage': 'starting'}}
            while len(self.jobs) > 10:
                self.jobs.popitem(last=False)
            threading.Thread(target=self.collect, args=(job_id, process, output, token), daemon=True).start()
            return job_id

    def collect(self, job_id, process, output, token):
        def drain():
            with process.stderr:
                while process.stderr.read(4096):
                    pass  # Never log third-party output or credentials.
        threading.Thread(target=drain, daemon=True).start()
        result = None
        error = None
        try:
            for line in process.stdout:
                if len(line) > 65536:
                    continue
                try:
                    event = json.loads(line.replace(token, '[redacted]') if token else line)
                except ValueError:
                    continue
                if not isinstance(event, dict):
                    continue
                with self.lock:
                    if event.get('type') == 'progress':
                        self.jobs[job_id]['progress'] = {k: event[k] for k in
                            ('type', 'stage', 'message', 'file', 'index', 'total') if k in event}
                    elif event.get('type') == 'result':
                        result = {k: v for k, v in event.items() if k != 'type'}
                    elif event.get('type') == 'error':
                        error = str(event.get('message', 'Worker failed'))[:2000]
            returncode = process.wait()
            if returncode == 0 and result is not None and output is not None:
                if not output.is_file() or output.stat().st_size > 100_000_000:
                    raise ValueError('Motion output missing or too large')
                result['motion'] = json.loads(output.read_text(encoding='utf-8'))
            with self.lock:
                job = self.jobs[job_id]
                if job['state'] != 'canceled':
                    job['state'] = 'completed' if returncode == 0 and result is not None else 'failed'
                    if job['state'] == 'completed':
                        job['result'] = result
                    else:
                        job['error'] = error or 'Worker failed; check runtime installation and model access'
        except Exception:
            with self.lock:
                if self.jobs[job_id]['state'] != 'canceled':
                    self.jobs[job_id].update(state='failed', error='Unable to read worker result')
        finally:
            process.stdout.close()
            with self.lock:
                if self.active == job_id:
                    self.active, self.process = None, None

    def cancel(self):
        with self.lock:
            process, job_id = self.process, self.active
            if not process:
                return False
            self.jobs[job_id]['state'] = 'canceled'
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
                if process.poll() is None:
                    process.kill()
            process.wait(timeout=10)
            self.active, self.process = None, None
            return True


def validate_job(body):
    if not isinstance(body, dict) or set(body) != {'kind', 'args'}:
        raise ValueError('Expected kind and args')
    kind, args = body['kind'], body['args']
    if kind not in ('setup', 'installModel', 'generate') or not isinstance(args, dict):
        raise ValueError('Invalid job')
    allowed = {'generate': {'prompt', 'duration', 'seed'}, 'installModel': {'token'}, 'setup': set()}[kind]
    if set(args) - allowed:
        raise ValueError('Unexpected job arguments')
    if kind == 'generate':
        args = {'duration': 3, 'seed': 42, **args}
        if not isinstance(args.get('prompt'), str) or not args['prompt'].strip() or len(args['prompt']) > 4000:
            raise ValueError('Prompt requires 1-4000 characters')
        duration, seed = args['duration'], args['seed']
        if type(duration) not in (int, float) or not math.isfinite(duration) or not .5 <= duration <= 60:
            raise ValueError('Duration requires 0.5-60 seconds')
        if type(seed) is not int or not 0 <= seed <= 2147483647:
            raise ValueError('Seed requires an integer from 0 to 2147483647')
    if kind == 'installModel' and (not isinstance(args.get('token', ''), str) or len(args.get('token', '')) > 1024):
        raise ValueError('Invalid token')
    return kind, args


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, status, value=None, cors=False):
        payload = json.dumps(value, ensure_ascii=False, allow_nan=False).encode() if value is not None else b''
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        if cors:
            self.send_header('Access-Control-Allow-Origin', self.server.origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
        self.wfile.write(payload)

    def dispatch(self):
        self.connection.settimeout(10)
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if len(self.headers.get_all('Host', [])) != 1 or self.headers.get('Host') not in hosts:
            return self.reply(403, {'error': 'Invalid Host'})
        if self.headers.get('Origin') != self.server.origin:
            return self.reply(403, {'error': 'Origin is not paired'})
        if self.command == 'OPTIONS':
            return self.reply(204, cors=True)
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode('utf-8'), ('Bearer ' + self.server.code).encode('utf-8')):
            return self.reply(401, {'error': 'Connection code required'}, True)
        try:
            if self.command == 'GET' and self.path == '/v1/status':
                with self.server.engine.lock:
                    if self.server.engine.active:
                        return self.reply(409, {'error': 'A job is already running'}, True)
                run = subprocess.run([python_path(), str(WORKER), 'status'], cwd=ROOT,
                    capture_output=True, text=True, encoding='utf-8', timeout=20,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
                event = json.loads(run.stdout.strip().splitlines()[-1])
                if run.returncode or event.get('type') != 'result':
                    raise ValueError('Worker status unavailable')
                return self.reply(200, {k: v for k, v in event.items() if k != 'type'}, True)
            if self.command == 'GET' and self.path.startswith('/v1/jobs/'):
                with self.server.engine.lock:
                    job = self.server.engine.jobs.get(self.path[len('/v1/jobs/'):])
                    return self.reply(200 if job else 404, job or {'error': 'Unknown job'}, True)
            if self.command == 'POST' and self.path in ('/v1/jobs', '/v1/cancel'):
                if self.headers.get('Transfer-Encoding'):
                    raise ValueError('Transfer encoding unsupported')
                length = int(self.headers.get('Content-Length', '0'))
                if length > 16384:
                    return self.reply(413, {'error': 'Body exceeds 16 KB'}, True)
                if length < 0:
                    raise ValueError('Invalid length')
                body = json.loads(self.rfile.read(length) or b'{}')
                if self.path == '/v1/cancel':
                    return self.reply(200, {'canceled': self.server.engine.cancel()}, True)
                kind, args = validate_job(body)
                return self.reply(202, {'jobId': self.server.engine.start(kind, args)}, True)
            return self.reply(404, {'error': 'Unknown endpoint'}, True)
        except RuntimeError as exc:
            return self.reply(409, {'error': str(exc)}, True)
        except (ValueError, TypeError):
            return self.reply(400, {'error': 'Invalid request or worker response'}, True)
        except Exception:
            return self.reply(500, {'error': 'Local engine unavailable'}, True)

    do_GET = dispatch
    do_POST = dispatch
    do_OPTIONS = dispatch


def make_server(origin, port=8765, code=None):
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.origin = validate_origin(origin)
    server.code = code or secrets.token_urlsafe(32)
    server.engine = Engine()
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', required=True)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('Port must be 1-65535')
    server = make_server(args.origin, args.port)
    print(f'Previs local engine: http://127.0.0.1:{args.port}\nPaired origin: {server.origin}\nConnection code: {server.code}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.engine.cancel()
        server.server_close()


if __name__ == '__main__':
    main()
