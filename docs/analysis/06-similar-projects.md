# 06. Похожие открытые проекты: что можно взять

Часть аудита [AUDIT-2026-10](../AUDIT-2026-10.md). Лицензии и активность проверены через
GitHub API 2026-10-11.

## Правило совместимости

Наш форк под AGPL-3.0-or-later (см. [LICENSING.md](../../LICENSING.md)).
- **Код** можно брать из проектов под MIT, ISC, BSD, zlib, Apache-2.0, MPL-2.0
  (пофайлово), LGPL, GPL-3.0, AGPL-3.0 — с сохранением их копирайтов и записью в
  `THIRD_PARTY_NOTICES.md`.
- Из GPL-2.0-only, проприетарных проектов и проектов со своими лицензиями (Remotion
  и др.) — **только идеи и подходы**, без копирования кода.

## Сводная таблица

| Проект | Лицензия | ★ | Последний push | Статус |
|---|---|---|---|---|
| [theatre-js/theatre](https://github.com/theatre-js/theatre) | Apache-2.0 (studio — AGPL-3.0) | 12.7k | 2024-08 | затих |
| [thorvg/thorvg](https://github.com/thorvg/thorvg) | MIT | 1.9k | 2026-10 | активен |
| [LottieFiles/dotlottie-web](https://github.com/LottieFiles/dotlottie-web) | MIT | 0.9k | 2026-10 | активен |
| [lottie/lottie-spec](https://github.com/lottie/lottie-spec) | спецификация (Lottie Animation Community) | 0.1k | 2026-06 | активен |
| [LottieFiles/relottie](https://github.com/LottieFiles/relottie) | MIT | <0.1k | 2026-09 | активен |
| [airbnb/lottie-web](https://github.com/airbnb/lottie-web) | MIT | 32k | 2025-09 | поддержка |
| [linebender/velato](https://github.com/linebender/velato) | Apache-2.0 / MIT | 0.2k | 2026-09 | активен |
| [Samsung/rlottie](https://github.com/Samsung/rlottie) | MIT-подобная | 1.4k | 2026-09 | активен |
| [penpot/penpot](https://github.com/penpot/penpot) | MPL-2.0 | 61k | 2026-10 | очень активен |
| [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) | MIT | 19k | 2026-07 | активен |
| [midrender/revideo](https://github.com/midrender/revideo) | MIT | 4k | 2026-07 | активен |
| [rive-app/rive-runtime](https://github.com/rive-app/rive-runtime) | MIT (редактор закрыт) | 1.2k | 2026-10 | активен |
| [GraphiteEditor/Graphite](https://github.com/GraphiteEditor/Graphite) | Apache-2.0 | 27.5k | 2026-10 | активен |
| [friction2d/friction](https://github.com/friction2d/friction) | GPL-3.0 | 1.8k | 2026-10 | активен |
| Glaxnimate (KDE, invent.kde.org) | GPL-3.0 | — | — | активен |
| [synfig/synfig](https://github.com/synfig/synfig) | GPL-3.0 | 2.3k | 2026-10 | активен |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) | MIT | 73k | 2026-08 | активен |
| [motiondivision/motion](https://github.com/motiondivision/motion) | MIT | 34k | 2026-10 | активен |
| [mojs/mojs](https://github.com/mojs/mojs) | MIT | 19k | 2026-07 | активен |
| [MaurycyLiebner/enve](https://github.com/MaurycyLiebner/enve) | GPL-3.0 | 1.2k | 2022-09 | **в архиве** |
| [Wicklets/wick-editor](https://github.com/Wicklets/wick-editor) | GPL-3.0 | 0.8k | 2023-03 | мёртв |
| [pencil2d/pencil](https://github.com/pencil2d/pencil) | **GPL-2.0** | 1.8k | 2026-10 | несовместим |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | своя лицензия (платно для компаний) | 63k | 2026-10 | несовместим |
| [opentoonz/opentoonz](https://github.com/opentoonz/opentoonz), [tahoma2d](https://github.com/tahoma2d/tahoma2d) | BSD-подобная | 7.8k / 0.7k | 2026-09/10 | другая ниша (растр) |

## Что конкретно взять

### Theatre.js — таймлайн
Веб-редактор последовательностей: дорожки, keyframes, редактор bezier-кривых.
Образец или прямая замена устаревшего `haiku-timeline` (React 15 + radium).
`@theatre/core` под Apache-2.0, `@theatre/studio` под AGPL-3.0 — оба совместимы.

### ThorVG + dotlottie-web — превью и проверка Lottie
Быстрый Lottie-плеер на WASM.
- Превью «как будет на телефоне» прямо в редакторе.
- Автотест: экспортировать → проиграть в ThorVG → сравнить кадры с нашим рантаймом.
- Формат **.lottie** (zip, несколько анимаций, темы).

### lottie-spec + relottie — корректность и импорт
- Официальная спецификация Lottie: тесты соответствия нашего экспорта.
- relottie: парсер Lottie в AST с плагинами — основа для **импорта Lottie** (#1074).

### Penpot — источник импорта вместо Figma
Открытая альтернатива Figma с self-host и открытым API/плагинами. Импорт из Penpot
никогда не сломается из-за отключения чужого сервера, в отличие от Figma OAuth через
Haiku.

### Motion Canvas / Revideo — рендер видео
Рендер кадров в браузере и кодирование через WebCodecs/ffmpeg. Подход для GIF/MP4 без
хака со скрытым окном Electron и `capturePage`.

### Rive — интерактивность
Модель **State Machine** (входы, состояния, переходы, слои) — стандарт де-факто для
интерактивных анимаций. В Haiku есть states и actions, но слабее. Берём концепцию;
runtime под MIT можно изучать.

### anime.js, Motion, mo.js — механика движения
- Spring-физика и современные easing-функции, которых в Haiku нет.
- Образец современного React-адаптера на хуках (у Haiku `componentWillReceiveProps`).

### Graphite — архитектура
Векторный редактор web-first на Rust + WASM с процедурным нодовым графом. Идеи на
будущее: редактор в браузере, процедурная графика.

### Friction — как возрождать заброшенный проект
Живой форк заброшенного enve, ровно наш случай. Учимся организации: регулярные
релизы, CI со сборками под все ОС, общение с сообществом.

### Glaxnimate — главный конкурент
Векторный редактор с Lottie как родным форматом: импорт и экспорт Lottie, SVG, много
форматов вывода. Именно на него уходили пользователи Haiku (#1085, #1100). Ориентир по
набору функций; код на C++/Qt к нам не переносится.

### Synfig — скелетная анимация
Кости и деформации, если когда-нибудь пойдём в эту сторону.

## Не подходят
- **Remotion**: своя лицензия, коммерческое использование платное.
- **Pencil2D**: GPL-2.0-only, несовместим с AGPL; к тому же растровая анимация.
- **OpenToonz / Tahoma2D**: покадровая растровая анимация, другая ниша.
- **Wick Editor, enve**: мертвы.

## Закрытые конкуренты (ориентиры по UX, без кода)
Rive (редактор), Lottielab, Jitter, SVGator, Keyshape, After Effects + Bodymovin.
