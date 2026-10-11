# 02. Сборка, инструменты и устаревшие зависимости

Часть аудита [AUDIT-2026-10](../AUDIT-2026-10.md). Анализ сделан по файлам, без установки и
запуска. Пути указаны относительно корня репозитория.

**Главное.** Современную сборку блокируют пять вещей:
1. Electron 2.0.8 без arm64.
2. nodegit 0.20.3 (нативный модуль, нужен Python 2).
3. ffmpeg-static без бинаря под arm64.
4. Git-хуки на Python 2.
5. TypeScript 3.3, закреплённый жёстко.

## 1. Локальная разработка и релизный конвейер

### Локальная разработка (по `README.md`, `scripts/setup.js`, `scripts/start.js`)
1. `nvm use 8.15.1`, yarn 1.13.0, pyenv 2.7.16, `brew install libgcrypt` (нужен nodegit).
2. `yarn install && yarn setup`. Setup запускает `yarn install` до 10 раз, удаляет
   `.git/hooks` и заменяет его симлинком на `hooks/`.
3. `yarn start` задаёт вопросы интерактивно, `yarn go` берёт значения по умолчанию.
   Запускается `yarn compile-all` (`tsc` по пакетам, пропуск, если `.last-compile`
   новее `src/`), затем `yarn electron --inspect=9220 --remote-debugging-port=9222 .`.
4. `index.js` запускает дочерний процесс `HaikuHelper.js`, который поднимает сервер
   Plumbing на порту 1024; Plumbing шлёт `launchCreator`. `config.js` грузится только
   в production-сборках.
5. Дополнительно: `yarn watch-all`, `yarn lint-all`, `yarn test-all`. Файл `.env` может
   переопределить `HAIKU_API` и подобные (см. `.env.example`).

### Релиз (`build.sh`, `Jenkinsfile`)
- `distro-configure` рендерит `_config.js.handlebars` в `config.js`.
- `distro-download-secrets` скачивает `.p12`-сертификат подписи из S3-бакета
  `haiku-secrets`.
- `distro-prepare` копирует файлы в `source/`, компилирует, ставит production-
  зависимости, минифицирует через uglify-es.
- `distro-build` запускает electron-builder 21.2.0 с `forceCodeSigning: true`. Хук
  `afterSign` — `scripts/notarize.js` (старый electron-notarize 0.3 / altool). Zip
  для mac делается через `ditto`.
- `distro-upload` заливает в S3 `haiku-electron-releases-*` и пишет в Slack
  (`scripts/helpers/slackShout.js`).
- `distro-syndicate` делает копии в S3 и инвалидацию CloudFront.
- `distro-push` / `push.js`: git-subtree pull/push в
  `git@github.com:HaikuTeam/<pkg>.git`, `npm publish` пакетов `@haiku`,
  `upload-cdn-core` на `code.haiku.ai`.

### Что мертво для форка
- `scripts/deploy.js` падает при загрузке, если не заданы 8 переменных HAIKU_* для
  Slack/AWS, а `distro-build.js` его импортирует.
- Всё остальное, что завязано на частную инфраструктуру Haiku:
  - все шаги S3 и CloudFront;
  - Jenkins на ci.haiku.ai, его статусы на GitHub и сообщения в Slack;
  - git subtrees (remote захардкожен в `scripts/helpers/packages.js`);
  - npm publish под scope `@haiku`;
  - сертификат Developer ID компании Haiku;
  - автообновление: `releases.haiku.ai` (`haiku-creator/src/electron.js:310`) и
    `squirrel.haiku.ai`;
  - API inkstone, share и account (`@haiku/sdk-inkstone/src/config.ts`);
  - телеметрия mixpanel и raven.
- Переиспользовать можно только `yarn electron-builder --mac --publish=never`, после
  того как подпись будет убрана или заменена.

## 2. Ключевые устаревшие зависимости

| Зависимость | В репозитории | Комментарий |
|---|---|---|
| electron | 2.0.8 (закреплена, также `build.electronVersion`) | EOL, нет arm64 |
| electron-builder | 21.2.0 | старая |
| electron-updater | 3.2.3 | смотрит на мёртвые серверы Haiku |
| electron-notarize | ^0.3.0 | **устарел**: altool отключён, нужен @electron/notarize с notarytool |
| electron-rebuild | ^1.8.4 | **переименован** в @electron/rebuild |
| typescript | 3.3.3333 | `suppressImplicitAnyIndexErrors` — ошибка начиная с TS 5.5 |
| tslint | 5.13.1 + tslint-config-haiku | **устарел** |
| webpack | 4.29.6 (core, formats) | v4 падает на Node 17+ (OpenSSL md4) |
| rollup | ^0.53 | древний |
| react / react-dom | 15.6.2 (приложение), ^16 (devDep в core) | radium 0.18 заброшен |
| @types/react | принудительно 15.6.11 | |
| @babel/* | 7.0.0 (parser, traverse, generator) в serialization | |
| sass / node-sass | не используются | |
| monaco-editor | 0.15.6 | |
| codemirror | ^5.28 | |
| spectron | 3.8.0 (+ electron-chromedriver 1.8, webdriverio 4) | **устарел** |
| tape / tap-spec / nyc | 4.9 / 4 / 13 | ts-node 6 слишком старый для TS 5 |
| lodash | 4.17.x + много отдельных пакетов `lodash.*` | |
| request | 2.8x (cli, sdk-*, serialization) | **устарел** |
| uglify-es | 3.3 | **заброшен** |
| node-gyp | ^3.6.3 | только Python 2 |
| prettier / svgo / jsdom / ws | 1.x / 1.x / 11 / 3.2.0 | старые |
| chokidar | 1.7 (тянет fsevents 1.2.7) | нативный, ломается на новых Node |

### Нативные и бинарные модули
- `nodegit` 0.20.3 (`haiku-plumbing/src/Git.js`, `MasterGitProject.js`).
- `@ronomon/base64` (аддон на nan, `AssetUtils.ts`).
- `fsevents` 1.x.
- `ffmpeg-static` 2.4.0 скачивает бинарь; в `package.json` он указан в
  `extraResources` как `bin/${platform}/${arch}`.

sharp, puppeteer и canvas не используются.

### Electron API, которые нужно мигрировать
- Модуль `remote` (удалён в Electron 14): Glass.js, Timeline.js, `dom.js` в creator,
  `Creator.js`, `FileSystemImporter.tsx`, `Lottie.tsx`.
- Glass и Timeline встроены в Creator как теги `<webview>`, которые выключены по
  умолчанию начиная с Electron 5.
- Ни одно окно не задаёт `webPreferences`, поэтому код полагается на старые значения
  по умолчанию: `nodeIntegration: true`, `contextIsolation: false`.

## 3. Что гарантированно сломается на Apple Silicon, Node 20+ и только Python 3

- **Electron 2.0.8**: нет сборки darwin-arm64 (arm64 появился в Electron 11). x64 может
  запуститься через Rosetta, но на macOS 15+ это не поддерживается.
- **nodegit 0.20.3**: нужен node-gyp 3 + Python 2 + заголовки libgcrypt/openssl; под
  Node 20 и современный Electron ABI не скомпилируется. То же с `@ronomon/base64`
  (старый nan) и fsevents 1.x.
- **Git-хуки**: `hooks/post-checkout` и `hooks/post-merge` начинаются с
  `#!/usr/bin/env python2.7` и используют `print` из Python 2. После того как
  `yarn setup` их подключит, каждый checkout и merge будет падать.
- **ffmpeg-static 2.x**: нет бинаря `darwin/arm64`, путь в `extraResources` ломается.
- **webpack 4** на Node 17+: `ERR_OSSL_EVP_UNSUPPORTED`.
- **ts-node 6 и TS 3.3** не парсят новые `@types/node`; `@types/node` закреплён на
  10.12.30 через `resolutions`.
- **yarn 1.13 с `--frozen-lockfile`**: в lockfile `request` 2.79 и много пакетов с
  известными уязвимостями. Переустановка может пройти, но нативные сборки упадут.
- **Проверки версий**: `scripts/helpers/checkNodeVersion.js` и `checkYarnVersion.js`
  только выводят предупреждения и ничего не останавливают.
- **Нотаризация** через electron-notarize 0.3 (altool) Apple больше не принимает.

## 4. Тестовая инфраструктура

### Раннер
tape + tap-spec везде, запуск через
`cross-env NODE_ENV=test ts-node -r tsconfig-paths/register -P tsconfig.all.json`.
Покрытие: nyc + `istanbul-reporter-cobertura-haiku`.

### Исключения
- haiku-serialization: обычный tape на `.js`, скрипт заканчивается на `|| true`,
  поэтому никогда не падает.
- haiku-fs-extra: mocha / standard / istanbul, пропускается как «unbuildable».
- haiku-plumbing: e2e на Spectron (`test/e2e/*.e2e.ts`, `test/IntegrationTest.ts`).

### Количество тестовых файлов (около 105)
| Пакет | Файлов |
|---|---|
| @haiku/core | 38 |
| haiku-serialization | 22 |
| haiku-plumbing | 10 |
| haiku-sdk-creator | 8 |
| haiku-common | 6 |
| haiku-formats | 5 (golden-файлы) |
| @haiku/cli | 4 |
| остальные | по 0–2 |

### CI
Только `Jenkinsfile`, он мёртв. Конфигов `.github`, Travis или CircleCI нет.

### Проблемы
- `scripts/test-all.js` ловит падение каждого пакета и идёт дальше, поэтому общий
  прогон всегда завершается с кодом 0.
- `.vscode/launch.json` содержит конфиги для подключения Chrome-отладчика.

## 5. Порядок модернизации

1. **Чтобы инструменты не падали**:
   - переписать хуки на Node/Python 3 или убрать шаг с симлинком из `setup.js`;
   - сделать загрузку `scripts/deploy.js` ленивой или терпимой к отсутствию
     переменных;
   - убрать из сборки вызовы Slack, S3 и subtree;
   - поднять `.nvmrc` до Node 18/20; перейти на новый yarn (classic 1.22 или Berry с
     `nodeLinker: node-modules`).
2. **Убрать или заменить нативные модули**:
   - nodegit → `isomorphic-git` или вызов системного `git`;
   - `@ronomon/base64` → `Buffer`;
   - chokidar 1 → chokidar 3+;
   - ffmpeg-static 2 → 5+ (есть arm64) и исправить путь в `extraResources`.

   После этого node-gyp не нужен.
3. **TypeScript 5**: убрать `suppressImplicitAnyIndexErrors`, обновить ts-node и
   tsconfig-paths, открепить `@types/node`, исправлять ошибки типов пакет за пакетом
   (`compile-all` идёт в порядке зависимостей).
4. **Electron поэтапно**:
   - сначала 2 → 11+ ради arm64, затем до актуальной версии;
   - по пути явно задать `nodeIntegration: true`, `contextIsolation: false`,
     `webviewTag: true`;
   - `remote` заменить на `@electron/remote` как временное решение, потом на IPC;
   - electron-builder до последней версии, `@electron/notarize`, подпись
     опциональной; electron-updater убрать или перенаправить.
5. **Инструменты сборки**: webpack 5 или esbuild, актуальный rollup, terser вместо
   uglify-es.
6. **Линт и тесты**:
   - tslint → ESLint + typescript-eslint;
   - tape оставить, но `test-all` должен падать с ненулевым кодом;
   - Spectron убрать (замена — `_electron` из Playwright);
   - workflow GitHub Actions на macOS arm64.
7. **Библиотеки приложения**:
   - React 15 → 16.14/17 (нужно заменить radium, react-popover, better-react-spinkit);
   - Babel 7.x последней версии;
   - request → node-fetch/undici;
   - monaco последней версии.
8. **Вычистить сервисы Haiku**: URL inkstone/share, mixpanel, raven,
   `squirrel.haiku.ai` в `_config.js.handlebars`.

## Ключевые файлы
- `package.json`
- `Jenkinsfile`
- `scripts/deploy.js`
- `scripts/distro-build.js`
- `scripts/start.js`
- `hooks/post-checkout`
- `packages/haiku-plumbing/package.json`
- `packages/haiku-creator/src/electron.js`
