# 01. Продукт: назначение, сценарии, возможности, архитектура

Часть аудита [AUDIT-2026-10](../AUDIT-2026-10.md). Состояние кода: upstream `9621235c1`.
Все пути указаны относительно корня репозитория.

## 1. Назначение

Haiku Animator — Electron-приложение для анимации импортированной векторной графики
на таймлайне. Собственный формат проекта — обычный JavaScript («bytecode»), который
выполняется веб-рантаймом `@haiku/core`; дополнительно есть экспорт в Lottie, GIF и MP4.
**Инструментов рисования нет**: вся графика приходит через импорт.

Собственная статья Haiku «What is Animator for?» (`articles/page-*.json`, дамп старого
help-центра) формулирует цель так: анимации и UI-компоненты, готовые для продакшена,
без передачи работы от дизайнера разработчику.

## 2. Сценарии использования

### 2.1. Lottie для iOS/Android
- Поток: импорт графики → анимация → Project › Export › Lottie.
- Экспортёр: `packages/haiku-formats/src/exporters/bodymovin/bodymovinExporter.ts`,
  вызывается через `packages/haiku-plumbing/src/publish-hooks/saveExport.ts`.
- При каждом сохранении plumbing автоматически пишет `code/<component>/lottie.json` и
  `static.json` (`haiku-plumbing/src/Master.js:931`).
- Известные ограничения (по коду и статьям): вложенные компоненты не анимируются;
  градиентные обводки и паттерны не реализованы (TODO). Подробно — в
  [04-runtime-and-exporters.md](04-runtime-and-exporters.md).

### 2.2. Веб-компоненты (DOM, React, Vue, Angular)
- Каждый проект — npm-пакет.
- `@haiku/sdk-client/src/createProjectFiles.ts` и `bootstrapSceneFilesSync.ts`
  генерируют `index.js`, `react.js`, `vue.js`, `angular-module.js`, а также
  `code/main/{code,dom,dom-embed,dom-standalone,react-dom,vue-dom,angular-dom}.js`.
- Адаптеры: `@haiku/core/src/adapters/{dom,react-dom,vue-dom,angular-dom}`.
- Standalone- и embed-бандлы собирает Rollup
  (`haiku-plumbing/src/project-folder/createCDNBundle.ts`).
- Изначально разработчики получали код через `haiku install` / Publish (облако) или
  `npm link` к папке проекта.

### 2.3. GIF и MP4
- Скрытое окно Electron рендерит последовательность PNG
  (`haiku-creator/src/bakery/electron.ts`); запуск — сообщение `bakePngSequence` в
  `/index.js` и `haiku-plumbing/src/envoy/getExporterListener.ts`.
- Кодирование ffmpeg: GIF через palettegen/paletteuse
  (`exporters/gif/gifExporter.ts`), видео через libx264
  (`exporters/video/videoExporter.ts`).

### 2.4. Импорт из дизайн-инструментов (со связью с исходником)
- **Sketch** (только macOS): вызывает
  `/Applications/Sketch.app/.../sketchtool export --format=svg` для слайсов и
  артбордов, результат пишется в `<file>.sketch.contents/`
  (`haiku-serialization/src/bll/Sketch.js`).
- **Illustrator**: пишет временный ExtendScript `.jsx` и открывает его через
  `open -g -b com.adobe.Illustrator` (Mac) или exe Illustrator (Windows), который
  экспортирует каждый артборд в SVG (`bll/Illustrator.js`).
- **Figma**: REST API (`api.figma.com/v1/files/:id`, затем ссылки на SVG) через OAuth.
  Обмен OAuth-кода на токен шёл через Inkstone, облачный API Haiku
  (`bll/Figma.js:311-329`). Сейчас нужен собственный auth-сервис или переменная
  `FIGMA_TOKEN` (`library/Library.js:145`).
- **Файлы**: SVG, `.ai`, `.sketch`; растровые картинки только за флагом
  `AllowBitmapImages`, он выключен (`library/importers/FileSystemImporter.tsx`).
- **Импорта Lottie нет.**

## 3. Возможности

### Сцена (`haiku-glass/src/react/Glass.js`, `overlays/*Mana.js`)
- Перемещение, масштаб, поворот; редактируемая точка трансформации; снаппинг;
  pinch-zoom.
- Прямое выделение вершин пути и bezier-ручек (морфинг формы).
- Группировка и разгруппировка, z-порядок, выравнивание (`AlignToolBox.js`),
  cut/copy/paste.
- Copy SVG, HTML-снимок, комментарии к элементам.
- Контекстное меню: «Create Component», «Edit in Sketch/Figma/Illustrator».
- Инструментов «перо» и «фигура» в UI нет: `haiku-creator/src/react/primitives/*`
  (Rectangle, Ellipse и др.) нигде не импортируется.

### Таймлайн (`haiku-timeline/src/components`)
- Строки свойств, keyframes, твины, выделение рамкой.
- Копирование, вставка и перемещение keyframes.
- Easing-кривые: enum `Curve` в `@haiku/core/src/api/index.ts:595`, семейства Пеннера
  ease-in/out/in-out, включая Back/Bounce/Elastic; редактор произвольной bezier-кривой
  (`BezierPopup.tsx`).
- Frame actions — обработчики `timeline:Default:N` (`FrameAction.js`).
- Управление воспроизведением; `ExpressionInput.js` с автодополнением.

### Expressions
Любое свойство может быть задано как `Haiku.inject(fn, ...params)`. Доступные входы:
`$user` (мышь/тач), `$window`, `$element`, `$timeline`, `$clock`, `$state`, `$helpers`,
`$payload`, `$index`, `$repeat`, `$if`, `$placeholder` (`HaikuComponent.ts:3634-3963`).

### Actions
- Редактор обработчиков событий со сниппетами (`EventHandlerEditor/*`).
- Полноценный редактор Monaco для `code.js` включён при открытии исходников
  (`CodeEditor/*`, эксперимент `CodeEditor:true`).

### States
`StateInspector/*`. Состояния можно читать и менять из actions и переходов.

### Компоненты и управление потоком
- Вложенные компоненты со своими таймлайнами и состояниями.
- `controlFlow.repeat/if/placeholder`.
- Встроенные контролы Text, Image, Font: `@haiku/core/components/controls`.

### Прочее
- Live-превью через `HaikuDOMAdapter` (`haiku-glass/src/react/Preview.js`).
- Undo/redo через стек действий; обучающий тур.
- Фича-флаги: `haiku-common/config/experiments.json`.

## 4. Архитектура

### Процессы
- `/index.js` (main-процесс Electron) форкает `HaikuHelper.js` — Node-процесс с
  `haiku-plumbing` (`Plumbing.js`).
- Plumbing поднимает WebSocket-сервер `ws` с токеном и сервер «Envoy» из
  `haiku-sdk-creator` (каналы exporter, user, project, glass, timeline, tour).
- Plumbing командует main-процессу `launchCreator`.

### UI
- `haiku-creator` — главное окно (React).
- Glass (сцена) и Timeline — отдельные `<webview>` (`Stage.js:165`, `Timeline.js:43`),
  каждый открывает своё WebSocket-соединение с plumbing
  (`haiku-glass/src/react/index.js:47`).

### Общая модель
- Каждое представление держит свою копию модели `haiku-serialization`
  (`bll/Project.js`, `ActiveComponent`, `Element`, `Keyframe`…).
- Правки передаются как вызовы методов, которые рассылаются всем представлениям, с
  проверками целостности (`Project.js:42-224`).
- Авторитетную запись на диск делает `Master.js`.

### Формат проекта на диске
Обычная папка, без бинарного `.haiku`-файла:
- `code/<component>/code.js` — bytecode: `metadata`, `states`, `eventHandlers`,
  `timelines` (`{selector: {prop: {frame: {value, curve}}}}`), `template` (дерево
  SVG/DOM).
- `designs/` — связанные исходники.
- `.haiku/comments.json`, `public/`, `package.json`.
- Версионирование: локальный git через nodegit — автокоммиты, semver-теги, ветки
  (`plumbing/src/Git.js`, `MasterGitProject.js`).

### Рантайм
`@haiku/core` (MIT) запускает часы на requestAnimationFrame (`HaikuClock.ts`). На
каждом кадре:
1. интерполирует keyframes таймлайна по кривым (`Interpolate.ts`, `Transitions.ts`);
2. вычисляет внедрённые expressions;
3. применяет 3D-матрицы раскладки (`Layout3D.ts`);
4. патчит DOM/SVG (`renderers/dom`).

Публичный API: play, pause, seek, `gotoAndPlay`, `setState`, события.

## 5. Облачные зависимости и что удалили при открытии исходников

### Inkstone
`@haiku/sdk-inkstone`: `inkstone.haiku.ai`, `share.haiku.ai`. Покрывал:
- логин и аккаунты;
- создание проектов, снапшоты, публикацию, форки в сообществе;
- биллинг, триалы, места в командах;
- проверку обновлений и обмен Figma-токена.

См. `sdk-inkstone/src/services.ts`.

### CLI
`@haiku/cli` (login, clone, install, update) и npm-«syndication» тоже завязаны на
Inkstone.

### Коммит «Prepare for open-sourcing» (`cfa54045a`, август 2021)
Удалил:
- экран авторизации и кнопку Publish;
- кнопку Dashboard и пункты меню Publish / My Account;
- удалённый git pull (`MasterGitProject.js` `pullRemote` закорочен).

Добавил хак со стартовым диалогом: выбрать пустую папку для нового проекта или
открыть существующий в обход всех сетевых хуков (`haiku-creator/src/electron.js`).

### Последующий коммит `9621235c1`
Сделал Figma OAuth client ID настраиваемым и отправляет пользователей к self-hosted
сервису figma-auth.

### Что осталось
- Мёртвый UI: `haiku-ui-common/src/react/ShareModal`, trial/lockout-интерфейс,
  дашборд (`ProjectBrowser.js`).
- Вызовы Mixpanel/Sentry и шаг `pushToRemote` в коде.
- `changelog/CHANGELOG.md` (последний релиз 5.1.x) в основном про триалы и объёмное
  лицензирование.

**Вывод:** локальное редактирование и все четыре вида экспорта (Lottie, GIF, MP4,
веб-бандлы) от облака не зависят.
