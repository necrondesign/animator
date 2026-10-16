import * as tape from 'tape';
import * as fse from 'haiku-fs-extra';
import * as os from 'os';
import * as path from 'path';
import {extractSvgMarkup, nextPastedSvgRelpath} from '../../src/utils/clipboardSvg';

tape('extractSvgMarkup', (t) => {
  const svg = '<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
  t.equal(extractSvgMarkup(svg), svg, 'plain svg markup');
  t.equal(extractSvgMarkup(`\n  ${svg}\n`), svg, 'surrounding whitespace is trimmed');
  t.ok(extractSvgMarkup(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: x -->\n${svg}`), 'xml prolog and comments');
  t.equal(extractSvgMarkup('hello <svg></svg>'), null, 'text that merely contains svg');
  t.equal(extractSvgMarkup('<svg width="10">'), null, 'unterminated svg');
  t.equal(extractSvgMarkup('<svgfoo></svgfoo>'), null, 'other tags');
  t.equal(extractSvgMarkup(undefined), null, 'non-string');
  t.end();
});

tape('nextPastedSvgRelpath', (t) => {
  const folder = fse.mkdtempSync(path.join(os.tmpdir(), 'clipboard-svg-'));
  t.equal(nextPastedSvgRelpath(folder), path.join('designs', 'Pasted 1.svg'), 'first name');
  fse.outputFileSync(path.join(folder, 'designs', 'Pasted 1.svg'), '<svg></svg>');
  t.equal(nextPastedSvgRelpath(folder), path.join('designs', 'Pasted 2.svg'), 'skips taken names');
  fse.removeSync(folder);
  t.end();
});
