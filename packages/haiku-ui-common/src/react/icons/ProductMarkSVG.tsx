import * as React from 'react';

/**
 * The product mark (same artwork as the app icon, build/icon.svg): an easing curve between two keyframes.
 */
export default () => {
  return (
    <svg viewBox="100 100 824 824" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="product-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1FC8B5" />
          <stop offset="1" stopColor="#3B4CCA" />
        </linearGradient>
      </defs>
      <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#product-mark-gradient)" />
      <path
        d="M232 700 C 420 700, 400 324, 792 324"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="56"
        strokeLinecap="round"
      />
      <circle cx="232" cy="700" r="62" fill="#FFFFFF" />
      <circle cx="792" cy="324" r="62" fill="#FFFFFF" />
      <rect x="470" y="470" width="84" height="84" rx="10" transform="rotate(45 512 512)" fill="#FFD166" />
    </svg>
  );
};
