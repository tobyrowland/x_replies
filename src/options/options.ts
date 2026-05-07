import {
  AGENTS_ENDPOINT_DEFAULT,
  getAgents,
  onAgentsChanged,
} from '@/shared/agents';
import {
  COMPANIES_ENDPOINT_DEFAULT,
  getCompanies,
  onCompaniesChanged,
} from '@/shared/companies';
import {
  CONSENSUS_ENDPOINT_DEFAULT,
  getConsensus,
  onConsensusChanged,
} from '@/shared/consensus';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/shared/storage';
import { DEFAULT_RULES } from '@/llm/prompts';
import {
  requestRefreshAgents,
  requestRefreshCompanies,
  requestRefreshConsensus,
} from '@/content/common/messaging';
import type {
  AgentsCache,
  CompaniesCache,
  ConsensusCache,
  Settings,
} from '@/shared/types';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const apiKeyInput = $<HTMLInputElement>('apiKey');
const voiceInput = $<HTMLTextAreaElement>('voiceSamples');
const rulesInput = $<HTMLTextAreaElement>('systemPromptRules');
const enableX = $<HTMLInputElement>('enableX');
const enableBluesky = $<HTMLInputElement>('enableBluesky');
const enableReddit = $<HTMLInputElement>('enableReddit');
const threshold = $<HTMLInputElement>('threshold');
const thresholdValue = $<HTMLSpanElement>('thresholdValue');
const status = $<HTMLSpanElement>('status');

const consensusEndpoint = $<HTMLInputElement>('consensusEndpoint');
const consensusStatus = $<HTMLDivElement>('consensusStatus');
const companiesEndpoint = $<HTMLInputElement>('companiesEndpoint');
const companiesStatus = $<HTMLDivElement>('companiesStatus');
const agentsEndpoint = $<HTMLInputElement>('agentsEndpoint');
const agentsStatus = $<HTMLDivElement>('agentsStatus');

rulesInput.style.minHeight = '220px';
rulesInput.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
rulesInput.style.fontSize = '12px';

void load();

function setStatus(text: string, kind: 'ok' | 'err' | '' = ''): void {
  status.textContent = text;
  status.className = `status${kind ? ' ' + kind : ''}`;
}

function renderConsensus(cache: ConsensusCache | null): void {
  renderCacheStatus(consensusStatus, cache, 'Consensus list', 'tickers');
}

function renderCompanies(cache: CompaniesCache | null): void {
  renderCacheStatus(companiesStatus, cache, 'Companies list', 'tickers');
}

function renderAgents(cache: AgentsCache | null): void {
  renderCacheStatus(agentsStatus, cache, 'Agents list', 'agents');
}

function renderCacheStatus(
  el: HTMLElement,
  cache: { entries: unknown[]; fetchedAt: number } | null,
  label: string,
  unit: string,
): void {
  if (!cache || cache.fetchedAt === 0) {
    el.textContent = `${label}: not loaded yet.`;
    return;
  }
  const when = new Date(cache.fetchedAt).toLocaleString();
  el.textContent = `${label}: ${cache.entries.length} ${unit}, last fetched ${when}.`;
}

async function load(): Promise<void> {
  const [s, consensus, companies, agents] = await Promise.all([
    getSettings(),
    getConsensus(),
    getCompanies(),
    getAgents(),
  ]);
  apiKeyInput.value = s.apiKey;
  voiceInput.value = s.voiceSamples;
  rulesInput.value = s.systemPromptRules ?? DEFAULT_RULES;
  enableX.checked = s.enabledPlatforms.x;
  enableBluesky.checked = s.enabledPlatforms.bluesky;
  enableReddit.checked = s.enabledPlatforms.reddit;
  threshold.value = String(s.highlightThreshold);
  thresholdValue.textContent = s.highlightThreshold.toFixed(2);
  consensusEndpoint.value = s.consensusEndpoint ?? '';
  consensusEndpoint.placeholder = CONSENSUS_ENDPOINT_DEFAULT;
  companiesEndpoint.value = s.companiesEndpoint ?? '';
  companiesEndpoint.placeholder = COMPANIES_ENDPOINT_DEFAULT;
  agentsEndpoint.value = s.agentsEndpoint ?? '';
  agentsEndpoint.placeholder = AGENTS_ENDPOINT_DEFAULT;
  renderConsensus(consensus);
  renderCompanies(companies);
  renderAgents(agents);
}

threshold.addEventListener('input', () => {
  thresholdValue.textContent = parseFloat(threshold.value).toFixed(2);
});

onConsensusChanged((cache) => renderConsensus(cache));
onCompaniesChanged((cache) => renderCompanies(cache));
onAgentsChanged((cache) => renderAgents(cache));

$('save').addEventListener('click', async () => {
  const next: Settings = {
    ...DEFAULT_SETTINGS,
    apiKey: apiKeyInput.value.trim(),
    voiceSamples: voiceInput.value,
    systemPromptRules: rulesInput.value.trim() || null,
    enabledPlatforms: {
      x: enableX.checked,
      bluesky: enableBluesky.checked,
      reddit: enableReddit.checked,
    },
    highlightThreshold: parseFloat(threshold.value),
    alphamoltPagesOverride: null,
    consensusEndpoint: consensusEndpoint.value.trim() || null,
    companiesEndpoint: companiesEndpoint.value.trim() || null,
    agentsEndpoint: agentsEndpoint.value.trim() || null,
  };
  await saveSettings(next);
  setStatus('Saved.', 'ok');
});

$('resetRules').addEventListener('click', () => {
  rulesInput.value = DEFAULT_RULES;
  setStatus('Rules reset to default (not saved yet).');
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

$('refreshConsensus').addEventListener('click', async () => {
  setStatus('Refreshing consensus…');
  try {
    const { cache } = await requestRefreshConsensus();
    renderConsensus(cache);
    setStatus(`Loaded ${cache.entries.length} tickers.`, 'ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Refresh failed: ${msg}`, 'err');
  }
});

$('refreshCompanies').addEventListener('click', async () => {
  setStatus('Refreshing companies…');
  try {
    const { cache } = await requestRefreshCompanies();
    renderCompanies(cache);
    setStatus(`Loaded ${cache.entries.length} companies.`, 'ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Refresh failed: ${msg}`, 'err');
  }
});

$('refreshAgents').addEventListener('click', async () => {
  setStatus('Refreshing agents…');
  try {
    const { cache } = await requestRefreshAgents();
    renderAgents(cache);
    setStatus(`Loaded ${cache.entries.length} agents.`, 'ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Refresh failed: ${msg}`, 'err');
  }
});
