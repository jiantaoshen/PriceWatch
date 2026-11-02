"""An OS-level exclusive lock prevents two independent scrape runs at once."""
import os
from pathlib import Path


class ScrapeLock:
    def __init__(self, path):
        self.path = Path(str(path) + ".scrape.lock")
        self.handle = None

    def __enter__(self):
        self.handle = self.path.open("a+b")
        try:
            self.handle.seek(0)
            if os.name == "nt":
                import msvcrt
                self.handle.write(b"0")
                self.handle.flush()
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            self.handle.close()
            raise RuntimeError("Another scrape run holds the lock") from error
        return self

    def __exit__(self, *_):
        if self.handle:
            self.handle.close()  # OS releases the lock after exit/crash.
