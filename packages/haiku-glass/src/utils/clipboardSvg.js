import * as path from 'path';
import * as fse from 'haiku-fs-extra';

const SVG_MARKUP_RE = /^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>][\s\S]*<\/svg>$/i;

/**
 * Returns the SVG markup held in a clipboard string (e.g. Figma "Copy as SVG"), or null if it isn't SVG.
 * @param {string} text
 * @returns {string|null}
 */
export const extractSvgMarkup = (text) => {
  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  return SVG_MARKUP_RE.test(trimmed) ? trimmed : null;
};

/**
 * Picks an unused designs/Pasted N.svg path inside the project folder.
 * @param {string} projectFolder
 * @returns {string} relpath
 */
export const nextPastedSvgRelpath = (projectFolder) => {
  for (let index = 1; ; index++) {
    const relpath = path.join('designs', `Pasted ${index}.svg`);
    if (!fse.existsSync(path.join(projectFolder, relpath))) {
      return relpath;
    }
  }
};
