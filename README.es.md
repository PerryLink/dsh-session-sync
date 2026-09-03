<div align="center">

# 🔄 dsh-session-sync
- **Canal 1024 store**: `npm i -g dsh1024` una vez, luego `dsh1024 plugin --profile web add dsh-session-sync` (cuenta para el ranking de instalaciones de [deepseek1024.com](https://deepseek1024.com)).

**Sincronización de sesiones entre dispositivos para DeepSeek Harness — un espejo git dedicado de tu almacén de sesiones.**

*Sincroniza tus sesiones entre dispositivos, conserva ambos lados ante cualquier conflicto, nunca pierdas un turno.*

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

## Compatibilidad

| Superficie | Estado |
|---|---|
| Harness | DeepSeek Harness `0.1.2-alpha.5` (adaptado el 2026-09-02): el sobre de sesión conserva su campo ignorable solo para compatibilidad de lectura de logs almacenados - Session.append aún no puede estamparlo, por lo que el comportamiento de la puerta no cambia. |
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
- **Registro de sesión**: `sync/push`, `sync/pull` y `sync/conflict` están declarados en `types.d.ts`; se anexan solo cuando el host registra los tipos (ver Limitaciones conocidas). Todo lo escrito o mostrado se sanea.

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
- **Eventos de sesión en `0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2`/`0.1.2-alpha.2`/`0.1.2-alpha.3`/`0.1.2-alpha.5`.** El harness aún no registra los tipos `sync/*`, por lo que los anexos al registro de sesión se omiten (las sesiones siguen cargando); el plugin los habilita automáticamente una vez que un host registra los tipos o expone el envoltorio `ignorable` en `Session.append`.
- **`approval` entre turnos.** `/sync` se ejecuta entre turnos, donde el canal `approval` no tiene un turno abierto al que adjuntarse; usa `confirmVia: userQuestions` para la sincronización por comando, o impulsa la sincronización mediante las herramientas dentro de un turno.

## Desarrollo

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs contra los peers 0.1.2-alpha.5 publicados
pnpm test                                          # node --test (12 archivos de test; la suite git del motor se omite sin git)
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

Este proyecto es uno de los [33 complementos de DeepSeek Harness](https://github.com/PerryLink) mantenidos por [PerryLink](https://github.com/PerryLink). Si este te ayuda, probablemente los demás también:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisión de segundo modelo en la cadena de aprobación, con cierre en fallo por defecto | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes hijos en segundo plano durables con barra lateral de UI web, mensajería e interrupción | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Gobernanza de costes para DeepSeek Harness: presupuestos, carbono y latencia en un panel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente a /rewind de Claude Code: instantáneas, bifurcaciones de sesión, restauración de un solo uso | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migra sesiones, memoria, habilidades y CLAUDE.md de Claude Code a DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Control de escritorio nativo multiplataforma para DeepSeek Harness — Windows primero. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Historial de entrada estilo terminal para el compositor web: flechas, búsqueda Ctrl+R | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Comprobaciones de calidad de datasets y verificación de citas (el puente numérico opcional consumido aquí) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defensa contra inyección de prompts, jailbreak y fuga de secretos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardián de disciplina de ingeniería: interrogatorio de requisitos, puertas de pruebas, revisión adversaria | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Enrutamiento unificado de generación de imágenes estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de rendimiento de solo lectura para DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Informes de investigación deterministas para fondos mutuos públicos chinos | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | Integración de PR/issues de GitHub para DSH, cada escritura controlada por aprobación | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestación de investigación sectorial que sella sus entregables mediante el `ctx.researchReport.assemble` de este plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conocimiento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integración de modelos locales (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formato, autocompletado, acciones de código y renombrado LSP sobre servidores de lenguaje | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de enmascaramiento de PII: anonimiza en el límite del modelo, restaura en la capa de visualización | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | Panel de tiempo de ejecución MCP de solo lectura: comando /mcp + pestaña Settings con estado, herramientas y errores | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memoria entre sesiones controlada por aprobación: costura ctx.memory + SQLite + herramienta de memoria | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidad OpenTelemetry y Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Cambio de estilo en tiempo de ejecución equivalente a outputStyles de Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Reglas de permisos declarativas allow/deny/ask estilo Claude Code con auditoría | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conocimiento de desarrollo de plugins como habilidad de agente bajo demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de informes de investigación verificables con evidencia direccionada por contenido | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Puntuación de calidad multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fija sesiones en la barra lateral web con orden durable | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Paquete de habilidades de auditoría de seguridad: escaneo de secretos, revisión de dependencias y cadena de suministro | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Bucle de sesión con voz para DeepSeek Harness: háblale y escucha su respuesta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Pruebas de instalación y humo aisladas para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Traducción de parámetros entre proveedores y reparación determinista de JSON para DeepSeek Harness. | |

### Instalar desde el mercado de DSH Desktop

Todos los plugins de PerryLink pueden explorarse en el mercado integrado de DSH Desktop: **Market → Sources → add source → pegar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ seleccionarlo**. La instalación sigue pasando por la verificación de identidad npm del mercado y tu confirmación.

## Licencia

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
