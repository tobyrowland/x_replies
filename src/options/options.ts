import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/shared/storage';
import type { Settings } from '@/shared/types';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const apiKeyInput = $<HTMLInputElement>('apiKey');
const voiceInput = $<HTMLTextAreaElement>('voiceSamples');
const enableX = $<HTMLInputElement>('enableX');
const enableBluesky = $<HTMLInputElement>('enableBluesky');
const enableReddit = $<HTMLInputElement>('enableReddit');
const threshold = $<HTMLInputElement>('threshold');
const thresholdValue = $<HTMLSpanElement>('thresholdValue');
const status = $<HTMLSpanElement>('status');

void load();

function setStatus(text: string, kind: 'ok' | 'err' | '' = ''): void {
  status.textContent = text;
  status.className = `status${kind ? ' ' + kind : ''}`;
}

async function load(): Promise<void> {
  const s = await getSettings();
  apiKeyInput.value = s.apiKey;
  voiceInput.value = s.voiceSamples;
  enableX.checked = s.enabledPlatforms.x;
  enableBluesky.checked = s.enabledPlatforms.bluesky;
  enableReddit.checked = s.enabledPlatforms.reddit;
  threshold.value = String(s.highlightThreshold);
  thresholdValue.textContent = s.highlightThreshold.toFixed(2);
}

threshold.addEventListener('input', () => {
  thresholdValue.textContent = parseFloat(threshold.value).toFixed(2);
});

$('save').addEventListener('click', async () => {
  const next: Settings = {
    ...DEFAULT_SETTINGS,
    apiKey: apiKeyInput.value.trim(),
    voiceSamples: voiceInput.value,
    enabledPlatforms: {
      x: enableX.checked,
      bluesky: enableBluesky.checked,
      reddit: enableReddit.checked,
    },
    highlightThreshold: parseFloat(threshold.value),
    alphamoltPagesOverride: null,
  };
  await saveSettings(next);
  setStatus('Saved.', 'ok');
});

$('test').addEventListener('click', async () => {
  setStatus('Testing…');
  const key = apiKeyInput.value.trim();
  if (!key) {
    setStatus('Enter an API key first.', 'err');
    return;
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    }
    setStatus('API key works.', 'ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Failed: ${msg}`, 'err');
  }
});
