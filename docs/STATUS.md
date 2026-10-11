# Статус проекта

Единая точка правды: что есть, что сделано, что осталось. Обновляется после каждой фазы.
Последнее обновление: **2026-10-11**, после Фазы 2.

Связанные документы: [DECISIONS.md](DECISIONS.md) (почему так решили) ·
[AUDIT-2026-10.md](AUDIT-2026-10.md) (исходный аудит) · [LICENSING.md](../LICENSING.md) (правила лицензий).

---

## 1. Коротко

| | |
|---|---|
| Что это | Форк Haiku Animator: десктопный редактор интерактивных веб-анимаций (рантайм `@haiku/core`), с экспортом в Lottie, GIF и MP4 |
| Фокус | Интерактивные **веб-компоненты** (см. DECISIONS.md) |
| Лицензия | AGPL-3.0-or-later; рантайм `@haiku/core` и `@haiku/cli` — MIT |
| Платформа | Electron **44.4.5**, Node **24 LTS**, TypeScript **5.9**, yarn 1.22.22 |
| Состояние | Собирается и запускается на macOS (нативно Apple Silicon); 1104 теста зелёные; smoke-тест реального приложения проходит, в том числе на собранном `.app` |
| Фазы | 0 ✅ · 1 ✅ · 2 ✅ · **3 — следующая** · 4 · 5 |

---

## 2. Что ждёт твоего решения или действия

- [ ] **Право `workflow` для `gh`.** Без него GitHub отклоняет коммит с CI и релизным воркфлоу
      (коммит «ci: add CI and release workflows» лежит локально, не запушен). Команда: `gh auth refresh -h github.com -s workflow`.
- [ ] **Название продукта.** Сейчас сборки называются «Haiku» (`productName`, `appId com.Haiku…`,
      тексты в UI). Публиковать сборки под этим именем нельзя (LICENSING.md, правило 8). Нужно имя →
      затем меняем `productName`, `appId`, иконки и тексты UI, копирайты Haiku Systems оставляем.
- [ ] **Подпись macOS (по желанию).** Без сертификата Apple Developer сборки неподписанные:
      Gatekeeper ругается при первом запуске. Для подписи нужны `CSC_LINK`, `CSC_KEY_PASSWORD`,
      `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` в секретах репозитория.

---

## 3. Что есть в репозитории

### Пакеты (`packages/`)

| Пакет | Назначение | Лицензия |
|---|---|---|
| `@haiku/core` | Рантайм анимаций (bytecode → DOM), адаптеры vanilla/React/Vue/Angular, демо-галерея | MIT |
| `@haiku/cli` | CLI (большая часть команд требовала облако Haiku) | MIT |
| `@haiku/sdk-client`, `@haiku/sdk-inkstone` | Клиенты облака Haiku (мертво; на удаление в Фазе 3) | AGPL |
| `haiku-creator` | Главное окно редактора (React 15), main-процесс, «пекарня» кадров | AGPL |
| `haiku-glass` | Сцена (webview) | AGPL |
| `haiku-timeline` | Таймлайн (webview) | AGPL |
| `haiku-plumbing` | Node-бэкенд: WebSocket-сервер, файлы проекта, git (isomorphic-git) | AGPL |
| `haiku-serialization` | Модель проекта, AST bytecode, импорт Sketch/Figma/Illustrator (JS, без сборки) | AGPL |
| `haiku-formats` | Экспортёры: Lottie, HaikuStatic, GIF, MP4 | AGPL |
| `haiku-sdk-creator` | Envoy (RPC между процессами), обработчики | AGPL |
| `haiku-common`, `haiku-ui-common` | Общий код, меню, UI-компоненты | AGPL |
| `haiku-testing` | Тестовые хелперы, `isolate-home` | AGPL |
| `haiku-fs-extra`, `haiku-vendor-legacy` | Вендорные копии npm-библиотек (на замену в Фазе 4) | MIT/zlib |

### Команды

| Команда | Что делает |
|---|---|
| `yarn install` | Ставит всё; нативных модулей нет, Python не нужен |
| `yarn doctor` | Проверка Node/yarn |
| `yarn compile-all` | Сборка всех TS-пакетов по порядку зависимостей |
| `yarn typecheck-all` | Проверка типов исходников и тестов |
| `yarn test-all` | Все тесты; падает, если упал хоть один пакет |
| `yarn smoke` | Запуск реального приложения на тестовом проекте + снимок + рендер кадра экспорта |
| `yarn start` / `yarn go` | Запуск редактора для разработки |
| `yarn dist` / `yarn dist:dir` | Установщики / распакованное приложение в `dist/` |
| `yarn demos` (в `@haiku/core`) | Галерея демо рантайма в браузере (ручная регрессия) |

### CI/CD (`.github/workflows/`, ещё не запушены — см. раздел 2)
- `ci.yml` — на каждый push/PR: установка, doctor, compile, typecheck, tests, smoke (macOS arm64 + Linux).
- `release.yml` — по тегу `v*`: установщики под macOS/Windows/Linux → черновик GitHub Release.

---

## 4. Что сделано

### Подготовка форка
- Форк `necrondesign/animator`, коммиты только от `necrondesign` (noreply), без личных данных.
- Лицензионные правила, уведомления о стороннем коде, восстановлены потерянные zlib/MIT-уведомления.
  Коммит `a8c70dc96`.
- Полный аудит проекта и анализ похожих проектов — `docs/AUDIT-2026-10.md`, `docs/analysis/`.

### Фаза 0 — Гигиена ✅
- Удалена телеметрия: Mixpanel в рантайме (грузился на сайты пользователей) и в редакторе, Sentry,
  выгрузка архивов проектов (Carbonite), activity ping, брендированное меню правой кнопки.
- Удалена инфраструктура Haiku: Jenkins, AWS, Slack, релизные скрипты, Python 2-хуки, admin CLI.
- Удалены мёртвые документы и 19 неиспользуемых файлов; удалена чужая фикстура «All rights reserved».
- Исправлено: краш рантайма при импорте на Node 21+ (важно для SSR); `yarn setup` стирал `.git/hooks`.
- Коммиты `6225fb8c4`…`15ddd6f2e`.

### Фаза 1 — Чтобы собиралось ✅
- Нативные модули убраны: `nodegit` → isomorphic-git, `@ronomon/base64` → `Buffer`, `chokidar` 3,
  `ffmpeg-static` 5 (arm64), webpack 5, nodemon 3.
- Node 24 LTS, yarn 1.22.22 (corepack), TypeScript 5.9.3, ts-node 10.
- Тесты честные (падают при ошибках) и изолированы от реальной `~/.haiku`; отдельная проверка типов тестов.
- Исправлено ~90 ошибок типов, всплывших в TS 5, и несколько багов оригинала (см. DECISIONS.md).
- Коммиты `502f84590`, `21a81505c`, `7b56cb96c`.

### Фаза 2 — Electron ✅
- Electron 2.0.8 → 44.4.5, нативно Apple Silicon; все изменившиеся API переведены.
- Автообновление (на серверах Haiku) удалено.
- Упаковка electron-builder 26 из монорепозитория; подпись/нотаризация опциональны.
- e2e smoke-тест на Playwright (замена Spectron); CI и релизный воркфлоу.
- Исправлено: зависание экспорта при ошибке рендера кадра; «Exit» убивал терминал;
  `yarn start` игнорировал выбранный сценарий.
- Коммит `a2f32669c`; воркфлоу — локальный коммит «ci: add CI and release workflows» (не запушен).

---

## 5. Что осталось

### Фаза 3 — Починить сломанное (следующая)
- [ ] **Нормальный стартовый экран** вместо системных диалогов «Новый / Открыть проект».
- [ ] **Убрать облако Haiku из кода целиком:** `@haiku/sdk-inkstone` (заменить локальными заглушками),
      UI логина, paywall, триала, `LockoutModal`, `ShareModal`, Publish, прокси-экраны, дашборд;
      облачные команды `@haiku/cli`; запись реестра `reservoir.haiku.ai` в `.npmrc` новых проектов
      (`@haiku/sdk-client/src/createProjectFiles.ts`).
- [ ] **Убрать Raven/Sentry полностью** (сейчас выключен, но подключён) и заменить локальным обработчиком
      ошибок; удалить npm-зависимости `mixpanel`, `raven`, `raven-js`; заглушку `Mixpanel.js`.
      Попутно: `Error.ts` читает `data.exception[0]` вместо `exception.values[0]`.
- [ ] **Предупреждения как красные «Error»-плашки** — показываются пользователю даже в production.
- [ ] **Импорт из Figma** через личный токен (сейчас OAuth шёл через сервер Haiku и сломан).
- [ ] **Меню Export только на macOS** — открыть на Windows/Linux и проверить.
- [ ] **Баги:** undo не откатывает создание компонентов (upstream #1089); Lottie-экспорт, `case Image`
      без `break` (`haiku-formats/src/exporters/bodymovin/bodymovinExporter.ts:1207`).
- [ ] **Мёртвые ссылки** на `haiku.ai`, `docs/help.haiku.ai`, haikuforteams, Slack-инвайт (меню, тур,
      сниппеты, `ProjectShareDetails`, URL по умолчанию в `haiku-common/src/environments`).
- [ ] **Окно changelog** и `changelog/public` (история коммерческих релизов Haiku).
- [ ] **Фича-флаги:** 17 из 20 всегда включены — сделать постоянными и убрать проверки.
- [ ] **Ребрендинг** (после выбора названия): `productName`, `appId`, иконки, тексты UI, протокол `haiku://`.

### Фаза 4 — Модернизация
- [ ] **Безопасность рендереров:** IPC + preload вместо `nodeIntegration`/`@electron/remote`;
      `<webview>` → `WebContentsView`; включить `contextIsolation` и `sandbox`.
- [ ] **UI на React 18+** (сейчас 15.6 + radium, react-popover, better-react-spinkit).
- [ ] **`@haiku/core`:** ESM-сборка, публичный API, удалить IE/Modernizr/raf-шимы и мёртвые файлы,
      React-адаптер на хуках, Vue 3, решить судьбу Angular-адаптера (Angular 6), безопасный режим
      expressions без `new Function` (CSP).
- [ ] **Инструменты:** tslint → ESLint; уход с ts-node → TypeScript 7; демо на Vite/esbuild вместо webpack.
- [ ] **Вендорные копии** `haiku-vendor-legacy`, `haiku-fs-extra` → обычные npm-зависимости.
- [ ] **Устаревшие зависимости:** `request`, старые lodash-пакеты и пр.; предупреждения Node
      (`Buffer()`, `punycode`).
- [ ] **Производительность:** три копии модели проекта в трёх webview, синхронизация через WebSocket
      (upstream #1087).

### Фаза 5 — Новое
- [ ] Проверка обновлений через GitHub Releases.
- [ ] Интерактивность: модель State Machine (по образцу Rive), spring-easing.
- [ ] Lottie: импорт Lottie/dotLottie, превью на ThorVG, тесты по lottie-spec, маски/clipPath/текст
      в экспорте.
- [ ] Импорт из Penpot (открытая альтернатива Figma).
- [ ] Инструменты рисования (примитивы уже есть в `haiku-creator/src/react/primitives`).
- [ ] Идеи из Theatre.js для таймлайна (см. `docs/analysis/06-similar-projects.md`).

---

## 6. Известные ограничения и риски

- **CI ещё ни разу не запускался на GitHub** (воркфлоу не запушен). Linux-задача и smoke под xvfb
  проверены только логически — после первого запуска возможны правки.
- **Сборки Windows и Linux не проверены руками** — их впервые соберёт релизный воркфлоу.
- **Ручного QA редактора не было:** проверено smoke-тестом (запуск, открытие проекта, рендер кадра)
  и юнит-тестами. Сценарии вроде импорта Sketch/Illustrator, экспорта GIF/MP4 целиком, работы с
  таймлайном руками не проходились.
- **Рендереры работают в небезопасном режиме** (Node внутри окон, без изоляции) — долг до Фазы 4.
  Не открывать в редакторе непроверенные чужие проекты: expressions выполняются как код.
- **Облачные операции git** (clone/push/fetch/merge) отвечают «не поддерживается» — локальная
  история проекта работает.
- **Тесты UI-пакетов** (glass, timeline, creator) минимальны: 1–2 теста на пакет.
- **`~/.haiku` разработчика:** до изоляции тестов (Фаза 1) старые тесты перезаписали `registry.json`
  и очистили `auth` в реальной домашней папке. Теперь тесты работают во временной папке.
