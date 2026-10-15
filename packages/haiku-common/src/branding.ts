/**
 * Product identity in one place. "motion-side" is the product name; to rename the product change these values,
 * plus `productName`, `build.productName`, `build.appId` and `build.protocols` in the root package.json.
 *
 * Internal identifiers (package names like `@haiku/core`, the `haiku` bytecode/file format, `haiku-id`
 * attributes) are deliberately *not* branding: they keep existing projects and the runtime API compatible.
 */

// Shown in window titles, menus, dialogs and the app tour.
export const PRODUCT_NAME = 'motion-side';

// Custom URL scheme the app registers for deep links (PRODUCT_PROTOCOL://...).
export const PRODUCT_PROTOCOL = 'motion-side';

// Where users find the source code, report problems and read about the project.
export const REPOSITORY_URL = 'https://github.com/necrondesign/animator';
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;

// AGPL/attribution: the product is a fork of Haiku Animator.
export const ATTRIBUTION = 'Based on Haiku Animator by Haiku Systems Inc.';
