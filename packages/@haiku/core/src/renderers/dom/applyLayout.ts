/**
 * Copyright (c) Haiku 2016-2018. All rights reserved.
 */

import applyCssLayout from '../../layout/applyCssLayout';
import isTextNode from './isTextNode';

export default function applyLayout (
  domElement,
  virtualElement,
  component,
) {
  if (isTextNode(virtualElement)) {
    return domElement;
  }

  if (virtualElement.layout) {
    const computedLayout = virtualElement.layout.computed;

    // No computed layout means the el is not shown
    if (!computedLayout) {
      if (domElement.style.display !== 'none') {
        domElement.style.display = 'none';
      }
    } else {
      if (domElement.style.display !== 'block') {
        domElement.style.display = 'block';
      }

      applyCssLayout(domElement, virtualElement, virtualElement.layout, computedLayout, component);
    }
  }

  return domElement;
}
