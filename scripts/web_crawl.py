"""
Simple breadth-first web crawler that collects page URLs and titles up to a given depth.
Saves results as JSON to the current directory.
Usage:
    python scripts/web_crawl.py https://example.com --depth 2 --output crawl_results.json
"""
import argparse
import json
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


def crawl(seed_url, max_depth=1, max_pages=100, delay=0.5):
    visited = set()
    queue = [(seed_url, 0)]
    results = []

    while queue and len(visited) < max_pages:
        url, depth = queue.pop(0)
        if url in visited:
            continue
        try:
            resp = requests.get(url, timeout=8)
            content_type = resp.headers.get('content-type', '')
            if 'text/html' not in content_type:
                visited.add(url)
                continue
            soup = BeautifulSoup(resp.text, 'html.parser')
            title_tag = soup.find('title')
            title = title_tag.get_text(strip=True) if title_tag else ''
            results.append({'url': url, 'title': title, 'status_code': resp.status_code})
            visited.add(url)

            if depth < max_depth:
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    joined = urljoin(url, href)
                    parsed = urlparse(joined)
                    # only same host
                    if parsed.netloc == urlparse(seed_url).netloc:
                        cleaned = parsed.scheme + '://' + parsed.netloc + parsed.path
                        if cleaned not in visited:
                            queue.append((cleaned, depth + 1))
        except Exception as e:
            results.append({'url': url, 'title': '', 'error': str(e)})
            visited.add(url)
        time.sleep(delay)
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('seed', help='Seed URL to start crawl from')
    parser.add_argument('--depth', type=int, default=1)
    parser.add_argument('--max-pages', type=int, default=200)
    parser.add_argument('--delay', type=float, default=0.5)
    parser.add_argument('--output', default='crawl_results.json')
    args = parser.parse_args()

    res = crawl(args.seed, max_depth=args.depth, max_pages=args.max_pages, delay=args.delay)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    print(f'Wrote {len(res)} pages to {args.output}')


if __name__ == '__main__':
    main()
