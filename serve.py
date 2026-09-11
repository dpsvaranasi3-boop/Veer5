#!/usr/bin/env python3
"""VEER 5 dev server: static files with caching DISABLED.

Browsers and preview proxies must always fetch fresh files, so a refresh
can never mix old + new game code (a classic cause of 'stuck loader' bugs).

Usage:  python3 serve.py [port]   (default 8000, binds 0.0.0.0)
"""
import functools
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # never cache anything (also honored by caching proxies)
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        super().log_message(*args)


if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer(
        ("0.0.0.0", PORT), functools.partial(NoStoreHandler, directory=".")
    )
    print(f"VEER 5 server on http://0.0.0.0:{PORT}  (caching disabled)")
    srv.serve_forever()
