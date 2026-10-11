# Third-party notices

This project (a fork of Haiku Animator by Haiku Systems Inc.) bundles source code
from the third-party projects listed below. Each component remains under its own
license. Where the upstream repository already carries the license header inside
the vendored files, that header is authoritative; entries marked † had no license
text in the upstream Haiku repository and are restored here from the original
projects' package metadata.

npm dependencies installed via `package.json` / `yarn.lock` are not listed here;
their licenses ship with each package in `node_modules`.

## `packages/@haiku/core/src/vendor`

| Component | License | Copyright / source |
|---|---|---|
| array-unique | MIT | © 2014-2016 Jon Schlinkert |
| assign | MIT | © 2017 Ryan Florence |
| color-names | MIT | © 2015 Dmitry Ivanov |
| color-string | MIT | © 2011 Heather Arthur |
| gl-mat4 † | zlib | stackgl/gl-mat4, derived from gl-matrix © 2013 Brandon Jones, Colin MacKenzie IV |
| just-curves | MIT | © justanimate |
| modernizr | MIT | © 2016 Modernizr |
| performance-now | MIT | © 2013 Braveg1rl |
| raf | MIT | © 2017 Chris Dickinson |
| seedrandom | MIT | © 2015 David Bau |
| svg-path-reversal | Public domain / MIT | see file header |
| svg-points | ISC | © 2016 Colin Meinke |

## `packages/haiku-vendor-legacy/lib`

| Component | License | Copyright / source |
|---|---|---|
| css-mat4 † | MIT | © Matt DesLauriers, github.com/mattdesl/css-mat4 |
| css-value | MIT | © TJ Holowaychuk, github.com/visionmedia/css-value |
| gl-mat4 † | zlib | stackgl/gl-mat4, derived from gl-matrix © 2013 Brandon Jones, Colin MacKenzie IV |
| gl-vec3 † | zlib | stackgl/gl-vec3, derived from gl-matrix © 2013 Brandon Jones, Colin MacKenzie IV |
| mat4-decompose † | MIT | © Matt DesLauriers, github.com/mattdesl/mat4-decompose |
| to-style | MIT | © Radu Brehar, github.com/radubrehar/toStyle |
| xml-parser | MIT | github.com/segmentio/xml-parser |

## `packages/haiku-fs-extra`

| Component | License | Copyright / source |
|---|---|---|
| fs-extra (fork) | MIT | © 2011-2016 JP Richardson (see `packages/haiku-fs-extra/LICENSE`) |

---

## License texts

### MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### zlib License

```
This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

### ISC License

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
