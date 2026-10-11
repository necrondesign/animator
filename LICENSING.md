# Licensing rules for this fork

> **English summary.** This repository is a fork of
> [HaikuTeam/animator](https://github.com/HaikuTeam/animator) (Haiku Animator by
> Haiku Systems Inc.). The application source is licensed under the
> **GNU AGPL-3.0-or-later** (see [LICENSE.md](LICENSE.md)); the runtime
> `@haiku/core` and `@haiku/cli` are **MIT**. The fork stays under the same
> licenses, keeps all original copyright notices, and documents its changes.
> Bundled third-party code is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
> "Haiku" and "Haiku Animator" are names of Haiku Systems Inc.; this fork is not
> affiliated with or endorsed by them.

Ниже правила, которые нельзя нарушать при любых доработках. Если изменение
противоречит хотя бы одному пункту, его нельзя мержить.

## 1. Какие лицензии в проекте (на момент форка, upstream `9621235c1`, 2022-03)

| Что | Лицензия | Где указано |
|---|---|---|
| Весь репозиторий по умолчанию (редактор, Electron-приложение, `packages/haiku-*`, скрипты) | **AGPL-3.0-or-later**, © 2021 Haiku Systems Inc. | `LICENSE.md`, README upstream |
| `packages/@haiku/core` (рантайм анимаций) | **MIT**, © 2016-2018 Haiku Systems Inc. | `packages/@haiku/core/LICENSE.txt` |
| `packages/@haiku/cli` | **MIT**, © 2017 Haiku Systems | `packages/@haiku/cli/LICENSE` |
| `packages/haiku-admin-cli` | MIT (поле `license` в package.json, без файла LICENSE) | `package.json` |
| `packages/haiku-fs-extra` (форк fs-extra) | **MIT**, © 2011-2016 JP Richardson | `packages/haiku-fs-extra/LICENSE` |
| Вендорный сторонний код (`@haiku/core/src/vendor`, `haiku-vendor-legacy/lib`) | MIT / ISC / zlib, у каждой библиотеки своя | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |
| Анимации, созданные пользователями в редакторе | принадлежат их авторам, лицензией проекта не связаны | README upstream |

**Устаревшие поля в package.json.** У многих внутренних пакетов в `package.json`
стоит `"license": "UNLICENSED"` или `"PROPRIETARY"` (`haiku-creator`, `haiku-common`,
`haiku-plumbing`, `haiku-timeline` и др.), а у некоторых поля нет вовсе. Это осталось
с тех времён, когда продукт был закрытым. Код был открыт в августе 2021 года, и для
этих пакетов действует корневой `LICENSE.md` (AGPL). Правило: **не перелицензировать
их под MIT или другую лицензию** и не трактовать «UNLICENSED» как «можно что угодно».
Если будем исправлять поля, ставим только `AGPL-3.0-or-later`.

## 2. Обязательные правила

1. **Лицензия не меняется.** Весь форк остаётся под AGPL-3.0-or-later, а MIT-пакеты
   остаются под MIT. Нельзя закрывать код, выпускать его под проприетарной лицензией
   или вставлять в AGPL-часть код под несовместимой лицензией.
2. **Чужие копирайты не удаляются.** `LICENSE.md`, `LICENSE.txt`, `LICENSE` и
   лицензионные шапки в файлах (в том числе в `vendor/`) остаются на месте. Свой
   копирайт на новые файлы и изменения можно **добавить рядом**, не заменяя старый.
3. **Изменения помечаются** (AGPL §5a). Каждое изменение видно в истории git
   с датой. Крупные переработки описываем в `CHANGELOG`/README форка.
4. **Исходники всегда доступны** (AGPL §6). Каждый бинарный релиз (dmg, exe,
   AppImage и т.д.) публикуется вместе с соответствующим тегом исходного кода в этом
   репозитории, и в описании релиза есть ссылка на исходники.
5. **Сетевое использование** (AGPL §13). Если какая-то часть станет веб-сервисом
   (онлайн-редактор, облачный рендер, API), в интерфейсе должна быть ссылка на
   исходники **именно той версии, которая работает на сервере**.
6. **Новые зависимости проверяются на лицензию** до добавления. Совместимы с AGPL:
   MIT, ISC, BSD-2/3, zlib, Apache-2.0, MPL-2.0, LGPL, GPL-3.0, AGPL-3.0.
   **Нельзя**: GPL-2.0-only, проприетарные, «non-commercial», SSPL, BSL и
   библиотеки без лицензии.
7. **Вендорный код** (код, скопированный в репозиторий) добавляется только вместе
   с его лицензией и записью в [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
8. **Товарный знак и бренд.** Лицензия даёт права на код, но не на имя. Публичный
   продукт не называем «Haiku» / «Haiku Animator», не используем их логотип как свой
   и не создаём впечатление, что форк официальный. Допустима формулировка
   «based on Haiku Animator by Haiku Systems Inc.». При ребрендинге меняем имя
   продукта, иконки и UI-тексты, но **не трогаем** строки копирайта Haiku Systems.
9. **Тестовые фикстуры с чужими правами.** Проект `Apr91` («Copyright (c) 2018 matthew2.
   All rights reserved.») удалён из `haiku-glass/test/projects` и `@haiku/core/demo`.
   Новые фикстуры и демо — только свои или под совместимой лицензией; чужие файлы
   с «All rights reserved» в репозиторий не добавляем.
10. **Облачные сервисы Haiku мертвы.** Эндпоинты из `.env.example` (`HAIKU_API`,
    `HAIKU_SHARE` и т.д.) и бакеты Haiku (например, `haiku-secrets` в
    `scripts/distro-download-secrets.js`) нам не принадлежат. Не обращаться к ним,
    не пытаться получить к ним доступ и не выдавать свой сервис за них.

## 3. Безопасность и приватность

- Коммиты делаются только от имени `necrondesign` с GitHub noreply-адресом.
  Реальные имена, личные email, телефоны и контакты в коммиты и файлы не попадают.
- Секреты (`.env`, ключи, сертификаты подписи, токены) никогда не коммитятся.
  Используются только `*.example`-файлы с пустыми значениями.
- Перед каждым пушем проверяем diff на email, токены и абсолютные пути вида
  `/Users/<имя>/...`.

## 4. Чеклист перед релизом

- [ ] `LICENSE.md` и все файлы лицензий на месте и попадают в сборку
- [ ] `THIRD_PARTY_NOTICES.md` актуален и включён в дистрибутив
- [ ] В приложении (About / Settings) указаны: AGPL-3.0, ссылка на исходники,
      «based on Haiku Animator by Haiku Systems Inc.»
- [ ] В релизе на GitHub есть тег с исходниками этой версии
- [ ] Новые зависимости проверены по пункту 2.6
- [ ] Нет упоминаний бренда Haiku как названия нашего продукта
- [ ] Нет секретов и личных данных в diff/сборке

*Это внутренние правила проекта, а не юридическая консультация.*
