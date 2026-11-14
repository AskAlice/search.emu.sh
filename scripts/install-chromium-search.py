#!/usr/bin/env python3
"""Install emu search in a closed Chromium profile on macOS, Linux or Windows.

Usage (from the repository root, with Python 3 installed):
    python3 scripts/install-chromium-search.py  # interactive browser/profile picker
    python3 scripts/install-chromium-search.py --list
    python3 scripts/install-chromium-search.py --browser chrome --profile Default
    python3 scripts/install-chromium-search.py --browser brave-origin --profile 'Profile 1'
    python3 scripts/install-chromium-search.py --db '/absolute/profile/path/Web Data'
    python3 scripts/install-chromium-search.py --restore '/path/to/manifest.json'

Windows PowerShell: replace python3 with py -3, for example:
    py -3 scripts/install-chromium-search.py --browser brave --profile Default

Quit Chromium browsers and helpers first; keep them closed until completion.
Run as your normal desktop user. Linux/macOS require lsof. No extra Python
packages are needed. The installer refuses active processes or locked databases,
verifies a SQLite backup before editing, and prints the exact undo command.
Restore changes only the provider row, preserving unrelated browser data.
"""
import argparse
import contextlib
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import uuid

MAC_BROWSERS = {
    'chrome': 'Google/Chrome', 'chrome-beta': 'Google/Chrome Beta',
    'chrome-dev': 'Google/Chrome Dev', 'chrome-canary': 'Google/Chrome Canary',
    'chromium': 'Chromium', 'brave': 'BraveSoftware/Brave-Browser',
    'brave-beta': 'BraveSoftware/Brave-Browser-Beta',
    'brave-nightly': 'BraveSoftware/Brave-Browser-Nightly',
    'brave-origin': 'BraveSoftware/Brave-Origin',
    'brave-origin-beta': 'BraveSoftware/Brave-Origin-Beta',
    'edge': 'Microsoft Edge', 'edge-beta': 'Microsoft Edge Beta',
    'edge-dev': 'Microsoft Edge Dev', 'edge-canary': 'Microsoft Edge Canary',
    'vivaldi': 'Vivaldi', 'arc': 'Arc/User Data', 'opera': 'com.operasoftware.Opera',
}
LINUX_BROWSERS = {
    'chrome': 'google-chrome', 'chrome-beta': 'google-chrome-beta',
    'chrome-dev': 'google-chrome-unstable', 'chromium': 'chromium',
    'brave': 'BraveSoftware/Brave-Browser', 'brave-beta': 'BraveSoftware/Brave-Browser-Beta',
    'brave-nightly': 'BraveSoftware/Brave-Browser-Nightly', 'brave-origin': 'BraveSoftware/Brave-Origin',
    'brave-origin-beta': 'BraveSoftware/Brave-Origin-Beta',
    'edge': 'microsoft-edge', 'edge-beta': 'microsoft-edge-beta', 'edge-dev': 'microsoft-edge-dev',
    'vivaldi': 'vivaldi', 'opera': 'opera',
}
WINDOWS_BROWSERS = {
    'chrome': 'Google/Chrome/User Data', 'chrome-beta': 'Google/Chrome Beta/User Data',
    'chrome-dev': 'Google/Chrome Dev/User Data', 'chrome-canary': 'Google/Chrome SxS/User Data',
    'chromium': 'Chromium/User Data', 'brave': 'BraveSoftware/Brave-Browser/User Data',
    'brave-beta': 'BraveSoftware/Brave-Browser-Beta/User Data',
    'brave-nightly': 'BraveSoftware/Brave-Browser-Nightly/User Data',
    'brave-origin': 'BraveSoftware/Brave-Origin/User Data',
    'brave-origin-beta': 'BraveSoftware/Brave-Origin-Beta/User Data',
    'edge': 'Microsoft/Edge/User Data', 'edge-beta': 'Microsoft/Edge Beta/User Data',
    'edge-dev': 'Microsoft/Edge Dev/User Data', 'edge-canary': 'Microsoft/Edge SxS/User Data',
    'vivaldi': 'Vivaldi/User Data',
}
BROWSERS = {**MAC_BROWSERS, **LINUX_BROWSERS, **WINDOWS_BROWSERS}
EXECUTABLE = re.compile(r'(?:^|[\s/\\])(?:chrome|google-chrome|chromium(?:-browser)?|brave(?:-browser|-origin)?|msedge|microsoft-edge|vivaldi|opera|arc)(?:-(?:stable|beta|dev|unstable|nightly|canary))?(?:\.exe)?(?=$|[\s/\\])', re.I)


def profile_roots(platform=None, home=None, environ=None):
    platform, home, env = platform or sys.platform, home or Path.home(), os.environ if environ is None else environ
    if platform == 'darwin':
        return [(name, home / 'Library/Application Support' / path) for name, path in MAC_BROWSERS.items()]
    if platform == 'win32':
        local = Path(env.get('LOCALAPPDATA', str(home / 'AppData/Local')))
        roaming = Path(env.get('APPDATA', str(home / 'AppData/Roaming')))
        return [(name, local / path) for name, path in WINDOWS_BROWSERS.items()] + [('opera', roaming / 'Opera Software/Opera Stable')]
    if platform.startswith('linux'):
        config = Path(env.get('XDG_CONFIG_HOME', str(home / '.config')))
        if not config.is_absolute():
            raise ValueError('XDG_CONFIG_HOME must be an absolute path.')
        roots = [(name, config / path) for name, path in LINUX_BROWSERS.items()]
        roots += [('chromium', home / 'snap/chromium/common/chromium')]
        for app, browser, relative in [('com.google.Chrome', 'chrome', 'google-chrome'), ('org.chromium.Chromium', 'chromium', 'chromium'), ('com.brave.Browser', 'brave', 'BraveSoftware/Brave-Browser'), ('com.microsoft.Edge', 'edge', 'microsoft-edge')]:
            roots.append((browser, home / '.var/app' / app / 'config' / relative))
        return roots
    raise ValueError('Supported platforms are macOS, Linux, and Windows.')


def default_backup_root():
    if sys.platform == 'win32':
        return Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local'))) / 'emu-search/backups'
    if sys.platform == 'darwin':
        return Path.home() / 'Library/Application Support/emu-search/backups'
    return Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'emu-search/backups'


APP = re.compile(r'(?:Google Chrome|Chromium|Brave Browser|Brave Origin|Brave-Browser|Brave-Origin|Microsoft Edge|Vivaldi|Arc|Opera)(?:\.app| Helper| Beta| Canary| Dev| Nightly| Origin|/|$)', re.I)
BASE = 'https://search.emu.sh'
IDENTITY = ('id', 'short_name', 'keyword', 'url', 'suggest_url', 'sync_guid', 'originating_url', 'favicon_url')


def browser_processes(db, listing):
    """Include browser helpers, profile-specific crash handlers and descendants."""
    rows = []
    for line in listing.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit():
            rows.append((int(parts[0]), int(parts[1]), parts[2]))
    profile_root = str(db.parent.parent)
    found = {pid for pid, _, cmd in rows if pid != os.getpid() and (APP.search(cmd) or EXECUTABLE.search(cmd) or profile_root.casefold() in cmd.casefold())}
    while True:
        descendants = {pid for pid, ppid, _ in rows if ppid in found and pid != os.getpid()}
        expanded = found | descendants
        if expanded == found:
            return sorted(found)
        found = expanded


def process_listing():
    if sys.platform == 'win32':
        command = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); $ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine) | ConvertTo-Json -Compress"
        output = subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], check=True, capture_output=True, text=True, encoding='utf-8', timeout=30).stdout
        rows = json.loads(output.lstrip('\ufeff'))
        if not isinstance(rows, list) or not rows:
            raise RuntimeError('Could not enumerate Windows processes.')
        return '\n'.join(f"{int(row['ProcessId'])} {int(row['ParentProcessId'])} {row['Name']} {row.get('CommandLine') or ''}" for row in rows)
    return subprocess.run(['ps', '-axo', 'pid=,ppid=,command='], check=True, capture_output=True, text=True, timeout=15).stdout


def windows_file_holders(files):
    """Ask Restart Manager who has these files open; never shut down a process."""
    import ctypes as c
    from ctypes import wintypes as w

    class UniqueProcess(c.Structure):
        _fields_ = [('pid', w.DWORD), ('start', w.FILETIME)]

    class ProcessInfo(c.Structure):
        _fields_ = [('process', UniqueProcess), ('name', w.WCHAR * 256), ('service', w.WCHAR * 64),
                    ('kind', c.c_int), ('status', w.ULONG), ('session', w.DWORD), ('restartable', w.BOOL)]

    api = c.WinDLL('Rstrtmgr')
    api.RmStartSession.argtypes = [c.POINTER(w.DWORD), w.DWORD, w.LPWSTR]
    api.RmRegisterResources.argtypes = [w.DWORD, w.UINT, c.POINTER(w.LPCWSTR), w.UINT, c.POINTER(UniqueProcess), w.UINT, c.POINTER(w.LPCWSTR)]
    api.RmGetList.argtypes = [w.DWORD, c.POINTER(w.UINT), c.POINTER(w.UINT), c.POINTER(ProcessInfo), c.POINTER(w.DWORD)]
    api.RmEndSession.argtypes = [w.DWORD]
    for name in ('RmStartSession', 'RmRegisterResources', 'RmGetList', 'RmEndSession'):
        getattr(api, name).restype = w.DWORD
    handle, key = w.DWORD(), c.create_unicode_buffer(33)
    def checked(status):
        if status:
            raise RuntimeError(f'Windows file-holder check failed (Restart Manager error {status}).')
    checked(api.RmStartSession(c.byref(handle), 0, key))
    try:
        names = (w.LPCWSTR * len(files))(*map(str, files))
        checked(api.RmRegisterResources(handle, len(files), names, 0, None, 0, None))
        # The list can grow between calls. Retry a bounded number of times, then fail closed.
        count, needed, reason = w.UINT(), w.UINT(), w.DWORD()
        entries = None
        for _ in range(5):
            status = api.RmGetList(handle, c.byref(needed), c.byref(count), entries, c.byref(reason))
            if status == 0:
                return [entries[i].process.pid for i in range(count.value)]
            if status != 234:  # ERROR_MORE_DATA
                checked(status)
            count = w.UINT(needed.value)
            entries = (ProcessInfo * needed.value)()
        raise RuntimeError('Windows file holders kept changing; keep browsers closed and retry.')
    finally:
        checked(api.RmEndSession(handle))


def file_holders(db):
    files = [p for p in [db, Path(str(db) + '-wal'), Path(str(db) + '-shm'), Path(str(db) + '-journal')] if p.exists()]
    if sys.platform == 'win32':
        return windows_file_holders(files)
    lsof = shutil.which('lsof')
    if not lsof:
        raise RuntimeError('Install lsof before running the installer (for example, apt install lsof or dnf install lsof).')
    result = subprocess.run([lsof, '-t', '--', *map(str, files)], capture_output=True, text=True, timeout=15)
    if result.returncode not in (0, 1) or result.stderr.strip():
        raise RuntimeError('Could not establish that the database is unused (lsof failed).')
    return [int(pid) for pid in result.stdout.split()]


def assert_browser_closed(db):
    pids = browser_processes(db, process_listing())
    if pids:
        raise RuntimeError('Quit Chromium browsers and their helpers first (PIDs: ' + ', '.join(map(str, pids)) + '). No process was killed.')
    holders = [pid for pid in file_holders(db) if pid != os.getpid()]
    if holders:
        raise RuntimeError('Database is open in another process: ' + ', '.join(map(str, holders)))


def open_db(db, readonly=False):
    connection = sqlite3.connect(db.as_uri() + ('?mode=ro' if readonly else '?mode=rw'), uri=True, timeout=0)
    connection.row_factory = sqlite3.Row
    return connection


def fingerprint(row):
    return None if row is None else {key: row[key] for key in IDENTITY if key in row}


def integrity(connection):
    if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        raise RuntimeError('SQLite integrity check failed.')


@contextlib.contextmanager
def locked(db):
    assert_browser_closed(db)
    connection = open_db(db)
    try:
        # First prove there are no competing readers/writers, then reserve the writer.
        # IMMEDIATE permits a separate read-only connection to make a consistent backup.
        connection.execute('BEGIN EXCLUSIVE')
        connection.rollback()
        connection.execute('BEGIN IMMEDIATE')
        assert_browser_closed(db)
        integrity(connection)
        yield connection
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def backup(db, directory):
    directory.mkdir(parents=True, exist_ok=False, mode=0o700)
    path = directory / 'Web Data.sqlite'
    # SQLite's backup API includes committed WAL content; copying Web Data alone does not.
    def progress(status, remaining, total):
        if status in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
            raise RuntimeError('Database became busy during backup.')
    with contextlib.closing(open_db(db, True)) as source, contextlib.closing(sqlite3.connect(path)) as target:
        source.backup(target, pages=256, progress=progress, sleep=0)
        integrity(target)
    os.chmod(path, 0o600)
    return path


def write_manifest(directory, db, snapshot, row_id, expected):
    data = {'version': 1, 'database': str(db), 'backup': snapshot.name,
            'sha256': hashlib.sha256(snapshot.read_bytes()).hexdigest(),
            'row_id': row_id, 'expected': fingerprint(expected)}
    path = directory / 'manifest.json'
    with path.open('x') as stream:
        os.chmod(path, 0o600)
        json.dump(data, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    return path


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def row_at(connection, row_id):
    row = connection.execute('SELECT * FROM keywords WHERE id=?', (row_id,)).fetchone()
    return dict(row) if row else None


def install(db, keyword, backup_root):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,32}', keyword):
        raise ValueError('Keyword must contain 1–32 letters, numbers, underscores or hyphens.')
    directory = backup_root / str(uuid.uuid4())
    with locked(db) as connection:
        columns = {row['name']: row for row in connection.execute('PRAGMA table_info(keywords)')}
        if not {'id', 'short_name', 'keyword', 'url', 'suggest_url'} <= columns.keys():
            raise RuntimeError('Unsupported Web Data keywords schema.')
        matches = connection.execute('SELECT * FROM keywords WHERE keyword=?', (keyword,)).fetchall()
        if len(matches) > 1:
            raise RuntimeError('Multiple search engines use this keyword; resolve this in browser settings first.')
        existing = dict(matches[0]) if matches else None
        if existing and not any(str(existing['url']).startswith(host + '/search?') for host in [BASE, 'https://search-emu-sh.vercel.app']):
            raise RuntimeError('Keyword is already used by another search engine. Choose a different --keyword.')
        now = int((datetime.datetime.now(datetime.timezone.utc).timestamp() + 11644473600) * 1000000)
        values = {'short_name': 'emu search', 'keyword': keyword, 'favicon_url': BASE + '/favicon.svg',
                  'url': BASE + '/search?q={searchTerms}', 'suggest_url': BASE + '/suggest?client=chrome-omni&q={searchTerms}',
                  'originating_url': BASE + '/osd.xml', 'safe_for_autoreplace': 0, 'input_encodings': 'UTF-8',
                  'prepopulate_id': 0, 'created_by_policy': 0, 'is_active': 1, 'last_modified': now}
        values = {key: value for key, value in values.items() if key in columns}
        row_id = existing['id'] if existing else connection.execute('SELECT COALESCE(MAX(id),0)+1 FROM keywords').fetchone()[0]
        if not existing:
            values.update({key: value for key, value in {'id': row_id, 'date_created': now, 'usage_count': 0, 'sync_guid': str(uuid.uuid4()), 'alternate_urls': '[]', 'image_url': '', 'search_url_post_params': '', 'suggest_url_post_params': '', 'image_url_post_params': '', 'new_tab_url': '', 'last_visited': 0, 'created_from_play_api': 0}.items() if key in columns})
            missing = [key for key, spec in columns.items() if spec['notnull'] and spec['dflt_value'] is None and key not in values]
            if missing:
                raise RuntimeError('Unsupported required columns: ' + ', '.join(missing))
        snapshot = backup(db, directory)
        assert_browser_closed(db)
        if existing:
            connection.execute('UPDATE keywords SET ' + ','.join(quote(key) + '=?' for key in values) + ' WHERE id=?', [*values.values(), row_id])
        else:
            connection.execute('INSERT INTO keywords (' + ','.join(map(quote, values)) + ') VALUES (' + ','.join('?' for _ in values) + ')', list(values.values()))
        expected = row_at(connection, row_id)
        if any(expected[key] != value for key, value in values.items()):
            raise RuntimeError('Provider verification failed; rolling back.')
        integrity(connection)
        manifest = write_manifest(directory, db, snapshot, row_id, expected)
        assert_browser_closed(db)
        connection.commit()
    return manifest


def restore(manifest, backup_root):
    data = json.loads(manifest.read_text())
    if data.get('version') != 1:
        raise ValueError('Unsupported backup manifest.')
    db = Path(data['database']).resolve(strict=True)
    snapshot = manifest.parent / data['backup']
    if snapshot.resolve().parent != manifest.parent.resolve() or hashlib.sha256(snapshot.read_bytes()).hexdigest() != data['sha256']:
        raise RuntimeError('Backup path or checksum verification failed.')
    with contextlib.closing(open_db(snapshot.resolve(), True)) as source:
        integrity(source)
        original = row_at(source, data['row_id'])
    directory = backup_root / str(uuid.uuid4())
    with locked(db) as connection:
        current = row_at(connection, data['row_id'])
        if fingerprint(current) == fingerprint(original):
            return None  # A failed installation may already have rolled back.
        if fingerprint(current) != data['expected']:
            raise RuntimeError('Provider has changed since this operation. Refusing to overwrite newer settings.')
        undo_snapshot = backup(db, directory)
        assert_browser_closed(db)
        if original is None:
            connection.execute('DELETE FROM keywords WHERE id=?', (data['row_id'],))
        else:
            columns = {row['name'] for row in connection.execute('PRAGMA table_info(keywords)')}
            original = {key: value for key, value in original.items() if key in columns}
            if current is None:
                connection.execute('INSERT INTO keywords (' + ','.join(map(quote, original)) + ') VALUES (' + ','.join('?' for _ in original) + ')', list(original.values()))
            else:
                connection.execute('UPDATE keywords SET ' + ','.join(quote(key) + '=?' for key in original) + ' WHERE id=?', [*original.values(), data['row_id']])
        restored = row_at(connection, data['row_id'])
        if (original is None and restored is not None) or (original is not None and any(restored is None or restored[key] != value for key, value in original.items())):
            raise RuntimeError('Restore verification failed; rolling back.')
        integrity(connection)
        undo = write_manifest(directory, db, undo_snapshot, data['row_id'], row_at(connection, data['row_id']))
        assert_browser_closed(db)
        connection.commit()
    return undo


def discover(roots=None):
    seen = set()
    for browser, root in profile_roots() if roots is None else roots:
        if root.is_dir():
            # Opera can keep Web Data directly in its user-data directory.
            candidates = [root, *sorted(p for p in root.iterdir() if p.is_dir())]
            for profile in candidates:
                db = profile / 'Web Data'
                if db.is_file() and db.resolve() not in seen:
                    seen.add(db.resolve())
                    yield browser, '.' if profile == root else profile.name, db


def select_db(browser, profile):
    if profile not in ('.',) and (Path(profile).name != profile or profile in ('', '..') or '/' in profile or '\\' in profile):
        raise ValueError('--profile must be a single profile folder name, or . for a direct Opera profile.')
    roots = [root for name, root in profile_roots() if name == browser]
    candidates = [root / profile / 'Web Data' for root in roots if (root / profile / 'Web Data').is_file()]
    if len(candidates) != 1:
        raise ValueError('Profile missing or ambiguous; use --list and --db with the exact Web Data path.')
    return candidates[0].resolve(strict=True)


def read_menu_key():
    """Read one key while restoring terminal mode even if interrupted."""
    if sys.platform == 'win32':
        import msvcrt
        key = msvcrt.getwch()
        if key in ('\x00', '\xe0'):
            return {'H': 'up', 'P': 'down', 'G': 'home', 'O': 'end'}.get(msvcrt.getwch(), '')
        return key
    import select
    import termios
    import tty
    fd = sys.stdin.fileno()
    previous = termios.tcgetattr(fd)
    try:
        tty.setraw(fd, termios.TCSANOW)
        key = os.read(fd, 1).decode('utf-8', errors='ignore')
        if key == '\x1b':
            sequence = b''
            while len(sequence) < 8 and select.select([fd], [], [], 0.05)[0]:
                sequence += os.read(fd, 1)
                if sequence[-1:] in (b'A', b'B', b'H', b'F', b'~'):
                    break
            return {b'[A': 'up', b'OB': 'down', b'[B': 'down', b'OA': 'up', b'[H': 'home', b'[F': 'end'}.get(sequence, '\x1b')
        return key
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, previous)


@contextlib.contextmanager
def menu_terminal():
    """Enable ANSI on Windows, or use a numbered menu on limited terminals."""
    restore_mode = None
    if sys.platform == 'win32':
        import ctypes
        from ctypes import wintypes
        api = ctypes.WinDLL('kernel32', use_last_error=True)
        api.GetStdHandle.argtypes = [wintypes.DWORD]
        api.GetStdHandle.restype = wintypes.HANDLE
        api.GetConsoleMode.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        api.SetConsoleMode.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        handle, mode = api.GetStdHandle(-11 & 0xffffffff), wintypes.DWORD()
        enabled = bool(api.GetConsoleMode(handle, ctypes.byref(mode)) and api.SetConsoleMode(handle, mode.value | 4))
        if enabled:
            restore_mode = lambda: api.SetConsoleMode(handle, mode.value)
    else:
        enabled = os.environ.get('TERM', '') not in ('', 'dumb')
    try:
        if enabled:
            sys.stdout.write('\x1b[?1049h\x1b[?25l');sys.stdout.flush()
        yield enabled
    finally:
        if enabled:
            sys.stdout.write('\x1b[?25h\x1b[?1049l');sys.stdout.flush()
        if restore_mode:
            restore_mode()


def menu_choice(title, options):
    """Choose one item; Escape/q cancels. Small terminals get a numbered menu."""
    with menu_terminal() as ansi:
        if not ansi:
            print('\n' + title)
            for index, option in enumerate(options, 1):
                print(f'  {index}. {option}')
            while True:
                try:
                    answer = input('Choose a number (q to cancel): ').strip()
                except EOFError:
                    return None
                if answer.lower() in ('q', 'quit'):
                    return None
                if answer.isdecimal() and 1 <= int(answer) <= len(options):
                    return int(answer) - 1
                print('Enter one of the listed numbers, or q.')
        selected = 0
        while True:
            size = shutil.get_terminal_size((80, 24))
            width, count = max(10, size.columns - 1), max(1, size.lines - 8)
            start = max(0, min(selected - count // 2, len(options) - count))
            lines = ['EMU SEARCH / Browser installer', '', title, '']
            for index in range(start, min(len(options), start + count)):
                label = f'{">" if selected == index else " "} {index + 1}. {options[index]}'
                # Keep labels on one line so menus remain usable in narrow terminals.
                lines.append(label[:width])
            lines += ['', 'Up/Down or j/k to move / Enter to select / q or Esc to cancel']
            sys.stdout.write('\x1b[H\x1b[2J' + '\n'.join(line[:width] for line in lines));sys.stdout.flush()
            key = read_menu_key()
            if key in ('\x03',):
                raise KeyboardInterrupt
            if key in ('q', 'Q', '\x1b', '\x04'):
                return None
            if key in ('\r', '\n'):
                return selected
            if key in ('up', 'k'):
                selected = (selected - 1) % len(options)
            elif key in ('down', 'j'):
                selected = (selected + 1) % len(options)
            elif key == 'home':
                selected = 0
            elif key == 'end':
                selected = len(options) - 1


def interactive_db():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise RuntimeError('Interactive selection needs a terminal. Use --list, then --browser/--profile or --db for noninteractive use.')
    profiles = list(discover())
    if not profiles:
        raise RuntimeError('No Chromium profiles with a Web Data database were found. Start the browser once, quit it, then retry; use --db for a custom profile.')
    browsers = sorted({browser for browser, _, _ in profiles})
    selection = menu_choice('1 / Select browser', browsers)
    if selection is None:
        return None
    browser = browsers[selection]
    available = [(profile, db) for name, profile, db in profiles if name == browser]
    selection = menu_choice(f'2 / Select {browser} profile', [f'{profile}  |  {db.parent}' for profile, db in available])
    if selection is None:
        return None
    profile, db = available[selection]
    print(f'Selected {browser} / {profile}\nDatabase: {db}')
    print('Checking that browsers are closed and preparing a verified backup...')
    return db.resolve(strict=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--list', action='store_true', help='List detected browser profiles without modifying them')
    parser.add_argument('--browser', choices=sorted(BROWSERS))
    parser.add_argument('--profile', default='Default')
    parser.add_argument('--db', type=Path, help='Explicit Web Data path for another Chromium-based browser')
    parser.add_argument('--keyword', default='emu')
    parser.add_argument('--restore', type=Path, metavar='MANIFEST', help='Undo an install or restore, without reverting unrelated database rows')
    parser.add_argument('--backup-dir', type=Path, default=default_backup_root())
    args = parser.parse_args()
    if sys.platform not in ('darwin', 'win32') and not sys.platform.startswith('linux'):
        parser.error('Supported platforms are macOS, Linux, and Windows.')
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        parser.error('Run as your normal desktop user, not with sudo.')
    os.umask(0o077)
    if args.list:
        for browser, profile, db in discover():
            print(f'{browser}\t{profile}\t{db}')
        return
    if args.restore:
        manifest = restore(args.restore.expanduser().resolve(strict=True), args.backup_dir.expanduser())
        print('Restore completed.' if manifest else 'Already reverted; no changes needed.')
    else:
        if len(sys.argv) == 1:
            db = interactive_db()
            if db is None:
                print('Cancelled; no database changes made.')
                return
        else:
            if not args.db and not args.browser:
                parser.error('Choose --browser or --db; use no arguments for the interactive picker.')
            db = args.db.expanduser().resolve(strict=True) if args.db else select_db(args.browser, args.profile)
        manifest = install(db, args.keyword, args.backup_dir.expanduser())
        print('Provider installed. Open browser search-engine settings to select emu; the default engine was not changed.')
    if manifest:
        print(f'Verified backup and restore manifest: {manifest}')
        launcher = 'py -3' if sys.platform == 'win32' else 'python3'
        print(f'To undo: {launcher} "{Path(__file__).resolve()}" --restore "{manifest}"')


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled; uncommitted database changes were rolled back.', file=sys.stderr)
        sys.exit(130)
    except (RuntimeError, ValueError, OSError, sqlite3.Error, subprocess.SubprocessError) as error:
        print(f'Aborted: {error}. Uncommitted database changes were rolled back.', file=sys.stderr)
        sys.exit(1)
