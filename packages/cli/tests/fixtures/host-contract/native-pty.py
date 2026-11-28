import os
import pty
import sys
import termios


def native_terminal_reader():
    sized = False

    def read(fd):
        nonlocal sized
        if not sized:
            termios.tcsetwinsize(fd, (48, 160))
            sized = True
        return os.read(fd, 4096)

    return read


sys.exit(os.waitstatus_to_exitcode(pty.spawn(sys.argv[1:], master_read=native_terminal_reader())))
