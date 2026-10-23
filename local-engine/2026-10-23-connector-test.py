"""Real loopback transport tests; never installs dependencies or models."""
import importlib.util
import http.client
import json
from pathlib import Path
import threading
import time
import unittest

spec = importlib.util.spec_from_file_location('connector', Path(__file__).with_name('2026-10-23-connector.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.server = c.make_server('http://localhost:5173', port=0, code='test-code')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.engine.cancel()
        self.server.shutdown()
        self.server.server_close()

    def request(self, method, path, body=None, **headers):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        defaults = {'Origin': 'http://localhost:5173', 'Authorization': 'Bearer test-code'}
        defaults.update(headers)
        conn.request(method, path, body, defaults)
        response = conn.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        conn.close()
        return result

    def test_origin_host_auth(self):
        self.assertEqual(self.request('GET', '/v1/status', Authorization='Bearer wrong')[0], 401)
        self.assertEqual(self.request('GET', '/v1/status', Origin='https://evil.test')[0], 403)
        self.assertEqual(self.request('GET', '/v1/status', Host='evil.test')[0], 403)
        status, headers, _ = self.request('OPTIONS', '/v1/jobs', Authorization='')
        self.assertEqual(status, 204)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
        self.assertEqual(self.request('GET', '/v1/status', Authorization='')[0], 401)
        status, _, body = self.request('GET', '/v1/status')
        self.assertEqual(status, 200)
        self.assertIn('runtimeReady', json.loads(body))

    def test_invalid_requests(self):
        for value in ['{', '{"kind":"bad","args":{}}', '{"kind":"generate","args":{"prompt":""}}']:
            self.assertEqual(self.request('POST', '/v1/jobs', value)[0], 400)
        self.assertEqual(self.request('POST', '/v1/jobs', 'x' * 16385)[0], 413)
        for args in [{'prompt': 'walk', 'duration': True}, {'prompt': 'walk', 'duration': 61},
                     {'prompt': 'walk', 'seed': -1}, {'prompt': 'walk', 'output': '../bad'}]:
            self.assertEqual(self.request('POST', '/v1/jobs', json.dumps({'kind': 'generate', 'args': args}))[0], 400)

    def test_worker_result_and_token_redaction(self):
        import sys
        engine = self.server.engine
        source = 'import json; print(json.dumps({"type":"progress","stage":"test","message":"secret-token"})); print(json.dumps({"type":"result","ok":True}))'
        engine.command = lambda kind, args, job_id: ([sys.executable, '-c', source], None)
        payload = json.dumps({'kind': 'installModel', 'args': {'token': 'secret-token'}})
        _, _, body = self.request('POST', '/v1/jobs', payload)
        job_id = json.loads(body)['jobId']
        for _ in range(100):
            _, _, body = self.request('GET', '/v1/jobs/' + job_id)
            job = json.loads(body)
            if job['state'] != 'running':
                break
            time.sleep(.02)
        self.assertEqual(job['state'], 'completed')
        self.assertTrue(job['result']['ok'])
        self.assertNotIn('secret-token', body.decode())

    def test_owned_child_busy_cancel(self):
        import sys
        engine = self.server.engine
        engine.command = lambda kind, args, job_id: ([sys.executable, '-c', 'import time; time.sleep(30)'], None)
        payload = json.dumps({'kind': 'setup', 'args': {}})
        status, _, body = self.request('POST', '/v1/jobs', payload)
        self.assertEqual(status, 202)
        job_id = json.loads(body)['jobId']
        self.assertEqual(self.request('POST', '/v1/jobs', payload)[0], 409)
        self.assertEqual(self.request('POST', '/v1/cancel', '{}')[0], 200)
        status, _, body = self.request('GET', '/v1/jobs/' + job_id)
        self.assertEqual(json.loads(body)['state'], 'canceled')


if __name__ == '__main__':
    unittest.main()
