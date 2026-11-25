import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

export interface NativeParent {
  serverPid: number;
  parentPid: number;
  serverExecutable: string;
  parentExecutable: string;
  serverArguments: string[];
  parentArguments: string[];
}

// macOS capability only. Exact kernel argv, never flattened ps command text.
// No installation or shell activation; unavailable Python/OS APIs fail closed.
const observe = String.raw`
import ctypes, json, os, struct, subprocess, sys
server, parent = map(int, sys.argv[1:])
assert os.getppid() == server
lib = ctypes.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
proc = ctypes.CDLL('/usr/lib/libproc.dylib', use_errno=True)
proc.proc_pidpath.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
proc.proc_pidpath.restype = ctypes.c_int
def executable(pid):
    buf = ctypes.create_string_buffer(4096)
    assert proc.proc_pidpath(pid, buf, len(buf)) > 0
    return os.path.realpath(os.fsdecode(buf.value))
def arguments(pid):
    mib = (ctypes.c_int * 3)(1, 49, pid) # CTL_KERN, KERN_PROCARGS2
    size = ctypes.c_size_t(0)
    assert lib.sysctl(mib, 3, None, ctypes.byref(size), None, 0) == 0
    assert 4 < size.value <= 1048576
    buf = ctypes.create_string_buffer(size.value)
    assert lib.sysctl(mib, 3, buf, ctypes.byref(size), None, 0) == 0
    try:
        data = buf.raw[:size.value]
        argc = struct.unpack_from('i', data)[0]
        assert 0 < argc <= 128
        offset = data.index(b'\0', 4) + 1
        while data[offset] == 0: offset += 1
        argv = []
        for _ in range(argc):
            end = data.index(b'\0', offset)
            argv.append(os.fsdecode(data[offset:end]))
            offset = end + 1
        return argv[1:]
    finally:
        ctypes.memset(buf, 0, len(buf))
def parent_of(pid):
    return int(subprocess.check_output(['/bin/ps', '-p', str(pid), '-o', 'ppid='], timeout=1))
assert parent_of(server) == parent
paths = [executable(server), executable(parent)]
args = [arguments(server), arguments(parent)]
assert parent_of(server) == parent and paths == [executable(server), executable(parent)]
print(json.dumps(dict(serverPid=server, parentPid=parent, serverExecutable=paths[0], parentExecutable=paths[1], serverArguments=args[0], parentArguments=args[1])))
`;

export function readNativeParent(): NativeParent | undefined {
  if (process.platform !== 'darwin') return undefined;
  try {
    const developer = execFileSync('/usr/bin/xcode-select', ['--print-path'], {
      timeout: 1000,
      maxBuffer: 4096,
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin' },
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!nodePath.isAbsolute(developer)) return undefined;
    // Resolve an existing installed interpreter, never execute the /usr/bin installation shim.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- OS-selected existing developer tool, never a shell/user command
    const python = realpathSync(nodePath.join(developer, 'usr/bin/python3'));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- require the resolved installed interpreter to be a regular file
    if (python === '/usr/bin/python3' || !statSync(python).isFile()) return undefined;
    const output = execFileSync(
      python,
      ['-I', '-c', observe, String(process.pid), String(process.ppid)],
      {
        timeout: 4000,
        maxBuffer: 32_768,
        encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin' },
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    return JSON.parse(output) as NativeParent;
  } catch {
    return undefined;
  }
}
