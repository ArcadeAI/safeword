/** A small MCP Apps view. The tool result is also complete without this view. */
export const REVIEW_LOGIN_URI = 'ui://safeword/reviewer-login.html';

export const REVIEW_LOGIN_HTML = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 14px system-ui, sans-serif; margin: 0; padding: 16px; color: light-dark(#171717,#f5f5f5); color-scheme: light dark; background: light-dark(#fff,#171717); }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { margin: 8px 0; }
  button { border: 0; border-radius: 8px; padding: 9px 14px; cursor: pointer; background: #2457cf; color: white; }
  code { user-select: all; font-size: 16px; }
</style>
<h1>Sign in to finish the independent review</h1>
<p id="reviewer">Waiting for sign-in details…</p>
<button id="open" hidden>Open sign-in page</button>
<p id="code" hidden></p>
<p id="help"></p>
<script>
  let nextId = 1;
  let loginUrl;
  let opened = false;
  const open = document.getElementById('open');
  function openLogin() {
    if (loginUrl) window.parent.postMessage({ jsonrpc: '2.0', id: nextId++, method: 'ui/open-link', params: { url: loginUrl } }, '*');
  }
  function render(value) {
    if (!value || typeof value.auth_url !== 'string') return;
    loginUrl = value.auth_url;
    document.getElementById('reviewer').textContent = 'Sign in to ' + value.reviewer + ' to resume this review.';
    open.hidden = false;
    const code = document.getElementById('code');
    code.hidden = typeof value.device_code !== 'string';
    if (!code.hidden) {
      code.textContent = 'Enter this code on the sign-in page: ';
      const token = document.createElement('code');
      token.textContent = value.device_code;
      code.append(token);
    }
    document.getElementById('help').textContent = value.reviewer === 'claude'
      ? 'Complete Claude sign-in in your browser, then retry the review.'
      : 'Return here after sign-in, then retry the same review.';
    if (!opened) {
      opened = true;
      if (value.automatic_open_allowed && !value.browser_launch_requested) openLogin();
    }
  }
  open.addEventListener('click', openLogin);
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    if (event.data.id === 1 && event.data.result) {
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*');
      return;
    }
    if (event.data.method === 'ui/notifications/tool-result') {
      const result = event.data.params;
      let value = result?.structuredContent;
      if (!value && typeof result?.content?.[0]?.text === 'string') {
        try { value = JSON.parse(result.content[0].text); } catch { return; }
      }
      render(value);
    }
  });
  window.parent.postMessage({ jsonrpc: '2.0', id: nextId++, method: 'ui/initialize', params: { protocolVersion: '2026-01-26', appInfo: { name: 'safeword-review-login', version: '1' }, appCapabilities: { availableDisplayModes: ['inline'] } } }, '*');
</script></html>`;
