'use client';

import { useEffect } from 'react';

function getScrollableParent(target: EventTarget | null): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const canScroll = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
}

export function PullToRefresh() {
  useEffect(() => {
    let startY = 0;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches.item(0);
      if (!touch) return;
      startY = touch.clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches.item(0);
      if (!touch) return;

      const deltaY = touch.clientY - startY;
      if (deltaY <= 0) return;

      const scrollable = getScrollableParent(event.target);
      const atTop = !scrollable || scrollable.scrollTop <= 0;

      if (atTop) event.preventDefault();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMove, true);
    };
  }, []);

  return null;
}
