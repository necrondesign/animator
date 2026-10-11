# 03. Мёртвые сервисы, телеметрия, мусор и мёртвый код

Часть аудита [AUDIT-2026-10](../AUDIT-2026-10.md). Пути указаны относительно корня
репозитория.

Авторы upstream уже сделали так, что редактор запускается без логина: хак в
`packages/haiku-creator/src/electron.js:33-94` и `:145-155` показывает выбор папки и
передаёт её прямо в plumbing. Но почти весь код сервисов на месте, и несколько частей
до сих пор стучатся на серверы Haiku во время работы, некоторые — с данными
пользователя.

## Код, который до сих пор отправляет данные (вырезать первым)

| Что | Где | Что отправляет | Когда |
|---|---|---|---|
| Mixpanel (редактор) | `packages/haiku-serialization/src/utils/Mixpanel.js` (два захардкоженных токена); вызовы в Creator.js (~15 мест), Plumbing.js, glass `src/react/index.js`, `Figma.js` | ОС и архитектура, названия событий, имена проектов и организаций, username как `distinct_id` | Всегда, выключателя нет |
| Mixpanel (опубликованные компоненты) | `packages/@haiku/core/src/Config.ts:24,52` (включён по умолчанию), `HaikuDOMRenderer.ts:981-1020` грузит `cdn.mxpnl.com`, `createRightClickMenu.ts:205` | Метаданные компонента, из браузеров конечных пользователей | Каждый компонент на любой странице, кроме localhost |
| Sentry (raven) | `haiku-creator/src/entry.js:13`, `haiku-glass/src/react/index.js:23`, `haiku-timeline/src/index.js:24`, `haiku-plumbing/src/Raven.js:7` (DSN с секретом); Raven грузится в `haiku-creator/index.html:23` | Отчёты о падениях, email пользователя, имя и путь проекта | При `NODE_ENV` staging или production; production — значение по умолчанию, если переменная не задана (`haiku-common/src/environments/index.ts:45`) |
| Carbonite (выгрузка при падениях) | `haiku-sdk-creator/src/dal/Carbonite.ts`, `dal/carbonite/proc.ts`, `bll/Error.ts:13,57` (S3-бакет `support.haiku.ai`); пункт меню в `haiku-common/src/electron/TopMenu.ts:144` | **Zip всего проекта пользователя** | При ошибках. Сейчас не срабатывает, потому что сначала запрашивает URL у inkstone |
| Activity ping | `haiku-sdk-creator/src/bll/User.ts:51` (`reportActivity` вызывает `inkstone.updates.check`), из `Creator.js:116,694`; также `Plumbing.js:816` | Сохранённый токен логина, если он есть | При действиях пользователя |
| Проверка «forkable» в меню правой кнопки | `@haiku/core/src/renderers/dom/createRightClickMenu.ts:110` (`inkstone-edge.haiku.ai`) | Имя организации и проекта | Контекстное меню каждого компонента, в браузерах конечных пользователей |

**Решение:** удалить всё. Если позже понадобятся отчёты о падениях или аналитика —
вернуть как opt-in с настройкой.

## B. Удалить после замены

### Inkstone SDK
`packages/@haiku/sdk-inkstone` (100K, `index.ts` — 1228 строк): логин, проекты,
снапшоты, сообщество, биллинг (Stripe), команды, Canny, Figma-токен, проверка
обновлений.

Кто от него зависит:
- `haiku-sdk-creator/src/bll/User.ts`: логин, `checkOnline`, лимит приватных проектов,
  проверки триала.
- `haiku-sdk-creator/src/bll/Project.ts`: список проектов, создание, форки, снапшоты;
  `share.haiku.ai` в строках 74 и 319.
- `haiku-plumbing/src/Plumbing.js:22,723,816` и `Master.js:7,891`: публикация пушит в
  remote и помечает снапшот как опубликованный.
- `haiku-serialization/src/bll/Figma.js:329`.

**Замена:** локальные заглушки, которые возвращают локальный список проектов и
отсутствие пользователя.

### UI логина, paywall и аккаунта в Creator.js
- Состояние — строки 136-159, загрузка пользователя — 688-735, проверка онлайна —
  508, кнопка апгрейда — 541, проверка триала `inkstone.organization.Role.FREE` — 722,
  `logOut` — 1781, `showAuthenticationUI` — 2025.
- Компоненты: `AuthenticationUI.js`, `LockoutModal.js`, `PublicPrivateOptInModal.tsx`,
  `ProxyHelpScreen.js` и `ProxySettingsScreen.js` (корпоративный прокси для доступа к
  API), `ChangelogModal.js`.
- В `ProjectBrowser.js:514` и `StageTitleBar.js` (publish/ShareModal) убрать элементы
  публикации и шаринга.
- Когда выбор папки останется единственной точкой входа, хак в electron.js нужно
  превратить в нормальный стартовый экран.

### Share-модалка
`haiku-ui-common/src/react/ShareModal/*`: ссылки на `code.haiku.ai` и
`share.haiku.ai`. Локальный экспорт Lottie, GIF и embed оставить — его уже включает
флаг `LocalAssetExport`.

### Figma
Коммит `9621235c1` только поменял текст ошибки и позволил задавать `FIGMA_CLIENT_ID`
через окружение. Обмен кода на токен по-прежнему идёт через inkstone
(`Figma.js:311-329`), поэтому импорт не работает.

**Решение:** настраиваемый URL self-hosted figma-auth или поддержка personal access
token.

### Автообновление
- Windows: `haiku-creator/src/electron.js:303-330`, `electron-updater` против
  `releases.haiku.ai`.
- Mac: `components/AutoUpdater.js` + `utils/autoUpdate.ts`, `HAIKU_AUTOUPDATE_SERVER`
  = `squirrel.haiku.ai` в `_config.js.handlebars:21`.

**Решение:** удалить или заменить проверкой GitHub Releases.

### URL по умолчанию
`haiku-common/src/environments/index.ts:41-43` — `www.haiku.ai` и `account.haiku.ai`
как fallback; также `.env.example` и `.env.staging.example`. Удалить.

### Битые ссылки
Мёртвые адреса: `docs.haiku.ai`, `help.haiku.ai`, haikuforteams, haikuanimator,
Twitter, приглашение в Slack. Где встречаются:
- `TopMenu.ts:160,421-445`;
- `Tour/Steps/TourFinishStep.jsx`, `Tour/Steps/TourPreviewModeStep.jsx`;
- `EventHandlerEditor/Snippets.js:82-88`, `library/Library.js:221`;
- `ShareModal/*`;
- `Git.js:9,13` (коммиттер по умолчанию `contact@haiku.ai`);
- `@haiku/core/src/renderers/dom/createRightClickMenu.ts:148-165`.

### `@haiku/sdk-client` (60K)
Хранение токена логина. Плюс `createProjectFiles.ts:255-259` пишет реестр
`reservoir.haiku.ai` в `.npmrc` и `.yarnrc` новых проектов. Код генерации проекта
оставить, строки про реестр убрать.

### `@haiku/cli` (96K)
11 вызовов inkstone; `login`, `list`, `clone`, `delete`, `install`, `update` без него
не работают. Оставить `init` и `generate` или удалить пакет.

### `haiku-vendor-legacy` (456K)
Около половины — `.js.map`. Семь старых копий библиотек, которые есть в npm
(css-mat4, css-value, gl-mat4, gl-vec3, mat4-decompose, to-style, xml-parser);
импортируются в 8 местах в haiku-common, haiku-glass, haiku-serialization.

### `haiku-fs-extra` (228K)
Копия fs-extra, используется в haiku-serialization. Заменить пакетом из npm.

## A. Удалить безопасно

### Релизы и CI
Всё построено на AWS, S3, Slack и Jenkins компании Haiku:
- `Jenkinsfile`, `build.sh`, `generate_windows_installer.bat`,
  `_config.js.handlebars`, `scripts/upload-cdn-core.js`;
- `scripts/distro-*.js`, особенно `distro-download-secrets.js`;
- `scripts/deploy.js`, `scripts/git-subtree-push.js`, `scripts/git-subtree-pull.js`,
  `scripts/push*.js`;
- `scripts/helpers/{initializeAwsService,s3CopyObject,uploadFileStream,uploadObjectToS3,uploadRelease,slackShout}.js`;
- `scripts/helpers/openSourcePackages.js`, `openSourceProjects.js`;
- `hooks/` (Python 2.7);
- в корневом `package.json`: devDependencies `aws-sdk` и `slack`; неиспользуемая
  зависимость `@haiku/player` (код только мапит её на `@haiku/core`); скрипт
  `republish-projects`, файла для которого нет.

### Прочее
- **`haiku-admin-cli`** (52K): инструмент сотрудников Haiku, требует inkstone.
- **Старая документация**:
  - `QA.md` (53K, ручной чеклист вокруг Intercom, Sentry, Mixpanel, Carbonite);
  - `PULL_REQUEST_TEMPLATE.md`;
  - `articles/` (312K, дамп старого help-центра);
  - `changelog/CHANGELOG.md` и `changelog.json`;
  - `changelog/public/*.json` (29 файлов) читает только `Changelog.js` для модалки
    changelog — уходит вместе с ней;
  - `packages/@haiku/core/ISSUE_TEMPLATE`.

### Тяжёлые фикстуры
- `packages/@haiku/core/demo`: 31 МБ, 131 проект. Тесты используют 4
  (AndroidFiltersV2, chinese-food, heartstry4, statetransitions), плюс
  `statetransitions` в `scripts/start.js`. Один `pup2` весит около 15 МБ.
- `packages/haiku-glass/test/projects`: 9 МБ, 25 проектов, используется только
  `simple`.
- `packages/haiku-timeline/test/projects`: 4.9 МБ, 9 проектов, используется только
  `complex`.
- Часть фикстур скопирована во все три папки: `lottie.json` из AliensRepro — 1.1 МБ × 3,
  файлы `UsersMatthew*.sketch` — по 552K.
- `packages/haiku-formats/test/goldens`: 34 МБ, из них три файла ContentAnimation —
  21 МБ. Заменить на маленькие goldens.
- `packages/@haiku/core/docs/assets`: 2.4 МБ.

### Неиспользуемые исходники (никто не импортирует)
- **Creator**: `BranchesDrawer.js`, `EventsPane.js`, `PseudoMenuButton.js`,
  `OfflineExportUpgradeModal.tsx`, `react/primitives/{Ellipse,Polygon,Rectangle}.js`.
- **Glass**: `Comment.js`, `Comments.js`, `EventsPopover.js`.
- **Timeline**: `CurrentTimelinePopover.js`, `PostMaxKeyframeArea.jsx`,
  `styles/{keyframeShared,popoverShared,propertyEditorShared}.js`.
- **Plumbing**: `ProjectFile.js`.
- **haiku-sdk-creator**: `codebase/CodebaseManager.ts`.
- **Serialization**: `FontComponent.js`, `ast/reifyOAST.js`.
- **Core**: `helpers/{PRNG,isMatrixableTransformArray,reactToMana}.ts`,
  `reflection/{isComplexValue,isSerializedFunction}.ts`,
  `renderers/dom/{domInjectStylesheet,insertTextChild,isEmptyChild}.ts`.
- **haiku-ui-common**: `helpers/{doPositionsMatch,inferUnitOfValue,isPositionOutside}.ts`
  и 10 иконок (Brackets, CheckmarkEmpty, ChevronDown, ChevronRight, CirclePlus, Event,
  EyeClose, EyeOpen, Family, TimelineIcon).
- **haiku-testing**: `src/{assertions,mock}.ts`.
- **Creator `bytecode-fixtures`** (460K): используется только как запасное превью
  старых облачных демо-проектов (`ProjectPreview.js:56`).

> Примитивы `react/primitives/*` формально не используются, но могут пригодиться как
> основа для инструментов рисования (см. фазу 5 плана). Перед удалением решить.

## C. Оставить

- **Фича-флаги** `haiku-common/config/experiments.json` (20 флагов +
  `scripts/add-experiment.js`). Выключены: `AllowBitmapImages`,
  `OutliningElementsOnStageFromStage`, `WindowMenu`. Остальные 17 включены — их можно
  сделать постоянными и убрать проверки.
- Иконки и entitlements в `build/`.
- `haiku-plumbing/bins/*.sketch` и `.ai` — шаблоны новых проектов.
- `.vscode`.
- `haiku-animator-screenshot.png` (820K, используется в README).
- `api.figma.com` в `Figma.js:12` — живой сервис Figma, не Haiku.

## Количество TODO/FIXME/HACK в `src`

| Пакет | Кол-во |
|---|---|
| serialization | 77 |
| creator | 31 |
| sdk-creator | 28 |
| core | 25 |
| formats | 22 |
| plumbing | 11 |
| glass | 11 |
| ui-common | 8 |
| timeline | 6 |
| common | 5 |
| cli | 5 |
| sdk-client | 3 |
| inkstone | 2 |

### Заметные
- `HaikuComponent.ts:54`: хак, пока не исправлена гонка при гидрации DOM.
- `Git.js:240`: предполагается, что репозиторием пользуется только один поток.
- `MasterModuleProject.js:57`: «has not been implemented yet».
- `bodymovinExporter.ts:725-1415`: градиентные обводки, паттерны, fx/fy и opacity
  обёртки не поддерживаются в Lottie-экспорте.
- `SplitPanel.js:126`: хак с принудительным reflow.
- Обходы циклических зависимостей в `AST.js`, `ActiveComponent.js`, `Artboard.js`.

Больших закомментированных блоков кода нет.
`@haiku/core/test/api/05_HaikuTypes.test.ts` почти целиком закомментирован.
