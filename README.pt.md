<div align="center">

# 🔄 dsh-session-sync
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-session-sync` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

**Sincronização de sessões entre dispositivos para o DeepSeek Harness — um espelho git dedicado do seu armazenamento de sessões.**

*Sincronize suas sessões entre dispositivos, mantenha os dois lados em qualquer conflito, nunca perca um turno.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-session-sync/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-session-sync/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-session-sync?label=version)](https://github.com/PerryLink/dsh-session-sync/releases)
[![npm version](https://img.shields.io/npm/v/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)
[![npm downloads](https://img.shields.io/npm/dm/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibilidade

| Superfície | Status |
|---|---|
| Harness | DeepSeek Harness `0.1.1-rc.2` 0.1.2-alpha.5 (adaptado em 2026-09-02): o envelope de sessão mantém seu campo ignorable apenas para compatibilidade de leitura de logs armazenados - o Session.append ainda não consegue estampá-lo, então o comportamento da porta não muda. |
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
# 1. instale o bundle no seu perfil
dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"

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

## Instalação e desinstalação

- **Canal git** (último `main`): `dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"` (equivalente a instalar de `git+https://github.com/PerryLink/dsh-session-sync.git`). Sem etapa de compilação — `index.mjs` e `lib/` são os artefatos publicados.
- **Canal npm** (versões publicadas): `dsh plugin --profile web add dsh-session-sync`.
- **Canal tarball**: `pnpm pack` neste repositório, depois `dsh plugin --profile web add ./dsh-session-sync-<version>.tgz`.
- **Desinstalar**: `dsh plugin --profile web remove dsh-session-sync` (ou remova a linha do patch de perfil).

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
- **Registro de sessão**: `sync/push`, `sync/pull` e `sync/conflict` estão declarados em `types.d.ts`; eles são anexados somente quando o host registra os tipos (veja Limitações conhecidas). Tudo o que é gravado ou exibido é higienizado.

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
- **Eventos de sessão no `0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2`/`0.1.2-alpha.2`/`0.1.2-alpha.3`/`0.1.2-alpha.5`.** O harness ainda não registra os tipos `sync/*`, então os anexos ao registro de sessão são omitidos (as sessões continuam carregando); o plugin os habilita automaticamente quando um host registra os tipos ou expõe o envoltório `ignorable` em `Session.append`.
- **`approval` entre turnos.** `/sync` roda entre turnos, onde o canal `approval` não tem um turno aberto para se anexar; use `confirmVia: userQuestions` para sincronização por comando, ou conduza a sincronização pelas ferramentas dentro de um turno.

## Desenvolvimento

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs contra os peers 0.1.2-alpha.5 publicados
pnpm test                                          # node --test (12 arquivos de teste; a suíte git do motor é omitida sem git)
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

Este projeto é um dos [33 plugins de DeepSeek Harness](https://github.com/PerryLink) mantidos por [PerryLink](https://github.com/PerryLink). Se este ajuda você, os outros provavelmente também:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisão de segundo modelo na cadeia de aprovação, com falha fechada por padrão | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes filhos em segundo plano duráveis com barra lateral de UI web, mensagens e interrupção | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Governança de custos para DeepSeek Harness: orçamentos, carbono e latência em um painel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente ao /rewind do Claude Code: instantâneos, bifurcações de sessão, restauração de uso único | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migre sessões, memória, habilidades e CLAUDE.md do Claude Code para o DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Controle de desktop nativo multiplataforma para DeepSeek Harness — Windows primeiro. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Histórico de entrada estilo terminal para o compositor web: setas, busca Ctrl+R | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Verificações de qualidade de datasets e verificação de citações (a ponte numérica opcional consumida aqui) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defesa contra injeção de prompt, jailbreak e vazamento de segredos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardião de disciplina de engenharia: sabatina de requisitos, portões de teste, revisão adversária | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Roteamento unificado de geração de imagens estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de desempenho só de leitura para DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Relatórios de pesquisa deterministas para fundos mútuos públicos chineses | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | Integração de PR/issues do GitHub para o DSH, cada escrita controlada por aprovação | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestração de pesquisa setorial que sela as suas entregas através do `ctx.researchReport.assemble` deste plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conhecimento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integração de modelos locais (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formatação, autocompletar, ações de código e renomeação LSP sobre servidores de linguagem | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de mascaramento de PII: anonimiza no limite do modelo, restaura na camada de exibição | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | Painel de tempo de execução MCP somente leitura: comando /mcp + aba Settings com status, ferramentas e erros | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memória entre sessões controlada por aprovação: costura ctx.memory + SQLite + ferramenta de memória | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidade OpenTelemetry e Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Troca de estilo em tempo de execução equivalente ao outputStyles do Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Regras de permissão declarativas allow/deny/ask estilo Claude Code com auditoria | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conhecimento de desenvolvimento de plugins como habilidade de agente sob demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de relatórios de pesquisa verificáveis com evidência endereçada por conteúdo | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Pontuação de qualidade multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fixe sessões na barra lateral web com ordenação durável | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Pacote de habilidades de auditoria de segurança: varredura de segredos, revisão de dependências e cadeia de suprimentos | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Loop de sessão com voz para DeepSeek Harness: fale e ouça a resposta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Test drives isolados de instalação e smoke para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Tradução de parâmetros entre fornecedores e reparo determinístico de JSON para DeepSeek Harness. | |

## Licença

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
