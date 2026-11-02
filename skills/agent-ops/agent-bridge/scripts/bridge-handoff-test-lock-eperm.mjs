/**
 * Harness: rama EPERM de acquireLock (openSync lanza EPERM → lock_io).
 * Node 22 no permite mock.method en fs.openSync; espejamos lockIoFailure del producto.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { lockIoFailureForTest } from './bridge-handoff-test-lock-io.mjs';
import { acquireLock } from './bridge-handoff-lock.mjs';

const lockPath = join('/tmp/bridge-eperm-probe', 'journal.lock');
const fromMirror = lockIoFailureForTest(lockPath, { code: 'EPERM', message: 'EPERM: mock sin permiso' });
assert.equal(fromMirror.ok, false);
assert.equal(fromMirror.reason, 'lock_io');
assert.match(fromMirror.message, /sin permiso de escritura/);
assert.equal(fromMirror.hint, 'sin permiso de escritura');

const missing = acquireLock(join('/tmp/bridge-eperm-probe', 'no/existe/journal.lock'));
assert.equal(missing.ok, false);
assert.equal(missing.reason, 'lock_io');
assert.equal(missing.errno, 'ENOENT');
