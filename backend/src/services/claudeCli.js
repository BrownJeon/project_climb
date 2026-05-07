const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
process.stderr.write(`[claudeCli] MODULE LOAD __filename=${__filename}\n`);

// 우선순위: 환경변수 → backend/node_modules의 1.0.128 → PATH의 claude
function resolveCliCommand() {
  if (process.env.CLAUDE_CLI_PATH) {
    return { cmd: process.env.CLAUDE_CLI_PATH, prefixArgs: [] };
  }
  const localCliJs = path.join(__dirname, '../../node_modules/@anthropic-ai/claude-code/cli.js');
  process.stderr.write(`[claudeCli] resolve PRE-EXISTS __dirname=${__dirname} localCliJs=${localCliJs}\n`);
  let exists = false;
  try { exists = fs.existsSync(localCliJs); } catch (e) {
    process.stderr.write(`[claudeCli] existsSync threw: ${e.message}\n`);
  }
  process.stderr.write(`[claudeCli] resolve exists=${exists}\n`);
  if (exists) {
    return { cmd: process.execPath, prefixArgs: [localCliJs] };
  }
  return { cmd: 'claude', prefixArgs: [] };
}
const { cmd: CLI_CMD, prefixArgs: CLI_PREFIX } = resolveCliCommand();
process.stderr.write(`[claudeCli] AFTER-RESOLVE CLI_CMD=${CLI_CMD} prefix=${JSON.stringify(CLI_PREFIX)}\n`);

/**
 * Claude CLI subprocess 호출.
 *  - prompt: stdin으로 전달 (shell injection 방어)
 *  - stream=false: stdout 누적해 string 반환
 *  - stream=true:  stream-json 파싱 + AsyncIterable<string> (assistant text chunk) 반환
 */
function runClaude({ prompt, stream = false, timeoutMs = 120000 }) {
  // claude CLI 2.x는 비-TTY 환경에선 stdin 으로 prompt를 받아야 함.
  // (positional arg로 보내면 "Execution error" 발생, TTY 환경에선 반대로 동작)
  // stream-json 모드는 effortLevel null 버그가 있어 일반 print 모드만 사용.
  const args = [...CLI_PREFIX, '-p'];
  const cwd = process.env.CLAUDE_CLI_CWD || '/tmp';

  // 부모(서버) 프로세스가 Claude Code 환경에서 띄워졌을 경우 상속된
  // CLAUDE_CODE_*, CLAUDECODE, ANTHROPIC_API_KEY 등이 child CLI와 충돌.
  // 해당 env 제거 후 spawn.
  const cleanEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE_CODE_')) continue;
    if (k === 'CLAUDECODE' || k === 'CLAUDE_AGENT_SDK_VERSION') continue;
    // ANTHROPIC_API_KEY가 부모 환경에 있으면 자식 CLI가 그 키로 API 호출 →
    // 키가 무효/credit 부족이면 실패. OAuth credential 사용을 강제하기 위해 제거.
    if (k === 'ANTHROPIC_API_KEY' || k === 'ANTHROPIC_AUTH_TOKEN') continue;
    cleanEnv[k] = v;
  }

  process.stderr.write(`[claudeCli] cmd=${CLI_CMD} args=${JSON.stringify(args)} cwd=${cwd} has_API_KEY=${'ANTHROPIC_API_KEY' in cleanEnv} has_CLAUDECODE=${'CLAUDECODE' in cleanEnv}\n`);
  const proc = spawn(CLI_CMD, args, {
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd,
    env: cleanEnv,
  });

  let timer = setTimeout(() => {
    proc.kill('SIGTERM');
    setTimeout(() => proc.kill('SIGKILL'), 5000);
  }, timeoutMs);

  // stdin으로 prompt 전달
  try {
    proc.stdin.write(prompt);
    proc.stdin.end();
  } catch { /* ignore */ }

  if (!stream) {
    return new Promise((resolve, reject) => {
      let out = '', err = '';
      let finished = false;
      const finish = (cb) => { if (!finished) { finished = true; clearTimeout(timer); cb(); } };

      proc.on('error', (e) => finish(() => {
        const msg = e.code === 'ENOENT' ? 'Claude CLI를 찾을 수 없습니다.' : e.message;
        const wrap = new Error(msg);
        wrap.code = e.code;
        reject(wrap);
      }));
      proc.stdout.on('data', (c) => { out += c.toString(); });
      proc.stderr.on('data', (c) => { err += c.toString(); });
      proc.on('close', (code) => finish(() => {
        if (process.env.CLAUDE_CLI_DEBUG === '1') {
          console.log('[claudeCli] close rc=', code, 'out_head=', out.slice(0, 300), 'err=', err.slice(-300));
        }
        if (code === 0) resolve(out);
        else reject(new Error(`claude exit ${code}: ${err.slice(-500)}`));
      }));
    });
  }

  // 스트리밍 — stream-json 라인별 파싱하여 assistant text만 yield
  return (async function* () {
    let buf = '';
    try {
      proc.on('error', (e) => {
        const msg = e.code === 'ENOENT' ? 'Claude CLI를 찾을 수 없습니다.' : e.message;
        throw new Error(msg);
      });
      for await (const chunk of proc.stdout) {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === 'assistant' && obj.message?.content) {
              const text = (obj.message.content || [])
                .filter((c) => c.type === 'text')
                .map((c) => c.text)
                .join('');
              if (text) yield text;
            }
          } catch {
            yield line;
          }
        }
      }
      // flush remaining buf
      if (buf.trim()) {
        try {
          const obj = JSON.parse(buf);
          if (obj.type === 'assistant' && obj.message?.content) {
            const text = (obj.message.content || [])
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('');
            if (text) yield text;
          }
        } catch { yield buf; }
      }
    } finally {
      clearTimeout(timer);
    }
  })();
}

module.exports = { runClaude };
