<div align="center">

# 🔄 dsh-session-sync
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-session-sync` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

**Sincronização de sessões entre dispositivos para o DeepSeek Harness — um espelho git dedicado do seu armazenamento de sessões.**

*Sincronize suas sessões entre dispositivos, mantenha os dois lados em qualquer conflito, nunca perca um turno.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-session-sync)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-session-sync.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-top-rated.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-session-sync/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-session-sync/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-session-sync?label=version)](https://github.com/PerryLink/dsh-session-sync/releases)
[![npm version](https://img.shields.io/npm/v/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)
[![npm downloads](https://img.shields.io/npm/dm/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-session-sync?metric=downloads&lang=pt)](https://dshfind.com/pt/plugins/PerryLink/dsh-session-sync?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add dsh-session-sync
```


</div>

---


**📖 Base de conhecimento do ecossistema** — dados medidos, não marketing: [guia de desenvolvimento · dados de seleção · critérios de manutenção](https://perrylink.github.io/dsh-plugin-guide/).

<!-- star-cta -->
## Instalação e desinstalação

- **Canal git** (último `main`): `dsh plugin --profile web add github:PerryLink/dsh-session-sync` (equivalente a instalar de `git+https://github.com/PerryLink/dsh-session-sync.git`). Sem etapa de compilação — `index.mjs` e `lib/` são os artefatos publicados.
- **Canal npm** (versões publicadas): `dsh plugin --profile web add dsh-session-sync`.
- **Canal tarball**: `pnpm pack` neste repositório, depois `dsh plugin --profile web add ./dsh-session-sync-<version>.tgz`.
- **Desinstalar**: `dsh plugin --profile web remove dsh-session-sync` (ou remova a linha do patch de perfil).

## ⭐ 如果它帮到了你

Este plugin faz parte da [família de plugins DSH](https://github.com/PerryLink) (mais de 40, todos Apache-2.0). Se for útil, **deixe uma estrela**: não desbloqueia nada, mas ajuda a próxima pessoa a encontrá-lo.

*English:* part of a 95 plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-session-sync?

Sincronização de sessões entre dispositivos para o DeepSeek Harness — um espelho git dedicado do seu armazenamento de sessões.

Sincronize suas sessões entre dispositivos, mantenha os dois lados em qualquer conflito, nunca perca um turno.

![Demonstração de terminal do dsh-session-sync: dsh-session-sync — mirror the session store, then /sync](https://raw.githubusercontent.com/PerryLink/dsh-session-sync/main/docs/assets/dsh-session-sync-hero.png)

![Animated terminal demo of dsh-session-sync](https://raw.githubusercontent.com/PerryLink/dsh-session-sync/main/docs/assets/dsh-session-sync-demo.gif)

*A mesma execução, animada.*

## Compatibilidade

| Superfície | Status |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.2.1-alpha.1` (tag do GitHub, verificado em 2026-09-25: cadeia completa de portas contra os peers `0.1.7-rc.2` fixados). Linha de dependências npm `0.1.7-rc.2`, peers `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0`. (adaptado em 2026-10-04): o aviso de fork por conflito carrega o source kind próprio do plugin (producer-owned) - o harness aposentou o kind compartilhado `plugin` e o recusa na releitura. |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Plataformas | Qualquer lugar onde `git` e o DSH rodem (espelho baseado em git; sem código específico de plataforma) |
| Modelo | Modelos somente texto são totalmente suportados; sem necessidade de visão ou capacidade extra |

## O que você obtém

O `dsh-session-sync` espelha o seu armazenamento de sessões do DSH em uma árvore de trabalho git dedicada e o sincroniza com um remoto que **você** controla — sem serviço em nuvem, sem armazenamento de terceiros:

- **Comando `/sync`** — `status` (branch, remoto higienizado, à frente/atrás, arquivos sujos, forks), `diff`, `log`, `pull`, `push`, `help`.
- **Ferramentas `sync_status` / `sync_pull` / `sync_push`** — a mesma superfície para o modelo, dentro de um turno.
- **Resolução de conflitos append-only** — os registros de sessão são append-only; em qualquer divergência o plugin mantém **os dois** lados (a versão local é mantida, a remota é preservada como arquivos fork) e nunca sobrescreve em silêncio. Sessões divergentes também podem bifurcar no nível da sessão.
- **Modos automáticos** — pull ao iniciar, push após cada turno fechado e pull periódico, todos configuráveis e reversíveis.
- **Escritas com confirmação** — `pull`/`push` perguntam primeiro (via `userQuestions` ou `approval`); superfícies somente leitura nunca perguntam; sem respondedor a operação falha fechada.

```text
dispositivo A                         remoto (seu repositório git)              dispositivo B
$DSH_HOME/sessions ──espelho──▶ commit ──push──▶ [sessions] ──pull──▶ merge (manter ambos + fork)
```

## Início rápido

```sh
dsh plugin --profile web add github:PerryLink/dsh-session-sync
```

```sh
# 1. instale o bundle no seu perfil
dsh plugin --profile web add github:PerryLink/dsh-session-sync

# ou pelo npm (versões publicadas)
dsh plugin --profile web add dsh-session-sync

# 2. aponte-o para um remoto git privado e verifique a linha
dsh --profile web --dump-config | grep -A2 'id: session-sync'
```

Depois defina o remoto no seu patch de perfil (um repositório **privado** é a base) e sincronize:

```yaml
- insert:
    - id: session-sync
      name: dsh-session-sync
      config:
        remote: git@github.com:you/your-dsh-sessions.git
```

```
> /sync status
> /sync pull
> /sync push
```

## Configuração

Todos os ajustes são campos de `Config` do Schemastery (alteráveis pelo cordis.yml). Uma sobrescrita direcionada por id substitui a linha inteira — repita cada chave de que você precisa. O `cordis.patch.yml` documenta cada chave em linha.

| Chave | Padrão | Significado |
|---|---|---|
| `enabled` | `true` | Interruptor mestre; `false` remove comando, ferramentas, ouvintes e modos automáticos |
| `backend` | `git` | Backend de sincronização: `git` (espelho em texto simples) ou `encrypted` (conteúdo do espelho criptografado com age) |
| `sessionRoot` | `''` | Raiz do armazenamento de sessões; vazio = `$DSH_HOME/sessions` (ambos ausentes falha o carregamento) |
| `repoDir` | `''` | Raiz da árvore de trabalho; vazio = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | Endereço remoto (obrigatório antes de pull/push; status/diff funcionam sem ele) |
| `branch` | `main` | Nome da branch remota |
| `gitBin` | `git` | Caminho do executável git |
| `ageBin` | `age` | Caminho do executável age (sondado com `backend: encrypted`; se ausente, degrada para texto simples) |
| `ageRecipient` | `''` | Destinatário age (chave pública ou string de identidade); vazio = não é possível criptografar, degrada para texto simples |
| `ageIdentity` | `''` | Caminho para uma chave secreta age sem senha (para descriptografar); vazio = degrada para texto simples |
| `autoPullOnStart` | `false` | Faz pull uma vez quando o plugin monta (a configuração é a concessão; sem reconfirmar) |
| `autoPushOnTurnEnd` | `false` | Faz push após cada turno fechado |
| `pullIntervalMinutes` | `0` | Pull periódico a cada N minutos (`0` = desligado, máx. `10080`) |
| `confirmVia` | `auto` | Canal de confirmação: `auto` (userQuestions primeiro, depois approval), `userQuestions`, `approval` |
| `graceMs` | `10000` | Período de graça para matar git (ms) |
| `commandTimeoutMs` | `120000` | Tempo limite por comando (ms) |
| `maxOutputBytes` | `262144` | Limite de saída coletada por fluxo (bytes) |
| `commitName` | `dsh-session-sync` | Nome do autor do commit |
| `commitEmail` | `dsh-session-sync@localhost` | E-mail do autor do commit |
| `registerCommand` | `true` | Registra o comando `/sync` |
| `registerTools` | `true` | Registra as ferramentas `sync_*` quando o serviço tools está presente |

Exemplo de sobrescrita no seu patch de perfil:

```yaml
- insert:
    - id: session-sync
      name: dsh-session-sync
      config:
        remote: git@github.com:you/your-dsh-sessions.git
        branch: main
        autoPushOnTurnEnd: true
        pullIntervalMinutes: 30
        confirmVia: userQuestions
```

## Ferramentas e superfícies

| Superfície | Somente leitura | Requer confirmação | Notas |
|---|---|---|---|
| `/sync status` | ✅ | — | Branch, remoto higienizado, à frente/atrás, arquivos sujos, arquivos fork, último pull/push |
| `/sync diff` | ✅ | — | Alterações não commitadas + estatística `HEAD..remote` (somente leitura) |
| `/sync log` | ✅ | — | Últimos commits do repositório de sincronização |
| `/sync pull` | | ✅ | Fetch + merge com semântica de manter ambos; local mantido, remoto preservado como forks |
| `/sync push` | | ✅ | Espelho + commit + push; nunca força push, reconcilia e tenta novamente uma vez em rejeição |
| `sync_status` | ✅ | — | Os mesmos fatos que `/sync status` para o modelo |
| `sync_pull` | | ✅ | Pull invocável pelo modelo |
| `sync_push` | | ✅ | Push invocável pelo modelo |

## Permissões e dados

- **Permissões**: operações mutadoras cruzam a porta de confirmação (`confirmVia`); o plugin nunca reimplementa nem contorna os serviços `userQuestions`/`approval` do harness. Os modos automáticos são cobertos pela concessão de configuração e nunca reconfirmam.
- **Dados**: os metadados de sincronização (id de dispositivo, último pull/push, última cabeça de push, último erro) vivem no domínio de armazenamento `session-sync`. Os arquivos de sessão são copiados como bytes opacos — o plugin nunca os analisa. O id de dispositivo também é gravado em `device.txt` no repositório de sincronização para atribuição de forks entre dispositivos.
- **Registro de sessão**: `sync/push`, `sync/pull` e `sync/conflict` estão declarados em `types.d.ts`; eles são anexados somente quando o host registra os tipos (veja Limitações conhecidas). Tudo o que é gravado ou exibido é higienizado. A única mensagem durável que o plugin grava — o aviso de fork por conflito — carrega o source kind próprio do plugin (producer-owned, `dsh-session-sync`); o harness aposentou o kind compartilhado `plugin` e o recusa ao reler uma sessão.

## Limites de segurança

- **Nunca sobrescreve em silêncio.** O merge de três vias append-only mantém os dois lados em qualquer divergência; arquivos fork nunca são excluídos e o git nunca força push, reset, rebase ou troca de branch.
- **Contenção de caminhos.** Os arquivos são espelhados como bytes opacos com links simbólicos recusados e cada caminho unido é verificado por contenção (`PATH_UNSAFE` falha alto).
- **Saída higienizada.** Credenciais de URL remota, tokens e segredos `key=value` são redigidos antes de chegar ao modelo ou ao registro; a exibição de caminhos recusa tudo fora de sua raiz.
- **Sem armazenamento de credenciais.** O plugin não armazena credenciais; as credenciais git vivem no seu helper de credenciais normal. As identidades/destinatários age são gerenciados por você, e as chaves nunca entram no repositório de sincronização.
- **Endurecimento do git.** O git roda com `GIT_TERMINAL_PROMPT=0` e `GIT_OPTIONAL_LOCKS=0`, limitado por prazo e sinal, com um limite de saída por fluxo.
- **Falha fechada.** A ausência de respondedor de confirmação, de remoto ou um caminho inseguro recusa a operação alto.

## Criptografia e modelo de ameaças

`backend: encrypted` adiciona uma camada **age** opcional sobre o espelho: os bytes de sessão são criptografados em arquivos `encrypted/**/*.age` antes de commit e push, e descriptografados de volta ao espelho local em texto simples antes da mesclagem. A mesclagem de três vias sempre roda em texto simples localmente, então a semântica append-only de manter ambos os lados não muda.

O que a criptografia **protege**:

- **O conteúdo do espelho em repouso no remoto.** Os arquivos de sessão que você envia são texto cifrado age; o host remoto, seus operadores e qualquer um que clone o repositório não veem os bytes de sessão em claro sem a chave privada.

O que ela **não** protege (a fronteira):

- **As chaves e identidades age são suas.** Os arquivos de destinatário/identidade nunca são distribuídos, armazenados ou rotacionados pelo plugin. Se uma chave vazar, o conteúdo do espelho que ela protege fica exposto. Use uma identidade sem frase-senha e mantenha-a fora do repositório.
- **O remoto continua sendo na prática um repositório privado.** Os metadados do git — mensagens de commit, o `.gitignore`, a estrutura de caminhos `encrypted/`, os nomes de branch e a atividade de push/fetch — continuam visíveis para o host remoto. A criptografia esconde o *conteúdo*, não o fato de que você sincroniza, nem a forma da sua árvore de sessões.
- **O texto simples ainda existe localmente.** O espelho em `<repoDir>/sessions/` é texto simples em disco; a criptografia protege a cópia transmitida/remota, não a criptografia do disco local nem o armazenamento de sessões ao vivo.
- **Degradação graciosa significa texto simples.** Com `backend: encrypted`, se o `age` estiver ausente, ou `ageRecipient`/`ageIdentity` estiverem vazios, o plugin cai para o caminho git em texto simples **e avisa explicitamente** no status/log — ele nunca finge criptografar. Verifique o aviso em `/sync status` antes de confiar no remoto como criptografado.

Linha de base: com `backend: git` (o padrão), os bytes de sessão são armazenados sem criptografia no **seu** remoto git — use um repositório privado.

## Limitações conhecidas

- **A criptografia é opcional.** `backend: encrypted` adiciona uma camada age (veja «Criptografia e modelo de ameaças» acima); se o `age` ou as chaves estiverem ausentes, ele cai para texto simples com um aviso explícito. Com `backend: git` (o padrão), os bytes da sessão são armazenados sem criptografia no **seu** remoto git — use um repositório privado.
- **git é necessário.** O plugin precisa do executável `git` e do serviço `subprocess`; sem eles, as operações de sincronização falham com um motivo claro (os perfis continuam iniciando).
- **Eventos de sessão no `0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2`/`0.1.2-alpha.2`/`0.1.2-alpha.3`/`0.1.2-rc.1`/`0.1.7-alpha.2`.** O harness ainda não registra os tipos `sync/*`, então os anexos ao registro de sessão são omitidos (as sessões continuam carregando); o plugin os habilita automaticamente quando um host registra os tipos ou expõe o envoltório `ignorable` em `Session.append`.
- **`approval` entre turnos.** `/sync` roda entre turnos, onde o canal `approval` não tem um turno aberto para se anexar; use `confirmVia: userQuestions` para sincronização por comando, ou conduza a sincronização pelas ferramentas dentro de um turno. A verificação de turno aberto lê a projeção de sessão `turnBoundary` do host: uma composição sem `@deepseek-ai/dsh-session-projection` não consegue verificar o estado do turno e falha fechada com esse motivo.
- **Artefatos privados do host não são sincronizados.** `session.lock` (a lease de sessão do harness) e os arquivos de staging `session.migration.*.tmp` nunca são espelhados nem excluídos: são estado de execução, não conteúdo sincronizável. Os logs de sessão (`session.jsonl`, `session.v[1-9]*.jsonl[.zstd]`) continuam sendo a carga útil espelhada.

## Desenvolvimento

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs contra os peers 0.1.7-alpha.2 publicados
pnpm test                                          # node --test (13 arquivos de teste; a suíte git do motor é omitida sem git)
pnpm run verify:self-contained                     # as specs de dependência resolvem do registro
pnpm run verify:artifacts                          # arquivos publicados presentes + index.mjs importável
pnpm run check:readmes                             # consistência dos cinco README
pnpm pack                                          # o tarball publicado
```

Não há etapa de compilação: ESM puro, `index.mjs` e `lib/` são os artefatos publicados.

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `session-sync`, `session`, `git`, `sync`, `cross-device`

## Contribuidores

- [@PerryLink](https://github.com/PerryLink) — criador e mantenedor: motor de espelho git, merge append-only mantendo ambos, comando `/sync` e ferramentas `sync_*`, modos automáticos, higienizadores e a documentação em cinco idiomas.

## Família de plugins DSH da PerryLink

Este projeto faz parte da família de plugins do DeepSeek Harness da [PerryLink](https://github.com/PerryLink). O registro fica recolhido abaixo para que cada README mantenha uma primeira tela curta; expanda para ver cada linha e seu status.

<details>
<summary>Expandir todos os plugins</summary>

| Plugin | Status |
|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** |  |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** |  |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** |  |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** |  |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** |  |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** |  |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** |  |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** |  |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | 🚫 RETIRADO — ver o README do repositório |

</details>

## Licença

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
