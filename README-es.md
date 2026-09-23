<div align="center">

# 🔄 dsh-session-sync
- **Canal 1024 store**: `npm i -g dsh1024` una vez, luego `dsh1024 plugin --profile web add dsh-session-sync` (cuenta para el ranking de instalaciones de [deepseek1024.com](https://deepseek1024.com)).

**Sincronización de sesiones entre dispositivos para DeepSeek Harness — un espejo git dedicado de tu almacén de sesiones.**

*Sincroniza tus sesiones entre dispositivos, conserva ambos lados ante cualquier conflicto, nunca pierdas un turno.*

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
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-session-sync?metric=downloads&lang=es)](https://dshfind.com/es/plugins/PerryLink/dsh-session-sync?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

</div>

---

## Compatibilidad

| Superficie | Estado |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.1.7-alpha.2` (tag de GitHub, verificado el 2026-09-22: cadena completa de puertas contra los peers `0.1.7-alpha.2` fijados). Línea de dependencias npm `0.1.7-alpha.2`, peers `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0`. (adaptado el 2026-09-22): el aviso de fork por conflicto lleva el source kind propio del plugin (producer-owned) - el harness retiró el kind compartido `plugin` y lo rechaza al releer. |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Plataformas | Cualquier lugar donde `git` y DSH se ejecuten (espejo basado en git; sin código específico de plataforma) |
| Modelo | Los modelos solo texto funcionan plenamente; no se requiere visión ni capacidad extra |

## Qué obtienes

`dsh-session-sync` refleja tu almacén de sesiones de DSH en un árbol de trabajo git dedicado y lo sincroniza con un remoto que **tú** controlas — sin servicio en la nube, sin almacenamiento de terceros:

- **Comando `/sync`** — `status` (rama, remoto saneado, delante/detrás, archivos sucios, forks), `diff`, `log`, `pull`, `push`, `help`.
- **Herramientas `sync_status` / `sync_pull` / `sync_push`** — la misma superficie para el modelo, dentro de un turno.
- **Resolución de conflictos append-only** — los registros de sesión son append-only; ante cualquier divergencia el plugin conserva **ambos** lados (la versión local se conserva, la remota se preserva como archivos fork) y nunca sobrescribe en silencio. Las sesiones divergentes también pueden bifurcarse a nivel de sesión.
- **Modos automáticos** — pull al iniciar, push tras cada turno cerrado y pull periódico, todos configurables y reversibles.
- **Escrituras con confirmación** — `pull`/`push` preguntan primero (mediante `userQuestions` o `approval`); las superficies de solo lectura nunca preguntan; sin respondedor la operación falla cerrada.

```text
dispositivo A                         remoto (tu repositorio git)              dispositivo B
$DSH_HOME/sessions ──espejo──▶ commit ──push──▶ [sessions] ──pull──▶ merge (conservar ambos + fork)
```

## Inicio rápido

```sh
# 1. instala el bundle en tu perfil
dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"

# o desde npm (versiones publicadas)
dsh plugin --profile web add dsh-session-sync

# 2. apúntalo a un remoto git privado y verifica la fila
dsh --profile web --dump-config | grep -A2 'id: session-sync'
```

Luego configura el remoto en tu parche de perfil (un repositorio **privado** es la base) y sincroniza:

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

## Instalación y desinstalación

- **Canal git** (último `main`): `dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"` (equivalente a instalar desde `git+https://github.com/PerryLink/dsh-session-sync.git`). Sin paso de compilación — `index.mjs` y `lib/` son los artefactos publicados.
- **Canal npm** (versiones publicadas): `dsh plugin --profile web add dsh-session-sync`.
- **Canal tarball**: `pnpm pack` en este repositorio, luego `dsh plugin --profile web add ./dsh-session-sync-<version>.tgz`.
- **Desinstalar**: `dsh plugin --profile web remove dsh-session-sync` (o elimina la fila del parche de perfil).

## Configuración

Todos los ajustes son campos de `Config` de Schemastery (modificables desde cordis.yml). Una sobrescritura dirigida por id reemplaza toda la fila — repite cada clave que necesites. `cordis.patch.yml` documenta cada clave en línea.

| Clave | Valor predeterminado | Significado |
|---|---|---|
| `enabled` | `true` | Interruptor maestro; `false` desregistra el comando, las herramientas, los oyentes y los modos automáticos |
| `backend` | `git` | Backend de sincronización: `git` (espejo en texto plano) o `encrypted` (contenido del espejo cifrado con age) |
| `sessionRoot` | `''` | Raíz del almacén de sesiones; vacío = `$DSH_HOME/sessions` (si faltan ambos, falla la carga) |
| `repoDir` | `''` | Raíz del árbol de trabajo; vacío = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | Dirección remota (requerida antes de pull/push; status/diff funcionan sin ella) |
| `branch` | `main` | Nombre de la rama remota |
| `gitBin` | `git` | Ruta del ejecutable git |
| `ageBin` | `age` | Ruta del ejecutable age (se sondea con `backend: encrypted`; si falta, degrada a texto plano) |
| `ageRecipient` | `''` | Destinatario age (clave pública o cadena de identidad); vacío = no se puede cifrar, degrada a texto plano |
| `ageIdentity` | `''` | Ruta a una clave secreta age sin frase de paso (para descifrar); vacío = degrada a texto plano |
| `autoPullOnStart` | `false` | Hace pull una vez al montar el plugin (la configuración es la concesión; sin reconfirmar) |
| `autoPushOnTurnEnd` | `false` | Hace push tras cada turno cerrado |
| `pullIntervalMinutes` | `0` | Pull periódico cada N minutos (`0` = apagado, máx. `10080`) |
| `confirmVia` | `auto` | Canal de confirmación: `auto` (primero userQuestions, luego approval), `userQuestions`, `approval` |
| `graceMs` | `10000` | Periodo de gracia para matar git (ms) |
| `commandTimeoutMs` | `120000` | Tiempo de espera por comando (ms) |
| `maxOutputBytes` | `262144` | Límite de salida recolectada por flujo (bytes) |
| `commitName` | `dsh-session-sync` | Nombre del autor del commit |
| `commitEmail` | `dsh-session-sync@localhost` | Correo del autor del commit |
| `registerCommand` | `true` | Registra el comando `/sync` |
| `registerTools` | `true` | Registra las herramientas `sync_*` cuando el servicio tools está presente |

Ejemplo de sobrescritura en tu parche de perfil:

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

## Herramientas y superficies

| Superficie | Solo lectura | Requiere confirmación | Notas |
|---|---|---|---|
| `/sync status` | ✅ | — | Rama, remoto saneado, delante/detrás, archivos sucios, archivos fork, último pull/push |
| `/sync diff` | ✅ | — | Cambios sin commit + estadística `HEAD..remote` (solo lectura) |
| `/sync log` | ✅ | — | Últimos commits del repositorio de sincronización |
| `/sync pull` | | ✅ | Fetch + merge con semántica de conservar ambos; lo local se conserva, lo remoto se preserva como forks |
| `/sync push` | | ✅ | Espejo + commit + push; nunca fuerza push, reconcilia y reintenta una vez ante rechazo |
| `sync_status` | ✅ | — | Los mismos datos que `/sync status` para el modelo |
| `sync_pull` | | ✅ | Pull invocable por el modelo |
| `sync_push` | | ✅ | Push invocable por el modelo |

## Permisos y datos

- **Permisos**: las operaciones mutadoras cruzan la puerta de confirmación (`confirmVia`); el plugin nunca reimplementa ni elude los servicios `userQuestions`/`approval` del harness. Los modos automáticos están cubiertos por la concesión de configuración y nunca reconfirman.
- **Datos**: los metadatos de sincronización (id de dispositivo, último pull/push, última cabecera de push, último error) viven en el dominio de almacenamiento `session-sync`. Los archivos de sesión se copian como bytes opacos — el plugin nunca los analiza. El id de dispositivo también se escribe en `device.txt` en el repositorio de sincronización para la atribución de forks entre dispositivos.
- **Registro de sesión**: `sync/push`, `sync/pull` y `sync/conflict` están declarados en `types.d.ts`; se anexan solo cuando el host registra los tipos (ver Limitaciones conocidas). Todo lo escrito o mostrado se sanea. El único mensaje duradero que el plugin escribe —el aviso de fork por conflicto— lleva el source kind propio del plugin (producer-owned, `dsh-session-sync`); el harness retiró el kind compartido `plugin` y lo rechaza al releer una sesión.

## Límites de seguridad

- **Nunca sobrescribe en silencio.** El merge de tres vías append-only conserva ambos lados ante cualquier divergencia; los archivos fork nunca se eliminan y git nunca fuerza push, resetea, rebase ni cambia de rama.
- **Contención de rutas.** Los archivos se reflejan como bytes opacos con enlaces simbólicos rechazados y cada ruta unida se comprueba por contención (`PATH_UNSAFE` falla alto).
- **Salida saneada.** Las credenciales de URL remota, los tokens y los secretos `key=value` se redactan antes de llegar al modelo o al registro; la visualización de rutas rechaza todo lo que esté fuera de su raíz.
- **Sin almacenamiento de credenciales.** El plugin no almacena credenciales; las credenciales de git viven en tu helper de credenciales normal. Las identidades/destinatarios age los gestionas tú, y las claves nunca entran en el repositorio de sincronización.
- **Endurecimiento de git.** git se ejecuta con `GIT_TERMINAL_PROMPT=0` y `GIT_OPTIONAL_LOCKS=0`, acotado por plazo y señal, con un límite de salida por flujo.
- **Falla cerrada.** La falta de respondedor de confirmación, de remoto o una ruta insegura rechaza la operación alto.

## Cifrado y modelo de amenazas

`backend: encrypted` añade una capa **age** opcional sobre el espejo: los bytes de sesión se cifran en archivos `encrypted/**/*.age` antes de commitear y subir, y se descifran de vuelta al espejo local en texto plano antes de fusionar. La fusión a tres bandas siempre se ejecuta en texto plano localmente, por lo que la semántica append-only de conservar ambos lados no cambia.

Qué **protege** el cifrado:

- **El contenido del espejo en reposo en el remoto.** Los archivos de sesión que subes son texto cifrado age; el host remoto, sus operadores y cualquiera que clone el repositorio no ven los bytes de sesión en claro sin la clave privada.

Qué **no** protege (la frontera):

- **Las claves e identidades age son tuyas.** Los archivos de destinatario/identidad nunca son distribuidos, almacenados ni rotados por el plugin. Si una clave se filtra, el contenido del espejo que protege queda expuesto. Usa una identidad sin frase de contraseña y mantenla fuera del repositorio.
- **El remoto sigue siendo en la práctica un repositorio privado.** Los metadatos de git — mensajes de commit, el `.gitignore`, la estructura de rutas `encrypted/`, los nombres de rama y la actividad de push/fetch — siguen siendo visibles para el host remoto. El cifrado oculta el *contenido*, no el hecho de que sincronizas, ni la forma de tu árbol de sesiones.
- **El texto plano sigue existiendo localmente.** El espejo en `<repoDir>/sessions/` es texto plano en disco; el cifrado protege la copia transmitida/remota, no el cifrado del disco local ni el almacén de sesiones en vivo.
- **La degradación elegante significa texto plano.** Con `backend: encrypted`, si falta `age`, o `ageRecipient`/`ageIdentity` están vacíos, el plugin cae al camino git en texto plano **y avisa explícitamente** en el estado/registro — nunca finge cifrar. Revisa la advertencia en `/sync status` antes de confiar en el remoto como cifrado.

Línea base: con `backend: git` (el predeterminado), los bytes de sesión se almacenan sin cifrar en **tu** remoto git — usa un repositorio privado.

## Limitaciones conocidas

- **El cifrado es opcional.** `backend: encrypted` añade una capa age (ver «Cifrado y modelo de amenazas» arriba); si falta `age` o las claves, cae a texto plano con una advertencia explícita. Con `backend: git` (el predeterminado), los bytes de sesión se almacenan sin cifrar en **tu** remoto git — usa un repositorio privado.
- **Se requiere git.** El plugin necesita el ejecutable `git` y el servicio `subprocess`; sin ellos, las operaciones de sincronización fallan con un motivo claro (los perfiles siguen arrancando).
- **Eventos de sesión en `0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2`/`0.1.2-alpha.2`/`0.1.2-alpha.3`/`0.1.2-rc.1`/`0.1.7-alpha.2`.** El harness aún no registra los tipos `sync/*`, por lo que los anexos al registro de sesión se omiten (las sesiones siguen cargando); el plugin los habilita automáticamente una vez que un host registra los tipos o expone el envoltorio `ignorable` en `Session.append`.
- **`approval` entre turnos.** `/sync` se ejecuta entre turnos, donde el canal `approval` no tiene un turno abierto al que adjuntarse; usa `confirmVia: userQuestions` para la sincronización por comando, o impulsa la sincronización mediante las herramientas dentro de un turno. La comprobación de turno abierto lee la proyección de sesión `turnBoundary` del host: una composición sin `@deepseek-ai/dsh-session-projection` no puede verificar el estado del turno y falla en cerrado con ese motivo.
- **Los artefactos privados del host no se sincronizan.** `session.lock` (el arriendo de sesión del harness) y los archivos de staging `session.migration.*.tmp` nunca se reflejan ni se eliminan: son estado de ejecución, no contenido sincronizable. Los registros de sesión (`session.jsonl`, `session.v[1-9]*.jsonl[.zstd]`) siguen siendo la carga útil reflejada.

## Desarrollo

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs contra los peers 0.1.7-alpha.2 publicados
pnpm test                                          # node --test (13 archivos de test; la suite git del motor se omite sin git)
pnpm run verify:self-contained                     # las specs de dependencias resuelven desde el registro
pnpm run verify:artifacts                          # archivos publicados presentes + index.mjs importable
pnpm run check:readmes                             # consistencia de los cinco README
pnpm pack                                          # el tarball publicado
```

No hay paso de compilación: ESM puro, `index.mjs` y `lib/` son los artefactos publicados.

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `session-sync`, `session`, `git`, `sync`, `cross-device`

## Contribuyentes

- [@PerryLink](https://github.com/PerryLink) — creador y mantenedor: motor de espejo git, merge append-only conservando ambos, comando `/sync` y herramientas `sync_*`, modos automáticos, saneadores y documentación en cinco idiomas.

## PerryLink DSH Plugin Family

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |


### Instalar desde el mercado de DSH Desktop

Todos los plugins de PerryLink pueden explorarse en el mercado integrado de DSH Desktop: **Market → Sources → add source → pegar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ seleccionarlo**. La instalación sigue pasando por la verificación de identidad npm del mercado y tu confirmación.

## Licencia

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
