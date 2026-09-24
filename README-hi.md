<div align="center">

# 🔄 dsh-session-sync
- **1024 स्टोर चैनल**: एक बार `npm i -g dsh1024`, फिर `dsh1024 plugin --profile web add dsh-session-sync` ([deepseek1024.com](https://deepseek1024.com) इंस्टॉल रैंकिंग में गिना जाता है)।

**DeepSeek Harness के लिए क्रॉस-डिवाइस सत्र सिंक — आपके सत्र स्टोर का एक समर्पित git मिरर।**

*अपने सत्रों को डिवाइसों के बीच सिंक करें, किसी भी टकराव में दोनों पक्ष रखें, कभी कोई टर्न न खोएँ।*

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
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-session-sync?metric=downloads&lang=hi)](https://dshfind.com/hi/plugins/PerryLink/dsh-session-sync?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

</div>

---


<!-- star-cta -->
## ⭐ 如果它帮到了你

यह प्लगइन [DSH प्लगइन परिवार](https://github.com/PerryLink) का हिस्सा है (40+ प्लगइन, सभी Apache-2.0)। अगर यह उपयोगी लगे, तो **एक स्टार दें** — इससे कोई सुविधा अनलॉक नहीं होती, पर अगला व्यक्ति इसे खोज में आसानी से पा लेता है।

*English:* part of a 40+ plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.
## संगतता

| सतह | स्थिति |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.1.7-rc.2` (GitHub टैग, 2026-09-25 को सत्यापित: पिन किए गए `0.1.7-rc.2` peers के विरुद्ध पूर्ण गेट श्रृंखला)। npm निर्भरता-लाइन `0.1.7-rc.2`, peers `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0`। (2026-09-25 को अनुकूलित): टकराव फ़ोर्क सूचना प्लगइन का अपना producer-owned source kind रखती है - हार्नेस ने साझा `plugin` kind सेवानिवृत्त कर दिया है और पुनः-पठन पर उसे अस्वीकार करता है। |
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
| `backend` | `git` | सिंक बैकएंड: `git` (सादा-पाठ मिरर) या `encrypted` (age-एन्क्रिप्टेड मिरर सामग्री) |
| `sessionRoot` | `''` | सत्र स्टोर रूट; खाली = `$DSH_HOME/sessions` (दोनों अनुपस्थित होने पर लोड असफल) |
| `repoDir` | `''` | सिंक वर्कट्री रूट; खाली = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | रिमोट पता (pull/push से पहले आवश्यक; status/diff इसके बिना काम करते हैं) |
| `branch` | `main` | रिमोट ब्रांच का नाम |
| `gitBin` | `git` | git एक्ज़ीक्यूटेबल पथ |
| `ageBin` | `age` | age एक्ज़ीक्यूटेबल पथ (`backend: encrypted` पर जाँचा जाता है; अनुपस्थित होने पर सादे-पाठ पर डाउनग्रेड) |
| `ageRecipient` | `''` | age प्राप्तकर्ता (सार्वजनिक कुंजी या पहचान स्ट्रिंग); खाली = एन्क्रिप्ट नहीं हो सकता, सादे-पाठ पर डाउनग्रेड |
| `ageIdentity` | `''` | पासफ़्रेज़-रहित age गुप्त कुंजी का पथ (डिक्रिप्शन के लिए); खाली = सादे-पाठ पर डाउनग्रेड |
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
- **सत्र लॉग**: `sync/push`, `sync/pull`, और `sync/conflict` `types.d.ts` में घोषित हैं; वे केवल तभी जोड़े जाते हैं जब होस्ट प्रकारों को पंजीकृत करता है (ज्ञात सीमाएँ देखें)। जो कुछ भी लिखा या दिखाया जाता है वह सैनिटाइज़ किया जाता है। प्लगइन जो एकमात्र टिकाऊ संदेश लिखता है — टकराव फ़ोर्क सूचना — वह प्लगइन का अपना producer-owned source kind (`dsh-session-sync`) रखती है; हार्नेस ने साझा `plugin` kind सेवानिवृत्त कर दिया है और सत्र पुनः-पठन पर उसे अस्वीकार करता है।

## सुरक्षा सीमाएँ

- **कभी चुपचाप ओवरराइट नहीं।** Append-only तीन-तरफ़ा मर्ज किसी भी विचलन पर दोनों पक्ष रखता है; फ़ोर्क फ़ाइलें कभी नहीं हटतीं, और git कभी force-push, reset, rebase या ब्रांच स्विच नहीं करता।
- **पथ संरोधन।** फ़ाइलें अपारदर्शी बाइट्स के रूप में मिरर होती हैं, सिमलिंक अस्वीकृत होते हैं, और हर जोड़े गए पथ की संरोधन जाँच होती है (`PATH_UNSAFE` तेज़ी से असफल)।
- **सैनिटाइज़ किया आउटपुट।** रिमोट-URL क्रेडेंशियल, टोकन और `key=value` रहस्य मॉडल या लॉग तक पहुँचने से पहले हटा दिए जाते हैं; पथ प्रदर्शन अपनी रूट के बाहर सब कुछ अस्वीकार करता है।
- **कोई क्रेडेंशियल स्टोरेज नहीं।** प्लगइन स्वयं कोई क्रेडेंशियल संग्रहीत नहीं करता; git क्रेडेंशियल आपके सामान्य git credential helper में रहते हैं। age पहचान/प्राप्तकर्ता फ़ाइलें आपके प्रबंधन की हैं, और कुंजियाँ कभी सिंक रिपॉज़िटरी में नहीं जातीं।
- **git कठोरीकरण।** git `GIT_TERMINAL_PROMPT=0` और `GIT_OPTIONAL_LOCKS=0` के साथ चलता है, समय-सीमा और सिग्नल से सीमित, प्रति-स्ट्रीम आउटपुट सीमा के साथ।
- **बंद-असफल।** पुष्टि उत्तरदाता, रिमोट की अनुपस्थिति, या असुरक्षित पथ ऑपरेशन को तेज़ी से अस्वीकार करता है।

## एन्क्रिप्शन और ख़तरा मॉडल

`backend: encrypted` मिरर के ऊपर एक वैकल्पिक **age** परत जोड़ता है: सत्र बाइट्स कमिट और push से पहले `encrypted/**/*.age` फ़ाइलों में एन्क्रिप्ट होते हैं, और मर्ज से पहले स्थानीय सादे-पाठ मिरर में वापस डिक्रिप्ट होते हैं। तीन-तरफ़ा मर्ज हमेशा स्थानीय रूप से सादे-पाठ पर चलता है, इसलिए append-only दोनों-रखें अर्थ अपरिवर्तित रहते हैं।

एन्क्रिप्शन क्या **सुरक्षित** करता है:

- **रिमोट में मिरर सामग्री।** आप जो सत्र फ़ाइलें push करते हैं वे age सिफरटेक्स्ट होती हैं; रिमोट होस्ट, उसके संचालक और रिपॉज़िटरी क्लोन करने वाला कोई भी व्यक्ति निजी कुंजी के बिना सादे-पाठ सत्र बाइट्स नहीं देख सकता।

क्या यह **सुरक्षित नहीं** करता (सीमा):

- **कुंजियाँ और age पहचान आपके प्रबंधन की हैं।** प्राप्तकर्ता/पहचान फ़ाइलें प्लगइन द्वारा कभी शिप, स्टोर या रोटेट नहीं होतीं। कुंजी लीक होने पर उससे सुरक्षित मिरर सामग्री उजागर होती है। पासफ़्रेज़-रहित पहचान उपयोग करें और उसे रिपॉज़िटरी से बाहर रखें।
- **रिमोट व्यवहार में निजी रिपॉज़िटरी ही रहता है।** git मेटाडेटा — कमिट संदेश, `.gitignore`, `encrypted/` पथ संरचना, ब्रांच नाम और push/fetch गतिविधि — रिमोट होस्ट को दिखता रहता है। एन्क्रिप्शन *सामग्री* छिपाता है, यह तथ्य नहीं कि आप सिंक करते हैं, न ही आपके सत्र वृक्ष का आकार।
- **सादा पाठ स्थानीय रूप से रहता है।** `<repoDir>/sessions/` का मिरर डिस्क पर सादा पाठ है; एन्क्रिप्शन प्रेषित/रिमोट प्रति की रक्षा करता है, स्थानीय डिस्क एन्क्रिप्शन या लाइव सत्र स्टोर की नहीं।
- **graceful degradation का अर्थ सादा पाठ है।** `backend: encrypted` के साथ, यदि `age` गायब है, या `ageRecipient`/`ageIdentity` खाली है, तो प्लगइन सादे-पाठ git पथ पर गिर जाता है **और स्थिति/लॉग में स्पष्ट चेतावनी देता है** — यह कभी चुपचाप एन्क्रिप्ट होने का दिखावा नहीं करता। रिमोट को एन्क्रिप्टेड मानने से पहले `/sync status` में चेतावनी जाँचें।

आधार: `backend: git` (डिफ़ॉल्ट) के साथ सत्र बाइट्स **आपके** git रिमोट में अनएन्क्रिप्टेड रहते हैं — निजी रिपॉज़िटरी उपयोग करें।

## ज्ञात सीमाएँ

- **एन्क्रिप्शन वैकल्पिक है।** `backend: encrypted` एक age परत जोड़ता है (ऊपर «एन्क्रिप्शन और ख़तरा मॉडल» देखें); `age` या कुंजियाँ गायब होने पर यह स्पष्ट चेतावनी के साथ सादे-पाठ पर गिर जाता है। `backend: git` (डिफ़ॉल्ट) के साथ सत्र बाइट्स **आपके** git रिमोट में अनएन्क्रिप्टेड रहते हैं — एक निजी रिपॉज़िटरी का उपयोग करें।
- **git आवश्यक।** प्लगइन को `git` एक्ज़ीक्यूटेबल और `subprocess` सेवा चाहिए; उनके बिना, सिंक ऑपरेशन स्पष्ट कारण से असफल होते हैं (प्रोफ़ाइलें बूट होती रहती हैं)।
- **`0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2`/`0.1.2-alpha.2`/`0.1.2-alpha.3`/`0.1.2-rc.1`/`0.1.7-alpha.2` पर सत्र ईवेंट।** हार्नेस अभी `sync/*` प्रकार पंजीकृत नहीं करता, इसलिए सत्र-लॉग जोड़ छोड़ दिए जाते हैं (सत्र लोड होते रहते हैं); प्लगइन उन्हें स्वतः सक्षम करता है जब कोई होस्ट प्रकार पंजीकृत करता है या `Session.append` पर `ignorable` लिफ़ाफ़ा उजागर करता है।
- **टर्न के बीच `approval`।** `/sync` टर्न के बीच चलता है, जहाँ `approval` चैनल के पास जोड़ने के लिए कोई खुला टर्न नहीं होता; कमांड-संचालित सिंक के लिए `confirmVia: userQuestions` का उपयोग करें, या टर्न के अंदर टूल द्वारा सिंक चलाएँ। खुले टर्न की जाँच होस्ट के `turnBoundary` सत्र प्रोजेक्शन से होती है: `@deepseek-ai/dsh-session-projection` के बिना संयोजन टर्न स्थिति सत्यापित नहीं कर सकता और उसी कारण के साथ फ़ेल-क्लोज़्ड रहता है।
- **होस्ट-निजी आर्टिफ़ैक्ट सिंक नहीं होते।** `session.lock` (हार्नेस सत्र लीज़) और `session.migration.*.tmp` स्टेजिंग फ़ाइलें कभी मिरर या हटाई नहीं जातीं — ये रनटाइम स्थिति हैं, सिंक-योग्य सामग्री नहीं। सत्र लॉग (`session.jsonl`, `session.v[1-9]*.jsonl[.zstd]`) ही मिरर की जाने वाली पेलोड रहते हैं।

## विकास

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # प्रकाशित 0.1.7-alpha.2 peers के विरुद्ध tsc --checkJs
pnpm test                                          # node --test (13 टेस्ट फ़ाइलें; git इंजन सुइट बिना git के छोड़ी जाती है)
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


### DSH Desktop मार्केट से इंस्टॉल करें

सभी PerryLink प्लगइन DSH Desktop के बिल्ट-इन मार्केट में देखे जा सकते हैं: **Market → Sources → add source → पेस्ट करें** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ चुनें**। इंस्टॉलेशन मार्केट के npm-identity सत्यापन और आपकी पुष्टि से ही होता है।

## लाइसेंस

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
