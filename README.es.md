<div align="center">

# 🔄 dsh-session-sync

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
| Harness | DeepSeek Harness `0.1.0-rc.6` |
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
| `backend` | `git` | Backend de sincronización; solo `git` está implementado (los backends cifrados están reservados y fallan alto) |
| `sessionRoot` | `''` | Raíz del almacén de sesiones; vacío = `$DSH_HOME/sessions` (si faltan ambos, falla la carga) |
| `repoDir` | `''` | Raíz del árbol de trabajo; vacío = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | Dirección remota (requerida antes de pull/push; status/diff funcionan sin ella) |
| `branch` | `main` | Nombre de la rama remota |
| `gitBin` | `git` | Ruta del ejecutable git |
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
- **Sin almacenamiento de credenciales.** El plugin no almacena credenciales; las credenciales de git viven en tu helper de credenciales normal. El backend de cifrado de extremo a extremo reservado no está implementado y las claves nunca entran en el repositorio de sincronización.
- **Endurecimiento de git.** git se ejecuta con `GIT_TERMINAL_PROMPT=0` y `GIT_OPTIONAL_LOCKS=0`, acotado por plazo y señal, con un límite de salida por flujo.
- **Falla cerrada.** La falta de respondedor de confirmación, de remoto o una ruta insegura rechaza la operación alto.

## Limitaciones conocidas

- **Solo backend git.** Los backends de cifrado de extremo a extremo (estilo age/GPG) están reservados pero no implementados; configurar uno falla alto al cargar. Hasta entonces, los bytes de sesión se almacenan sin cifrar en **tu** remoto git — usa un repositorio privado.
- **Se requiere git.** El plugin necesita el ejecutable `git` y el servicio `subprocess`; sin ellos, las operaciones de sincronización fallan con un motivo claro (los perfiles siguen arrancando).
- **Eventos de sesión en `0.1.0-rc.6`.** El harness aún no registra los tipos `sync/*`, por lo que en rc.6 los anexos al registro de sesión se omiten (las sesiones siguen cargando); el plugin los habilita automáticamente una vez que un host registra los tipos o soporta el envoltorio `ignorable`.
- **`approval` entre turnos.** `/sync` se ejecuta entre turnos, donde el canal `approval` no tiene un turno abierto al que adjuntarse; usa `confirmVia: userQuestions` para la sincronización por comando, o impulsa la sincronización mediante las herramientas dentro de un turno.

## Desarrollo

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs contra los peers rc.6 publicados
pnpm test                                          # node --test (6 suites; las suites git se omiten sin git)
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

## Licencia

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
