# 04. Рантайм @haiku/core, экспортёры, формат проекта, недоделки

Часть аудита [AUDIT-2026-10](../AUDIT-2026-10.md). Пути указаны относительно
`packages/`, если не сказано иное.

## 1. @haiku/core

### Почему 1474 файла
Почти всё — демо-проекты; скомпилированного кода в репозитории нет.
- `demo/`: 1261 файл, 31 МБ, 131 проект в `demo/projects/*`.
  - В каждом: рукописный bytecode (`code/<scene>/code.js`, всего 190) и около 7
    сгенерированных однострочных обёрток (`dom.js`, `react-dom.js`, `vue-dom.js`,
    `angular-dom.js`, `dom-embed.js`, `dom-standalone.js`).
  - У части есть `lottie.json` (36) или `static.json` (33); у 63 — `note.txt` с
    описанием воспроизведения бага. Один `pup2` весит 15 МБ.
- `src/`: 146 файлов, около 920 KB. Из них 61 — вендорный код в `src/vendor/`, в
  основном 37 файлов easing из just-curves.
- `test/`: 41 tape-тест (unit, api, render, perf).
- `lib/` и `dist/` нет. `index.js` и `dom/*/index.js` делают `require('./lib/...')`,
  поэтому пакетом нельзя пользоваться до компиляции через `tsc`.

### Что делает во время работы
Интерпретирует «bytecode» — обычный JS-объект с полями:
- `template` — JSON-дерево элементов;
- `timelines` — селектор → свойство → keyframe в мс → `{value, curve}`;
- `states`, `eventHandlers`, `options`, `helpers`.

Основные модули:
- `src/HaikuComponent.ts` (4149 строк): разворачивание дерева, интерполяция
  keyframes, управление потоком repeat/if/placeholder, внедрение expressions.
- `HaikuContext.ts`: монтирование и тики.
- `HaikuClock.ts`: один общий rAF-цикл через `window.haiku[VERSION]`
  (`HaikuGlobal.ts`).
- `HaikuTimeline.ts`: play, seek, gotoAndStop.
- `Layout3D.ts` и `layout/`: матрицы 2.5D-трансформаций.
- `renderers/dom/HaikuDOMRenderer.ts`: единственный рендерер.

Expressions вычисляются через `new Function` (`HaikuTimeline.ts:35`,
`HaikuComponent.ts:1628`, `reflection/functionSpecificationToFunction.ts:12`), поэтому
под строгим CSP не работают.

### Публичный API
`require('@haiku/core/dom')(bytecode, config)` возвращает фабрику,
`factory(mountEl)` — компонент. Типы в `src/api/index.ts`, значения по умолчанию в
`src/Config.ts`. Глобальные переменные с версией в ключе (`window.HaikuResolve`,
`window.HaikuCore`) задаются в `adapters/dom/HaikuDOMAdapter.ts`.

### Адаптеры фреймворков (`src/adapters/`)
- Vanilla: `dom/`.
- React: `react-dom/`, использует устаревший `componentWillReceiveProps`.
- Vue: `vue-dom/`.
- Angular: `angular-dom/`, закреплён на Angular 6; пустой `// TODO.` в строке 226.
- Точки входа: `dom/{react,vue,angular}/index.js`.

### Сборка и публикация
- `tsc` собирает `lib/`.
- `scripts/bundle.ts`: Rollup 0.53 + uglify-es собирают IIFE-бандлы, только для
  адаптеров `dom` и `vue-dom`.
- Корневой `scripts/upload-cdn-core.js` заливал их в S3
  `code.haiku.ai/scripts/core/HaikuCore.<ver>.js` и `.latest.js`. Этого AWS-аккаунта
  больше нет.
- Публикация в npm: корневой `scripts/publish-package.js`.

### Устаревшие допущения о браузерах
- `renderers/dom/applyLayout.ts:6-20` определяет IE и Edge (`isIE.ts`, `isEdge.ts`,
  `getWindowsBrowserVersion.ts`) и проверяет preserve-3d через Modernizr
  (`vendor/modernizr`).
- `vendor/raf` и `vendor/performance-now` — ненужные полифиллы; `vendor/assign` —
  шим `Object.assign`.
- **Телеметрия включена по умолчанию**: `Config.ts:24` содержит захардкоженный токен
  Mixpanel, `HaikuDOMRenderer.ts:981-1010` вставляет скрипт с CDN Mixpanel на
  страницы конечных пользователей.
- `createRightClickMenu.ts` добавляет брендированное контекстное меню со ссылкой на
  haikuforteams.com.

## 2. haiku-formats

Экспортёры подключены в `src/exporters/index.ts`, enum — в
`haiku-sdk-creator/src/exporter/index.ts`.

| Формат | Файл | Состояние |
|---|---|---|
| Lottie/Bodymovin | `bodymovin/bodymovinExporter.ts` (1610 строк) + utils, transformers, enums | Самый полный. Есть golden-тесты (`test/goldens/bodymovin`) |
| HaikuStatic | `haikuStatic/haikuStaticExporter.ts` | Заменяет expressions фиксированными значениями, встраивает подкомпоненты. Готов |
| GIF | `gif/gifExporter.ts` | Тонкая обёртка над ffmpeg в два прохода (палитра, затем применение) |
| Видео (mp4) | `video/videoExporter.ts` | ffmpeg libx264, yuv420p, размеры округляются до чётных |
| Кадр (still) | — | Не в formats; plumbing сохраняет один PNG |

### Ограничения Lottie-экспорта
- Поддерживаются только rect, circle, ellipse, line, polygon, polyline, path, g, use,
  image и линейные/радиальные градиенты (`src/svg/enums.ts`).
- **Нет поддержки масок, clipPath, фильтров (blur/shadow), текста и паттернов.**
- Градиенты на обводке не поддерживаются (`bodymovinExporter.ts:777`);
  `gradientTransform`, `fx`, `fy` игнорируются (`:864`, `:908`).
- Defs должны лежать под корневым SVG (`:725-726`); z-порядок картинок угадывается
  (`:688`).
- Opacity и цвет обёртки нельзя анимировать (`:1233-1234`).
- Квадратичные сегменты и дуги в путях бросают ошибку (`bodymovinUtils.ts:267`);
  hex-цвета из 4 и 8 цифр не поддерживаются (`bodymovinTransformers.ts:40`).
- Кривые работают только для чисел (`curves.ts:316`).
- **Вероятный баг**: `bodymovinExporter.ts:1207-1210`, у `case Image/Img` нет `break`,
  поэтому картинки проваливаются ещё и в `handleTransclusion`.

### Как делаются кадры для GIF и видео
Ни puppeteer, ни захвата canvas.
- `haiku-creator/src/bakery/electron.ts:60-130` открывает скрытое окно `BrowserWindow`,
  делает скриншот каждого кадра через `capturePage()` и пишет
  `png-<fps>/frame-%07d.png`.
- Запускается по IPC из `haiku-plumbing/src/envoy/getExporterListener.ts:32-60`.
- Затем ffmpeg кодирует кадры нативным бинарём из `ffmpeg-static`
  (`src/exporters/ffmpeg.ts`); в production он копируется рядом с `app.asar`.

Весь конвейер зависит от Electron.

## 3. haiku-serialization

### Формат файлов
- Проект — npm-пакет. Каждый компонент в `code/<scene>/code.js`: CommonJS-модуль
  `module.exports = {bytecode}`, правится разбором через Babel 7.0 (`src/ast/*`,
  `bll/AST.js`, `bll/ModuleWrapper.js`).
- Обёртки генерирует `@haiku/sdk-client/src/bootstrapSceneFilesSync.ts` и
  `createProjectFiles.ts`.
- `lottie.json` и `static.json` — результаты экспорта (`bll/ActiveComponent.js:328-332`).
- Импортированный SVG проходит через svgo со своими плагинами (`src/svg/plugins/`),
  затем `xmlToMana` (`haiku-common/lib/layout/xmlUtils`), запуск из
  `bll/Bytecode.js:621` и `bll/File.js`.
- Undo/redo — `bll/ActionStack.js`. Самые большие модели: `bll/ActiveComponent.js`
  (4891 строка) и `bll/Element.js`.

### Импортёры
Все три превращают исходник в SVG-файлы в папке `<file>.contents/`, за которой затем
идёт наблюдение.
- **Sketch** (`bll/Sketch.js`): `execSync` CLI `sketchtool` внутри
  `/Applications/Sketch.app`, путь ищется через `mdfind` (`utils/sketchUtils.js`).
  Экспортирует слайсы и артборды в SVG, затем гамма-корректирует встроенные PNG через
  pngjs. Только macOS, нужен установленный Sketch.
- **Figma** (`bll/Figma.js`):
  - REST API `api.figma.com/v1` с Bearer-токеном через `request` (устарел);
  - OAuth с client ID Haiku (`:14`, переопределяется через `FIGMA_CLIENT_ID`) и
    redirect `haiku://oauth/figma`;
  - обмен кода на токен идёт через бэкенд Haiku
    (`inkstone.integrations.getFigmaAccessToken`, `:329`), которого нет, поэтому
    **импорт Figma сломан**, пока не перейти на personal access token или свой
    OAuth-бэкенд;
  - импорт ограничен 100 элементами.
- **Illustrator** (`bll/Illustrator.js`): пишет ExtendScript `.jsx` во временную папку
  и открывает его через `open -b com.adobe.Illustrator` (Mac) или путь из реестра
  (Windows). Нужен установленный Illustrator. Открытия файла ждёт фиксированным
  `setTimeout` на 5000 мс.

## 4. Недоделанное и выключенное

- **Фича-флаги**: `haiku-common/config/experiments.json` (enum в
  `haiku-common/src/experiments/index.ts`). Выключены три:
  - `AllowBitmapImages` (`haiku-serialization/src/bll/Asset.js:529`,
    `haiku-creator/.../FileSystemImporter.tsx:19`);
  - `OutliningElementsOnStageFromStage` (`haiku-glass/src/react/Glass.js:801`);
  - `WindowMenu` (`haiku-common/src/electron/TopMenu.ts:458`).
- **Выключенный пункт меню**: «Open in Text Editor» закомментирован, потому что
  «causes a crash in prod» (`TopMenu.ts:101-109`).
- **Только macOS**: всё меню Export (Video, GIF, Lottie) (`TopMenu.ts:255`).
- **Только один таймлайн**: `ActiveComponent.js:253`, `getCurrentTimelineName()` с
  `TODO: Support many` всегда возвращает Default.
- **Не реализовано**: `Bytecode.js:29-31`, «reference evaluator is not implemented».
- **Закомментированные глобальные объекты**: `HaikuComponent.ts:4003-4040` — Map, Set,
  Promise, типизированные массивы и др. убраны из песочницы expressions.
- **Отключённый тест**: `haiku-serialization/test/bll/02_Project.undo-redo.test.stub.js`
  переименован в `.stub` и никогда не запускается. `.skip` и `xit` в этих пакетах нет.
  Тестовые скрипты serialization заканчиваются на `|| true`
  (`haiku-serialization/package.json`), поэтому падения не ломают прогон.
- **Angular**: суррогаты выбираются только по индексу
  (`HaikuAngularDOMAdapter.ts:126`), обработка изменений детей — пустой TODO (`:226`).
- **TODO/FIXME**: core 25, formats 22, serialization 77.

## 5. Что оставить и модернизировать, а что — наследие

### Оставить и модернизировать (самое ценное)
1. **Рантайм `@haiku/core`**: формат bytecode, таймлайн и интерполяция, математика
   раскладки, кривые.
   - Убрать Mixpanel, контекстное меню, шимы IE/Modernizr/raf.
   - `new Function` убрать или сделать opt-in.
   - Собирать ESM через Vite или Rollup 4.
   - Переписать адаптеры под React 18+ на хуках и Vue 3; Angular убрать или
     переписать.
2. **Lottie-экспортёр**: хорошо покрыт тестами, Lottie по-прежнему важен для мобайла.
   Исправить провал в `case`, затем добавить маски, clipPath, текст и градиенты на
   обводке.
3. **HaikuStatic-экспортёр** и код AST round-trip в `haiku-serialization/src/ast`.

### Переделать
- **GIF и видео**: рендерить кадры через headless Chromium (Playwright) или
  OffscreenCanvas вместо Electron `capturePage`. ffmpeg оставить или заменить на
  WebCodecs.
- **Импорт Figma**: personal access token или новый OAuth-бэкенд.

### Наследие
- Sketch через `sketchtool` и Illustrator через ExtendScript: хрупко, только десктоп.
- Интеграции Mixpanel и inkstone.
- Скрипты загрузки на CDN.
- Большая часть `demo/projects` (31 МБ): оставить около 20 проектов как регрессионные
  фикстуры; 1000+ сгенерированных обёрток можно пересоздать.
