<div align="center">

# 🔄 dsh-session-sync

**DeepSeek Harness के लिए क्रॉस-डिवाइस सत्र सिंक — आपके सत्र स्टोर का एक समर्पित git मिरर।**

*अपने सत्रों को डिवाइसों के बीच सिंक करें, किसी भी टकराव में दोनों पक्ष रखें, कभी कोई टर्न न खोएँ।*

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

## संगतता

| सतह | स्थिति |
|---|---|
| Harness | DeepSeek Harness `0.1.1-rc.2` |
| Node | `^22.19.0 \|\| >=24.0.0` |
| प्लेटफ़ॉर्म | जहाँ भी `git` और DSH चलते हैं (git-आधारित मिरर; कोई प्लेटफ़ॉर्म-विशिष्ट कोड नहीं) |
| मॉडल | केवल-टेक्स्ट मॉडल पूर्ण रूप से समर्थित; विज़न या अतिरिक्त क्षमता की आवश्यकता नहीं |

## आपको क्या मिलता है

`dsh-session-sync` आपके DSH सत्र स्टोर को एक समर्पित git वर्कट्री में मिरर करता है और उसे एक ऐसे रिमोट से सिंक करता है जिसे **आप** नियंत्रित करते हैं — कोई क्लाउड सेवा नहीं, कोई तृतीय-पक्ष स्टोरेज नहीं:

- **`/sync` कमांड** — `status` (ब्रांच, सैनिटाइज़ किया गया रिमोट, आगे/पीछे, गंदी फ़ाइलें, फ़ोर्क), `diff`, `log`, `pull`, `push`, `help`।
- **`sync_status` / `sync_pull` / `sync_push` टूल** — मॉडल के लिए वही सतह, एक टर्न के अंदर।
- **Append-only टकराव समाधान** — सत्र लॉग append-only होते हैं; किसी भी विचलन पर प्लगइन **दोनों** पक्ष रखता है (स्थानीय संस्करण रखा जाता है, रिमोट संस्करण फ़ोर्क फ़ाइलों के रूप में संरक्षित रहता है) और कभी चुपचाप ओवरराइट नहीं करता। विचलित सत्र सत्र-स्तर पर भी फ़ोर्क हो सकते हैं।
- **स्वचालित मोड** — स्टार्ट पर pull, हर बंद टर्न के बाद push, और आवधिक pull, सभी कॉन्फ़िगर करने योग्य और प्रतिवर्ती।
- **पुष्टि-गेटेड लेखन** — `pull`/`push` पहले पूछते हैं (`userQuestions` या `approval` के माध्यम से); केवल-पठन सतहें कभी नहीं पूछतीं; बिना उत्तरदाता के ऑपरेशन बंद-असफल होता है।

```text
डिवाइस A                               रिमोट (आपका git रिपॉज़िटरी)                डिवाइस B
$DSH_HOME/sessions ──मिरर──▶ commit ──push──▶ [sessions] ──pull──▶ merge (दोनों रखें + fork)
```

## त्वरित शुरुआत

```sh
# 1. बंडल को अपने प्रोफ़ाइल में इंस्टॉल करें
dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"

# या npm से (प्रकाशित संस्करण)
dsh plugin --profile web add dsh-session-sync

# 2. इसे एक निजी git रिमोट की ओर इंगित करें और पंक्ति सत्यापित करें
dsh --profile web --dump-config | grep -A2 'id: session-sync'
```

फिर अपने प्रोफ़ाइल पैच में रिमोट सेट करें (एक **निजी** रिपॉज़िटरी आधार है) और सिंक करें:

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

## इंस्टॉल और अनइंस्टॉल

- **git चैनल** (नवीनतम `main`): `dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"` (`git+https://github.com/PerryLink/dsh-session-sync.git` से इंस्टॉल करने के बराबर)। कोई बिल्ड चरण नहीं — `index.mjs` और `lib/` ही प्रकाशित आर्टिफ़ैक्ट हैं।
- **npm चैनल** (प्रकाशित संस्करण): `dsh plugin --profile web add dsh-session-sync`।
- **tarball चैनल**: इस रिपॉज़िटरी में `pnpm pack` चलाएँ, फिर `dsh plugin --profile web add ./dsh-session-sync-<version>.tgz`।
- **अनइंस्टॉल**: `dsh plugin --profile web remove dsh-session-sync` (या प्रोफ़ाइल पैच से पंक्ति हटाएँ)।

## कॉन्फ़िगरेशन

सभी ट्यूनेबल Schemastery `Config` फ़ील्ड हैं (cordis.yml से बदले जा सकते हैं)। id-लक्षित ओवरराइड पूरी पंक्ति को बदल देता है — जो कुंजियाँ चाहिए उन्हें दोबारा लिखें। `cordis.patch.yml` हर कुंजी को इनलाइन दस्तावेज़ित करता है।

| कुंजी | डिफ़ॉल्ट | अर्थ |
|---|---|---|
| `enabled` | `true` | मास्टर स्विच; `false` कमांड, टूल, लिसनर और स्वचालित मोड हटा देता है |
| `backend` | `git` | सिंक बैकएंड; केवल `git` लागू है (एन्क्रिप्टेड बैकएंड आरक्षित हैं और तेज़ी से असफल होते हैं) |
| `sessionRoot` | `''` | सत्र स्टोर रूट; खाली = `$DSH_HOME/sessions` (दोनों अनुपस्थित होने पर लोड असफल) |
| `repoDir` | `''` | सिंक वर्कट्री रूट; खाली = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | रिमोट पता (pull/push से पहले आवश्यक; status/diff इसके बिना काम करते हैं) |
| `branch` | `main` | रिमोट ब्रांच का नाम |
| `gitBin` | `git` | git एक्ज़ीक्यूटेबल पथ |
| `autoPullOnStart` | `false` | प्लगइन माउंट होने पर एक बार pull करें (कॉन्फ़िग ही अनुमति है; पुनः पुष्टि नहीं) |
| `autoPushOnTurnEnd` | `false` | हर बंद टर्न के बाद push करें |
| `pullIntervalMinutes` | `0` | हर N मिनट में आवधिक pull (`0` = बंद, अधिकतम `10080`) |
| `confirmVia` | `auto` | पुष्टि चैनल: `auto` (पहले userQuestions, फिर approval), `userQuestions`, `approval` |
| `graceMs` | `10000` | git को मारने की अनुग्रह अवधि (ms) |
| `commandTimeoutMs` | `120000` | प्रति-कमांड टाइमआउट (ms) |
| `maxOutputBytes` | `262144` | प्रति-स्ट्रीम एकत्रित आउटपुट सीमा (बाइट्स) |
| `commitName` | `dsh-session-sync` | कमिट लेखक नाम |
| `commitEmail` | `dsh-session-sync@localhost` | कमिट लेखक ईमेल |
| `registerCommand` | `true` | `/sync` कमांड पंजीकृत करें |
| `registerTools` | `true` | tools सेवा उपस्थित होने पर `sync_*` टूल पंजीकृत करें |

आपके प्रोफ़ाइल पैच में ओवरराइड का उदाहरण:

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

## टूल और सतहें

| सतह | केवल-पठन | पुष्टि आवश्यक | नोट्स |
|---|---|---|---|
| `/sync status` | ✅ | — | ब्रांच, सैनिटाइज़ किया रिमोट, आगे/पीछे, गंदी फ़ाइलें, फ़ोर्क फ़ाइलें, अंतिम pull/push |
| `/sync diff` | ✅ | — | अनकमिटेड बदलाव + `HEAD..remote` आँकड़े (केवल-पठन) |
| `/sync log` | ✅ | — | सिंक रिपॉज़िटरी के अंतिम कमिट |
| `/sync pull` | | ✅ | Fetch + merge दोनों-रखें अर्थ के साथ; स्थानीय रखा जाता है, रिमोट फ़ोर्क के रूप में संरक्षित |
| `/sync push` | | ✅ | मिरर + commit + push; कभी force-push नहीं करता, अस्वीकृति पर एक बार सुलह करके पुनः प्रयास |
| `sync_status` | ✅ | — | मॉडल के लिए `/sync status` जैसे ही तथ्य |
| `sync_pull` | | ✅ | मॉडल-कॉल करने योग्य pull |
| `sync_push` | | ✅ | मॉडल-कॉल करने योग्य push |

## अनुमतियाँ और डेटा

- **अनुमतियाँ**: परिवर्तनकारी ऑपरेशन पुष्टि द्वार (`confirmVia`) को पार करते हैं; प्लगइन कभी भी हार्नेस की `userQuestions`/`approval` सेवाओं को फिर से लागू या बायपास नहीं करता। स्वचालित मोड कॉन्फ़िग अनुदान से आच्छादित हैं और कभी पुनः पुष्टि नहीं करते।
- **डेटा**: सिंक मेटाडेटा (डिवाइस id, अंतिम pull/push, अंतिम push head, अंतिम त्रुटि) `session-sync` स्टोरेज डोमेन में रहता है। सत्र फ़ाइलें अपारदर्शी बाइट्स के रूप में कॉपी होती हैं — प्लगइन उन्हें कभी पार्स नहीं करता। डिवाइस id क्रॉस-डिवाइस फ़ोर्क श्रेय के लिए सिंक रिपॉज़िटरी में `device.txt` में भी लिखा जाता है।
- **सत्र लॉग**: `sync/push`, `sync/pull`, और `sync/conflict` `types.d.ts` में घोषित हैं; वे केवल तभी जोड़े जाते हैं जब होस्ट प्रकारों को पंजीकृत करता है (ज्ञात सीमाएँ देखें)। जो कुछ भी लिखा या दिखाया जाता है वह सैनिटाइज़ किया जाता है।

## सुरक्षा सीमाएँ

- **कभी चुपचाप ओवरराइट नहीं।** Append-only तीन-तरफ़ा मर्ज किसी भी विचलन पर दोनों पक्ष रखता है; फ़ोर्क फ़ाइलें कभी नहीं हटतीं, और git कभी force-push, reset, rebase या ब्रांच स्विच नहीं करता।
- **पथ संरोधन।** फ़ाइलें अपारदर्शी बाइट्स के रूप में मिरर होती हैं, सिमलिंक अस्वीकृत होते हैं, और हर जोड़े गए पथ की संरोधन जाँच होती है (`PATH_UNSAFE` तेज़ी से असफल)।
- **सैनिटाइज़ किया आउटपुट।** रिमोट-URL क्रेडेंशियल, टोकन और `key=value` रहस्य मॉडल या लॉग तक पहुँचने से पहले हटा दिए जाते हैं; पथ प्रदर्शन अपनी रूट के बाहर सब कुछ अस्वीकार करता है।
- **कोई क्रेडेंशियल स्टोरेज नहीं।** प्लगइन स्वयं कोई क्रेडेंशियल संग्रहीत नहीं करता; git क्रेडेंशियल आपके सामान्य git credential helper में रहते हैं। आरक्षित एंड-टू-एंड एन्क्रिप्शन बैकएंड लागू नहीं है और कुंजियाँ कभी सिंक रिपॉज़िटरी में नहीं जातीं।
- **git कठोरीकरण।** git `GIT_TERMINAL_PROMPT=0` और `GIT_OPTIONAL_LOCKS=0` के साथ चलता है, समय-सीमा और सिग्नल से सीमित, प्रति-स्ट्रीम आउटपुट सीमा के साथ।
- **बंद-असफल।** पुष्टि उत्तरदाता, रिमोट की अनुपस्थिति, या असुरक्षित पथ ऑपरेशन को तेज़ी से अस्वीकार करता है।

## ज्ञात सीमाएँ

- **केवल git बैकएंड।** एंड-टू-एंड एन्क्रिप्शन बैकएंड (age/GPG शैली) आरक्षित हैं लेकिन लागू नहीं; एक को कॉन्फ़िगर करना लोड पर तेज़ी से असफल होता है। तब तक, सत्र बाइट्स **आपके** git रिमोट में अनएन्क्रिप्टेड रहते हैं — एक निजी रिपॉज़िटरी का उपयोग करें।
- **git आवश्यक।** प्लगइन को `git` एक्ज़ीक्यूटेबल और `subprocess` सेवा चाहिए; उनके बिना, सिंक ऑपरेशन स्पष्ट कारण से असफल होते हैं (प्रोफ़ाइलें बूट होती रहती हैं)।
- **`0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2` पर सत्र ईवेंट।** हार्नेस अभी `sync/*` प्रकार पंजीकृत नहीं करता, इसलिए सत्र-लॉग जोड़ छोड़ दिए जाते हैं (सत्र लोड होते रहते हैं); प्लगइन उन्हें स्वतः सक्षम करता है जब कोई होस्ट प्रकार पंजीकृत करता है या `Session.append` पर `ignorable` लिफ़ाफ़ा उजागर करता है।
- **टर्न के बीच `approval`।** `/sync` टर्न के बीच चलता है, जहाँ `approval` चैनल के पास जोड़ने के लिए कोई खुला टर्न नहीं होता; कमांड-संचालित सिंक के लिए `confirmVia: userQuestions` का उपयोग करें, या टर्न के अंदर टूल द्वारा सिंक चलाएँ।

## विकास

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # प्रकाशित 0.1.1-rc.2 peers के विरुद्ध tsc --checkJs
pnpm test                                          # node --test (6 सुइट; git सुइट बिना git के छोड़े जाते हैं)
pnpm run verify:self-contained                     # निर्भरता spec रजिस्ट्री से हल होती हैं
pnpm run verify:artifacts                          # प्रकाशित फ़ाइलें उपस्थित + index.mjs import योग्य
pnpm run check:readmes                             # पाँच-भाषा README संगतता
pnpm pack                                          # प्रकाशित tarball
```

कोई बिल्ड चरण नहीं: शुद्ध ESM, `index.mjs` और `lib/` ही प्रकाशित आर्टिफ़ैक्ट हैं।

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `session-sync`, `session`, `git`, `sync`, `cross-device`

## योगदानकर्ता

- [@PerryLink](https://github.com/PerryLink) — निर्माता और अनुरक्षक: git मिरर इंजन, append-only दोनों-रखें मर्ज, `/sync` कमांड और `sync_*` टूल, स्वचालित मोड, सैनिटाइज़र, और पाँच-भाषा दस्तावेज़।

## PerryLink DSH Plugin Family

यह प्रोजेक्ट [PerryLink](https://github.com/PerryLink) द्वारा अनुरक्षित [29 DeepSeek Harness प्लगइनों](https://github.com/PerryLink) में से एक है। अगर यह आपकी मदद करता है, तो बाकी भी करेंगे:

| Plugin | One-liner |
|---|---|
| [dsh-auto-review](https://github.com/PerryLink/dsh-auto-review) | अनुमोदन श्रृंखला पर दूसरे मॉडल से स्वतः-समीक्षा, डिफ़ॉल्ट रूप से असफल-बंद |
| [dsh-background-agents](https://github.com/PerryLink/dsh-background-agents) | Web UI साइडबार, संदेश और रुकावट के साथ स्थायी पृष्ठभूमि चाइल्ड एजेंट |
| [dsh-budget](https://github.com/PerryLink/dsh-budget) | DeepSeek Harness के लिए लागत प्रशासन: बजट, कार्बन और विलंबता एक पैनल में। |
| [dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind) | Claude Code /rewind-समतुल्य: स्नैपशॉट, सत्र फोर्क, एक-बार पुनर्स्थापन |
| [dsh-claude-move](https://github.com/PerryLink/dsh-claude-move) | Claude Code सत्र, स्मृति, skills और CLAUDE.md को DSH में स्थानांतरित करें |
| [dsh-click](https://github.com/PerryLink/dsh-click) | DeepSeek Harness के लिए क्रॉस-प्लेटफ़ॉर्म नेटिव डेस्कटॉप नियंत्रण — Windows पहले। |
| [dsh-composer-history](https://github.com/PerryLink/dsh-composer-history) | Web कंपोज़र के लिए टर्मिनल-शैली इनपुट इतिहास: तीर, Ctrl+R खोज |
| [dsh-defend](https://github.com/PerryLink/dsh-defend) | DeepSeek Harness के लिए प्रॉम्प्ट-इंजेक्शन, जेलब्रेक और सीक्रेट-लीक रक्षा। |
| [dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck) | इंजीनियरिंग-अनुशासन गार्ड: आवश्यकताएँ पूछताछ, परीक्षण द्वार, विरोधी समीक्षा |
| [dsh-draw](https://github.com/PerryLink/dsh-draw) | DeepSeek Harness के लिए एकीकृत स्थैतिक-छवि निर्माण रूटिंग। |
| [dsh-fast](https://github.com/PerryLink/dsh-fast) | DeepSeek Harness के लिए केवल-पठन प्रदर्शन निदान। |
| [dsh-github](https://github.com/PerryLink/dsh-github) | DSH के लिए GitHub PR/issues एकीकरण, हर लेखन अनुमोदन-द्वारित |
| [dsh-library](https://github.com/PerryLink/dsh-library) | DeepSeek Harness के लिए स्थानीय दस्तावेज़ ज्ञानकोश। |
| [dsh-local-ai](https://github.com/PerryLink/dsh-local-ai) | DeepSeek Harness के लिए स्थानीय-मॉडल (Ollama) एकीकरण। |
| [dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions) | भाषा सर्वरों पर LSP निदान, फ़ॉर्मेटिंग, पूर्णता, कोड क्रियाएँ और नाम बदलना |
| [dsh-mask](https://github.com/PerryLink/dsh-mask) | DeepSeek Harness के लिए PII मास्किंग मिडलवेयर — मॉडल तक पहुँचने से पहले व्यक्तिगत डेटा अनाम करता है, प्रदर्शन परत पर बहाल करता है। |
| [dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel) | केवल-पठन MCP रनटाइम पैनल: /mcp कमांड + स्थिति, टूल और त्रुटियों वाला सेटिंग टैब |
| [dsh-memento](https://github.com/PerryLink/dsh-memento) | अनुमोदन-द्वारित क्रॉस-सत्र स्मृति: ctx.memory seam + SQLite + memory टूल |
| [dsh-observe](https://github.com/PerryLink/dsh-observe) | DeepSeek Harness के लिए OpenTelemetry और Langfuse अवलोकनीयता निर्यातक। |
| [dsh-output-styles](https://github.com/PerryLink/dsh-output-styles) | Claude Code outputStyles-समतुल्य रनटाइम शैली स्विचिंग |
| [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | Claude Code-शैली घोषणात्मक allow/deny/ask अनुमति नियम, ऑडिट के साथ |
| [dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide) | माँग-पर एजेंट स्किल के रूप में प्लगइन-विकास ज्ञानकोश |
| [dsh-score](https://github.com/PerryLink/dsh-score) | DeepSeek Harness प्लगइनों के लिए बहु-आयामी गुणवत्ता स्कोरिंग। |
| [dsh-session-pin](https://github.com/PerryLink/dsh-session-pin) | Web साइडबार में सत्र पिन करें, स्थायी क्रम के साथ |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | DeepSeek Harness के लिए क्रॉस-डिवाइस सत्र सिंक — आपके सत्र स्टोर का एक समर्पित git मिरर। |
| [dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security) | सुरक्षा-ऑडिट स्किल पैक: सीक्रेट स्कैन, निर्भरता और आपूर्ति-श्रृंखला समीक्षा |
| [dsh-talk](https://github.com/PerryLink/dsh-talk) | DeepSeek Harness के लिए आवाज़-प्रथम सत्र लूप: बोलें और उत्तर सुनें। |
| [dsh-test-drive](https://github.com/PerryLink/dsh-test-drive) | DeepSeek Harness प्लगइनों के लिए पृथक इंस्टॉल-और-स्मोक परीक्षण। |
| [dsh-translate](https://github.com/PerryLink/dsh-translate) | DeepSeek Harness के लिए वेंडर पैरामीटर अनुवाद और नियतात्मक JSON मरम्मत। |

## लाइसेंस

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
