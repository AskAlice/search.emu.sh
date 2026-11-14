from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('installer', Path(__file__).resolve().parents[2] / 'scripts/install-chromium-search.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db = self.root / 'BraveSoftware/Brave-Origin/Default/Web Data'
        self.db.parent.mkdir(parents=True)
        self.backups = self.root / 'backups'
        with closing(sqlite3.connect(self.db)) as conn, conn:
            conn.execute('CREATE TABLE keywords (id INTEGER PRIMARY KEY, short_name TEXT NOT NULL, keyword TEXT NOT NULL, url TEXT NOT NULL, suggest_url TEXT, sync_guid TEXT, favicon_url TEXT, originating_url TEXT, usage_count INTEGER DEFAULT 0, last_modified INTEGER DEFAULT 0, is_active INTEGER DEFAULT 0)')
            conn.execute("INSERT INTO keywords(id,short_name,keyword,url,suggest_url,sync_guid) VALUES(1,'Google','google','https://google.com/search?q={searchTerms}','','google-guid')")
            conn.execute('CREATE TABLE other_data (value TEXT)')
            conn.execute("INSERT INTO other_data VALUES('keep')")
        self.guard = patch.object(installer, 'assert_browser_closed', return_value=None)
        self.guard.start()

    def tearDown(self):
        self.guard.stop()
        self.temp.cleanup()

    def rows(self):
        with closing(sqlite3.connect(self.db)) as conn, conn:
            return conn.execute('SELECT id,keyword,url FROM keywords ORDER BY id').fetchall()

    def test_install_backup_restore_and_undo_restore(self):
        before = self.rows()
        manifest = installer.install(self.db, 'emu', self.backups)
        data = json.loads(manifest.read_text())
        snapshot = manifest.parent / data['backup']
        with closing(sqlite3.connect(snapshot)) as conn, conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM keywords').fetchone()[0],1)
        self.assertEqual(snapshot.stat().st_mode & 0o777, 0o600)
        self.assertEqual(manifest.stat().st_mode & 0o777, 0o600)
        with closing(sqlite3.connect(self.db)) as conn, conn:
            self.assertEqual(conn.execute("SELECT is_active FROM keywords WHERE keyword='emu'").fetchone()[0],1)
            conn.execute("INSERT INTO other_data VALUES('new data')")
            conn.execute("UPDATE keywords SET usage_count=10 WHERE keyword='emu'")
        undo = installer.restore(manifest, self.backups)
        self.assertEqual(self.rows(),before)
        with closing(sqlite3.connect(self.db)) as conn, conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM other_data').fetchone()[0],2)
        installer.restore(undo,self.backups)
        self.assertEqual(len(self.rows()),2,'undo restore recovers the removed provider')

    def test_idempotent_install_and_existing_provider_restore(self):
        first = installer.install(self.db,'emu',self.backups)
        original = self.rows()
        second = installer.install(self.db,'emu',self.backups)
        self.assertEqual(self.rows(),original)
        installer.restore(second,self.backups)
        self.assertEqual(self.rows(),original)
        installer.restore(first,self.backups)
        self.assertEqual(len(self.rows()),1)

    def test_locked_database_produces_no_backup_or_edits(self):
        conn = sqlite3.connect(self.db)
        try:
            conn.execute('BEGIN EXCLUSIVE')
            with self.assertRaises(sqlite3.OperationalError):installer.install(self.db,'emu',self.backups)
            self.assertFalse(self.backups.exists())
        finally:conn.rollback();conn.close()
        self.assertEqual(len(self.rows()),1)

    def test_running_browser_produces_no_backup_or_edits(self):
        with patch.object(installer, 'assert_browser_closed', side_effect=RuntimeError('browser running')):
            with self.assertRaisesRegex(RuntimeError, 'browser running'):
                installer.install(self.db, 'emu', self.backups)
        self.assertFalse(self.backups.exists())
        self.assertEqual(len(self.rows()), 1)

    def test_unknown_required_schema_aborts(self):
        with closing(sqlite3.connect(self.db)) as conn, conn:
            conn.execute("ALTER TABLE keywords ADD COLUMN future_required TEXT NOT NULL DEFAULT ''")
            # A schema without a default must fail before taking a backup or editing.
            conn.execute('CREATE TABLE newer (id INTEGER PRIMARY KEY, short_name TEXT NOT NULL, keyword TEXT NOT NULL, url TEXT NOT NULL, suggest_url TEXT, future_required TEXT NOT NULL)')
            conn.execute('DROP TABLE keywords')
            conn.execute('ALTER TABLE newer RENAME TO keywords')
        with self.assertRaisesRegex(RuntimeError, 'Unsupported required columns'):
            installer.install(self.db, 'emu', self.backups)
        self.assertFalse(self.backups.exists())

    def test_browser_reappearing_aborts_before_edit(self):
        with patch.object(installer,'assert_browser_closed',side_effect=[None,None,RuntimeError('browser restarted')]):
            with self.assertRaisesRegex(RuntimeError,'browser restarted'):installer.install(self.db,'emu',self.backups)
        self.assertEqual(len(self.rows()),1)
        self.assertEqual(len(list(self.backups.glob('*/Web Data.sqlite'))),1)

    def test_sql_failure_rolls_back(self):
        with closing(sqlite3.connect(self.db)) as conn, conn:
            conn.execute("CREATE TRIGGER deny_install BEFORE INSERT ON keywords BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
        with self.assertRaises(sqlite3.IntegrityError):installer.install(self.db,'emu',self.backups)
        self.assertEqual(len(self.rows()),1)

    def test_collision_and_changed_provider_are_not_overwritten(self):
        with self.assertRaisesRegex(RuntimeError,'already used'):installer.install(self.db,'google',self.backups)
        self.assertFalse(self.backups.exists())
        manifest=installer.install(self.db,'emu',self.backups)
        with closing(sqlite3.connect(self.db)) as conn, conn:conn.execute("UPDATE keywords SET url='https://new.example/' WHERE keyword='emu'")
        with self.assertRaisesRegex(RuntimeError,'changed since'):installer.restore(manifest,self.backups)
        self.assertEqual(self.rows()[-1][-1],'https://new.example/')

    def test_tampered_backup_is_rejected(self):
        manifest=installer.install(self.db,'emu',self.backups)
        with (manifest.parent/'Web Data.sqlite').open('ab') as stream:stream.write(b'tampered')
        with self.assertRaisesRegex(RuntimeError,'checksum'):installer.restore(manifest,self.backups)
        self.assertEqual(len(self.rows()),2)

    def test_wal_content_is_in_backup(self):
        conn=sqlite3.connect(self.db)
        try:
            conn.execute('PRAGMA journal_mode=WAL');conn.execute('PRAGMA wal_autocheckpoint=0')
            conn.execute("INSERT INTO other_data VALUES('WAL content')");conn.commit()
            manifest=installer.install(self.db,'emu',self.backups)
            with closing(sqlite3.connect(manifest.parent/'Web Data.sqlite')) as backup:
                self.assertEqual(backup.execute('SELECT COUNT(*) FROM other_data').fetchone()[0],2)
        finally:conn.close()

    def test_process_detection_includes_origin_helpers_crashpad_and_children(self):
        listing=f'''100 1 /Applications/Brave Origin.app/Contents/MacOS/Brave Origin
101 100 /Applications/Brave Origin.app/Contents/Frameworks/Brave Origin Helper.app/Contents/MacOS/Brave Origin Helper
102 101 utility_process
103 1 brave_crashpad_handler --database={self.db.parent.parent}/Crashpad
200 1 /Applications/Slack.app/Contents/MacOS/Slack
'''
        self.assertEqual(installer.browser_processes(self.db,listing),[100,101,102,103])
        profiles=list(installer.discover([(name, self.root / relative) for name, relative in installer.MAC_BROWSERS.items()]))
        self.assertEqual(profiles[0][0:2],('brave-origin','Default'))

class PlatformTests(unittest.TestCase):
    def test_linux_xdg_snap_and_flatpak_paths(self):
        roots = installer.profile_roots('linux', Path('/home/test'), {'XDG_CONFIG_HOME': '/custom/config'})
        self.assertIn(('chrome', Path('/custom/config/google-chrome')), roots)
        self.assertIn(('brave-origin', Path('/custom/config/BraveSoftware/Brave-Origin')), roots)
        self.assertIn(('chromium', Path('/home/test/snap/chromium/common/chromium')), roots)
        self.assertIn(('brave', Path('/home/test/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser')), roots)
        with self.assertRaises(ValueError):installer.profile_roots('linux', Path('/home/test'), {'XDG_CONFIG_HOME': 'relative'})

    def test_windows_roots_and_opera_roaming(self):
        roots = installer.profile_roots('win32', Path('/users/test'), {'LOCALAPPDATA': '/local', 'APPDATA': '/roaming'})
        self.assertIn(('chrome', Path('/local/Google/Chrome/User Data')), roots)
        self.assertIn(('brave-origin', Path('/local/BraveSoftware/Brave-Origin/User Data')), roots)
        self.assertIn(('opera', Path('/roaming/Opera Software/Opera Stable')), roots)

    def test_executable_names_helpers_and_descendants(self):
        db = Path('/profiles/Default/Web Data')
        listing = '''501 1 chrome.exe --type=utility
502 501 crashpad_handler.exe
503 1 /opt/brave.com/brave-origin/brave --type=renderer
504 1 /usr/bin/chromium-browser
505 1 /opt/microsoft/msedge/msedge
506 1 unrelated_app
'''
        self.assertEqual(installer.browser_processes(db, listing), [501,502,503,504,505])

    def test_windows_process_name_survives_missing_command_line(self):
        from types import SimpleNamespace
        payload = json.dumps([{'ProcessId': 501, 'ParentProcessId': 1, 'Name':'brave.exe', 'CommandLine': None}])
        with patch.object(installer.sys, 'platform', 'win32'), patch.object(installer.subprocess, 'run', return_value=SimpleNamespace(stdout=payload)):
            listing = installer.process_listing()
        self.assertEqual(installer.browser_processes(Path('/profiles/Default/Web Data'), listing), [501])

    def test_guard_refuses_process_and_file_holders(self):
        db = Path('/profiles/Default/Web Data')
        with patch.object(installer, 'process_listing', return_value='501 1 brave.exe'), patch.object(installer, 'file_holders') as holders:
            with self.assertRaisesRegex(RuntimeError, '501'):installer.assert_browser_closed(db)
            holders.assert_not_called()
        with patch.object(installer, 'process_listing', return_value=''), patch.object(installer, 'file_holders', return_value=[os.getpid(), 502]):
            with self.assertRaisesRegex(RuntimeError, '502'):installer.assert_browser_closed(db)
        with patch.object(installer, 'process_listing', return_value=''), patch.object(installer, 'file_holders', return_value=[os.getpid()]):
            installer.assert_browser_closed(db)

    def test_native_holder_dispatch_and_fail_closed(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / 'Web Data'; db.touch()
            with patch.object(installer.sys, 'platform', 'win32'), patch.object(installer, 'windows_file_holders', return_value=[501]) as native:
                self.assertEqual(installer.file_holders(db), [501]);native.assert_called_once_with([db])
            with patch.object(installer.sys, 'platform', 'linux'), patch.object(installer.shutil, 'which', return_value=None):
                with self.assertRaisesRegex(RuntimeError, 'Install lsof'):installer.file_holders(db)
            with patch.object(installer.sys, 'platform', 'linux'), patch.object(installer.shutil, 'which', return_value='/usr/bin/lsof'), patch.object(installer.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stderr='denied', stdout='')):
                with self.assertRaisesRegex(RuntimeError, 'lsof failed'):installer.file_holders(db)

    def test_opera_direct_profile_and_ambiguous_install(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root/'Web Data').touch()
            self.assertEqual(list(installer.discover([('opera',root)]))[0][:2], ('opera','.'))
            with patch.object(installer, 'profile_roots', return_value=[('opera',root)]):
                self.assertEqual(installer.select_db('opera','.'),root/'Web Data')
                with self.assertRaises(ValueError):installer.select_db('opera','..')
            second=root/'other'; second.mkdir(); (second/'Web Data').touch()
            with patch.object(installer, 'profile_roots', return_value=[('opera',root),('opera',second)]):
                with self.assertRaisesRegex(ValueError,'ambiguous'):installer.select_db('opera','.')

class InteractiveTests(unittest.TestCase):
    def test_browser_and_profile_selection_uses_exact_discovered_path(self):
        with tempfile.TemporaryDirectory() as directory:
            db1 = Path(directory)/'normal/Default/Web Data'
            db2 = Path(directory)/'flatpak/Default/Web Data'
            for db in (db1,db2):db.parent.mkdir(parents=True);db.touch()
            profiles = [('chrome','Default',db1), ('brave','Default',db1), ('brave','Default',db2)]
            with patch.object(installer.sys.stdin,'isatty',return_value=True), patch.object(installer.sys.stdout,'isatty',return_value=True), patch.object(installer,'discover',return_value=iter(profiles)), patch.object(installer,'menu_choice',side_effect=[0,1]) as menu, patch('builtins.print'):
                self.assertEqual(installer.interactive_db(), db2)
                self.assertEqual(menu.call_args_list[0].args[1], ['brave','chrome'])
                self.assertIn(str(db2.parent),menu.call_args_list[1].args[1][1])

    def test_cancel_at_either_stage(self):
        profiles = [('brave','Default',Path('/unused/Default/Web Data'))]
        for choices in ([None], [0,None]):
            with self.subTest(choices=choices), patch.object(installer.sys.stdin,'isatty',return_value=True), patch.object(installer.sys.stdout,'isatty',return_value=True), patch.object(installer,'discover',return_value=iter(profiles)), patch.object(installer,'menu_choice',side_effect=choices):
                self.assertIsNone(installer.interactive_db())

    def test_missing_terminal_or_profiles_exits_without_prompt(self):
        with patch.object(installer.sys.stdin,'isatty',return_value=False), patch.object(installer,'menu_choice') as menu:
            with self.assertRaisesRegex(RuntimeError,'needs a terminal'):installer.interactive_db()
            menu.assert_not_called()
        with patch.object(installer.sys.stdin,'isatty',return_value=True), patch.object(installer.sys.stdout,'isatty',return_value=True), patch.object(installer,'discover',return_value=iter([])):
            with self.assertRaisesRegex(RuntimeError,'No Chromium profiles'):installer.interactive_db()

    def test_arrow_key_menu_and_cancel(self):
        from contextlib import nullcontext
        import io
        for keys, expected in [(['up','\r'],2), (['down','down','up','\r'],1), (['q'],None), (['end','home','\r'],0)]:
            with self.subTest(keys=keys), patch.object(installer,'menu_terminal',return_value=nullcontext(True)), patch.object(installer,'read_menu_key',side_effect=keys), patch.object(installer.sys,'stdout',io.StringIO()):
                self.assertEqual(installer.menu_choice('Browser',['one','two','three']),expected)

    def test_numbered_fallback_validates_and_cancels(self):
        from contextlib import nullcontext
        for answers,expected in [(['invalid','0','4','2'],1),(['q'],None)]:
            with self.subTest(answers=answers), patch.object(installer,'menu_terminal',return_value=nullcontext(False)), patch('builtins.input',side_effect=answers), patch('builtins.print'):
                self.assertEqual(installer.menu_choice('Browser',['one','two']),expected)

    def test_main_no_args_and_cli_remain_separate(self):
        db = Path('/test/Default/Web Data')
        for argv, interactive in [(['installer'],True), (['installer','--browser','chrome'],False)]:
            with self.subTest(argv=argv), patch.object(installer.sys,'argv',argv), patch.object(installer.os,'geteuid',return_value=1000,create=True), patch.object(installer.os,'umask'), patch.object(installer,'interactive_db',return_value=db) as picker, patch.object(installer,'select_db',return_value=db) as direct, patch.object(installer,'install',return_value=None) as install, patch('builtins.print'):
                installer.main()
                self.assertEqual(picker.called,interactive)
                self.assertEqual(direct.called,not interactive)
                self.assertEqual(install.call_args.args[0],db)
        with patch.object(installer.sys,'argv',['installer']), patch.object(installer.os,'geteuid',return_value=1000,create=True), patch.object(installer.os,'umask'), patch.object(installer,'interactive_db',return_value=None), patch.object(installer,'install') as install, patch('builtins.print'):
            installer.main();install.assert_not_called()


if __name__ == '__main__':unittest.main()
