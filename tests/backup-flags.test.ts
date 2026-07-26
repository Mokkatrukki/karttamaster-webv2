// T343/V249 — backup.sh:n lippujen kuiva-ajo: --snapshot-only ei saa koskea ssh:hen (kylmä kone),
// --offsite-only ei saa luoda snapshottia, ilman lippua = molemmat (nykyinen käytös).
// Ei verkkoa: fly/curl korvataan PATH-stubeilla jotka kirjaavat argumenttinsa lokiin.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let dir: string;
let bin: string;
let script: string;
let flyLog: string;

const stub = (name: string, body: string) => {
  const p = join(bin, name);
  writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'backup-flags-'));
  bin = join(dir, 'bin');
  mkdirSync(bin);
  script = join(dir, 'backup.sh');
  copyFileSync(resolve(__dirname, '..', 'backup.sh'), script);
  flyLog = join(dir, 'fly.log');
  stub('fly', `echo "$*" >> "${flyLog}"`);
  stub('curl', 'exit 0');
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (...args: string[]) => {
  writeFileSync(flyLog, '');
  try {
    execFileSync('bash', [script, ...args], {
      cwd: dir,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: dir },
      stdio: 'pipe',
    });
  } catch {
    // exit-koodi ei ole tämän testin kohde — vain se mitä fly-CLI:ltä pyydetään
  }
  return readFileSync(flyLog, 'utf8');
};

describe('backup.sh liput (T343/V249)', () => {
  it('--snapshot-only ei kutsu fly ssh:tä kertaakaan', () => {
    const log = run('--snapshot-only');
    expect(log).toContain('volumes snapshots create');
    expect(log).not.toContain('ssh');
  });

  it('--offsite-only ei luo snapshottia', () => {
    const log = run('--offsite-only');
    expect(log).not.toContain('snapshots create');
    expect(log).toContain('ssh console');
  });

  it('ilman lippua tekee molemmat (nykyinen käytös)', () => {
    const log = run();
    expect(log).toContain('volumes snapshots create');
    expect(log).toContain('ssh console');
  });

  it('tuntematon lippu kaatuu koodilla 2 eikä koske flyhyn', () => {
    writeFileSync(flyLog, '');
    let code = 0;
    try {
      execFileSync('bash', [script, '--kaikki'], {
        cwd: dir,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: dir },
        stdio: 'pipe',
      });
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).toBe(2);
    expect(readFileSync(flyLog, 'utf8')).toBe('');
  });
});
