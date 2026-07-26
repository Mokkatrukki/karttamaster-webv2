// T343/V249 — backup.sh:n lippujen kuiva-ajo: --snapshot-only ei saa koskea ssh:hen (kylmä kone),
// --offsite-only ei saa luoda snapshottia, ilman lippua = molemmat (nykyinen käytös).
// Ei verkkoa: fly/curl korvataan PATH-stubeilla jotka kirjaavat argumenttinsa lokiin.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
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

describe('deploy.sh backup-järjestys (T343/V249)', () => {
  let ddir: string;
  let dlog: string;

  const runDeploy = (backupExit: Record<string, number>) => {
    ddir = mkdtempSync(join(tmpdir(), 'deploy-order-'));
    dlog = join(ddir, 'calls.log');
    copyFileSync(resolve(__dirname, '..', 'deploy.sh'), join(ddir, 'deploy.sh'));
    writeFileSync(join(ddir, '.env'), 'VITE_MML_API_KEY=testikey\n');
    const dbin = join(ddir, 'bin');
    mkdirSync(dbin);
    writeFileSync(join(dbin, 'fly'), `#!/usr/bin/env bash\necho "fly $*" >> "${dlog}"\n`, { mode: 0o755 });
    writeFileSync(
      join(ddir, 'backup.sh'),
      `#!/usr/bin/env bash\necho "backup $*" >> "${dlog}"\ncase "$1" in\n  --snapshot-only) exit ${backupExit['--snapshot-only'] ?? 0} ;;\n  --offsite-only) exit ${backupExit['--offsite-only'] ?? 0} ;;\nesac\n`,
      { mode: 0o755 },
    );
    const r = spawnSync('bash', [join(ddir, 'deploy.sh')], {
      cwd: ddir,
      env: { ...process.env, PATH: `${dbin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    return {
      calls: readFileSync(dlog, 'utf8').trim().split('\n'),
      out: r.stdout + r.stderr,
      code: r.status ?? -1,
    };
  };

  afterAll(() => ddir && rmSync(ddir, { recursive: true, force: true }));

  it('snapshot ENNEN deployta, off-site VASTA sen jälkeen', () => {
    const { calls } = runDeploy({});
    expect(calls[0]).toBe('backup --snapshot-only');
    expect(calls[1]).toMatch(/^fly deploy/);
    expect(calls[2]).toBe('backup --offsite-only');
  });

  it('epäonnistunut off-site-kopio ei jää hiljaiseksi', () => {
    const { out } = runDeploy({ '--offsite-only': 1 });
    expect(out).toContain('OFF-SITE-KOPIO EPÄONNISTUI');
  });

  it('SKIP_BACKUP=1 ohittaa molemmat tasot', () => {
    ddir = mkdtempSync(join(tmpdir(), 'deploy-skip-'));
    dlog = join(ddir, 'calls.log');
    copyFileSync(resolve(__dirname, '..', 'deploy.sh'), join(ddir, 'deploy.sh'));
    writeFileSync(join(ddir, '.env'), 'VITE_MML_API_KEY=testikey\n');
    const dbin = join(ddir, 'bin');
    mkdirSync(dbin);
    writeFileSync(join(dbin, 'fly'), `#!/usr/bin/env bash\necho "fly $*" >> "${dlog}"\n`, { mode: 0o755 });
    writeFileSync(join(ddir, 'backup.sh'), `#!/usr/bin/env bash\necho "backup $*" >> "${dlog}"\n`, { mode: 0o755 });
    execFileSync('bash', [join(ddir, 'deploy.sh')], {
      cwd: ddir,
      env: { ...process.env, PATH: `${dbin}:${process.env.PATH}`, SKIP_BACKUP: '1' },
      stdio: 'pipe',
    });
    const calls = readFileSync(dlog, 'utf8').trim().split('\n');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^fly deploy/);
  });
});

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
