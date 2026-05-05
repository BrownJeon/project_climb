const { spawn } = require('node:child_process');

const CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';

/**
 * Claude CLI subprocess 호출.
 *  - prompt: stdin으로 전달 (shell injection 방어)
 *  - stream=false: stdout 누적해 string 반환
 *  - stream=true:  stream-json 파싱 + AsyncIterable<string> (assistant text chunk) 반환
 */
function runClaude({ prompt, stream = false, timeoutMs = 120000 }) {
  const args = stream ? ['-p', '--output-format', 'stream-json', '--verbose'] : ['-p'];
  const proc = spawn(CLI_PATH, args, {
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let timer = setTimeout(() => {
    proc.kill('SIGTERM');
    setTimeout(() => proc.kill('SIGKILL'), 5000);
  }, timeoutMs);

  // stdin으로 prompt 전달
  try {
    proc.stdin.write(prompt);
    proc.stdin.end();
  } catch {
    /* stdin이 이미 닫힘 (ENOENT 등) — proc.error 이벤트로 처리됨 */
  }

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
