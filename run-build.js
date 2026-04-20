// turbopackを明示的に無効化してビルド実行
delete process.env.TURBOPACK;
delete process.env.TURBOPACK_BUILD;

const { execFileSync } = require('child_process');
const path = require('path');
const dir = __dirname;

try {
  execFileSync(
    process.execPath,
    [path.join(dir, 'node_modules/next/dist/bin/next'), 'build'],
    {
      cwd: dir,
      stdio: 'inherit',
      env: { ...process.env, TURBOPACK: '', TURBOPACK_BUILD: '' },
    }
  );
} catch (e) {
  process.exit(1);
}
