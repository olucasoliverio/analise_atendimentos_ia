type SmokeResult = {
  name: string;
  ok: boolean;
  details: string;
};

type JobStatusResponse = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message: string;
  analysisId?: string;
  error?: string;
};

const apiBaseUrl = getRequiredEnv('SMOKE_API_URL').replace(/\/$/, '');
const bearerToken = getRequiredEnv('SMOKE_BEARER_TOKEN');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 180000);
const pollIntervalMs = Number(process.env.SMOKE_POLL_INTERVAL_MS || 2000);

const conversationId = process.env.SMOKE_CONVERSATION_ID;
const customerEmail = process.env.SMOKE_CUSTOMER_EMAIL;
const mediaConversationId = process.env.SMOKE_MEDIA_CONVERSATION_ID;
const expectFreshchatFailurePath = process.env.SMOKE_EXPECT_FRESHCHAT_FAILURE_PATH;
const expectGeminiFailureConversationId = process.env.SMOKE_EXPECT_GEMINI_FAILURE_CONVERSATION_ID;

async function main() {
  const results: SmokeResult[] = [];

  results.push(await runCheck('health', smokeHealth));
  results.push(await runCheck('auth', smokeAuth));

  if (conversationId) {
    results.push(await runCheck('conversation-by-id', () => smokeConversationById(conversationId)));
    results.push(await runCheck('analysis-simple', () => smokeAnalysis(conversationId, 'simple')));
  }

  if (customerEmail) {
    results.push(await runCheck('conversation-by-email', () => smokeConversationByEmail(customerEmail)));
  }

  if (mediaConversationId) {
    results.push(await runCheck('analysis-media', () => smokeAnalysis(mediaConversationId, 'media')));
  }

  if (expectFreshchatFailurePath) {
    results.push(await runCheck('freshchat-failure', () => smokeExpectedFailure(expectFreshchatFailurePath)));
  }

  if (expectGeminiFailureConversationId) {
    results.push(await runCheck('gemini-failure', () =>
      smokeExpectedFailure('/api/analyses', {
        method: 'POST',
        body: JSON.stringify({ conversationIds: [expectGeminiFailureConversationId] })
      })
    ));
  }

  printResults(results);

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

async function smokeHealth(): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/health`);
  if (!response.ok) {
    throw new Error(`health retornou status ${response.status}`);
  }

  const payload = await response.json() as { status?: string };
  if (payload.status !== 'ok') {
    throw new Error('health nao retornou status ok');
  }

  return 'health ok';
}

async function smokeAuth(): Promise<string> {
  const response = await apiFetch('/api/analyses');
  if (!response.ok) {
    throw new Error(`auth falhou com status ${response.status}`);
  }

  return 'token aceito pelo backend';
}

async function smokeConversationById(id: string): Promise<string> {
  const response = await apiFetch(`/api/conversations/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(`busca por ID falhou com status ${response.status}`);
  }

  const payload = await response.json() as { id?: string };
  if (!payload.id) {
    throw new Error('conversa por ID sem payload esperado');
  }

  return `conversa carregada (${payload.id})`;
}

async function smokeConversationByEmail(email: string): Promise<string> {
  const response = await apiFetch(`/api/conversations/by-email/${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error(`busca por email falhou com status ${response.status}`);
  }

  const payload = await response.json() as unknown[];
  if (!Array.isArray(payload)) {
    throw new Error('resposta por email nao retornou lista');
  }

  return `${payload.length} conversa(s) retornada(s)`;
}

async function smokeAnalysis(id: string, label: string): Promise<string> {
  const createResponse = await apiFetch('/api/analyses', {
    method: 'POST',
    body: JSON.stringify({ conversationIds: [id] })
  });

  if (createResponse.status !== 202) {
    throw new Error(`criacao da analise ${label} falhou com status ${createResponse.status}`);
  }

  const createPayload = await createResponse.json() as { jobId?: string };
  if (!createPayload.jobId) {
    throw new Error(`criacao da analise ${label} nao retornou jobId`);
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusResponse = await apiFetch(`/api/analyses/jobs/${createPayload.jobId}`);
    if (!statusResponse.ok) {
      throw new Error(`polling da analise ${label} falhou com status ${statusResponse.status}`);
    }

    const statusPayload = await statusResponse.json() as JobStatusResponse;
    if (statusPayload.status === 'COMPLETED' && statusPayload.analysisId) {
      return `analise ${label} concluida (${statusPayload.analysisId})`;
    }

    if (statusPayload.status === 'FAILED') {
      throw new Error(`analise ${label} falhou: ${statusPayload.error || statusPayload.message}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`timeout aguardando analise ${label}`);
}

async function smokeExpectedFailure(
  path: string,
  init?: RequestInit
): Promise<string> {
  const response = await apiFetch(path, init);
  if (response.status < 500) {
    throw new Error(`falha esperada nao ocorreu; status recebido: ${response.status}`);
  }

  return `falha controlada observada com status ${response.status}`;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${bearerToken}`);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers
  });
}

async function runCheck(name: string, fn: () => Promise<string>): Promise<SmokeResult> {
  try {
    const details = await fn();
    return { name, ok: true, details };
  } catch (error: any) {
    return {
      name,
      ok: false,
      details: error?.message || 'erro desconhecido'
    };
  }
}

function printResults(results: SmokeResult[]) {
  console.log('');
  console.log('Smoke test summary');
  console.log('------------------');

  for (const result of results) {
    const status = result.ok ? 'PASS' : 'FAIL';
    console.log(`${status} ${result.name}: ${result.details}`);
  }

  console.log('');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }

  return value;
}

void main();
