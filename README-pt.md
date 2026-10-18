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

*English:* part of a 40+ plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

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

## PerryLink DSH Plugin Family

Este projeto é um dos **87 plugins ativamente mantidos** do DeepSeek Harness da [PerryLink](https://github.com/PerryLink). O registro da família tem **95** plugins — **5 congelados**, **3 retirados** — e fica recolhido abaixo para que cada README mantenha uma primeira tela curta. Expanda para ver cada linha, com o motivo na coluna Status.

<details>
<summary>Expandir os 95 plugins</summary>

| Plugin | Uma linha | Status |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>

### Instalar a partir do mercado do DSH Desktop

Todos os plugins PerryLink podem ser explorados no mercado integrado do DSH Desktop: **Market → Sources → add source → colar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ selecionar**. A instalação continua passando pela verificação de identidade npm do mercado e pela sua confirmação.

## Licença

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
