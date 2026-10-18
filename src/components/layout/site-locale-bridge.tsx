'use client';

import { useEffect, useRef } from 'react';
import { useApp } from './providers';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';

type Translation = { english: string; persian: string };
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const EXCLUDED = 'script, style, noscript, code, pre, input, textarea, select, option, [contenteditable], [translate="no"], [data-i18n-ignore]';
const SPORT_CONTEXT = '[data-match-id], [data-testid="match-card"], .home-reference-card, [class*="team-name"], [class*="league-name"], [class*="match-hero"], [class*="match-list"], [class*="market-list"], [class*="fixture"]';

/**
 * Translate legacy literals and provider-originated labels without changing
 * DOM structure, event handlers, CSS direction or financial/source data.
 *
 * Prefer t(key) for new UI. This adapter is a transitional safety net for
 * legacy components, including lazy-loaded lists, modal sheets and admin.
 */
export function SiteLocaleBridge() {
  const { locale } = useApp();
  const textCache = useRef(new WeakMap<Text, Translation>());
  const attributeCache = useRef(new WeakMap<Element, Map<string, Translation>>());
  const hasLocalized = useRef(false);

  useEffect(() => {
    const cache = textCache.current;
    const attrs = attributeCache.current;
    const inPersian = locale === 'fa';
    if (!inPersian && !hasLocalized.current) return;
    hasLocalized.current = inPersian;

    const blocked = (element: Element): boolean => Boolean(element.closest(EXCLUDED));
    const isSportName = (element: Element, value: string) =>
      value.length <= 60 &&
      value.trim().split(/\s+/).length <= 7 &&
      /^[A-Za-z][A-Za-z0-9 .'\-()/&]+$/.test(value.trim()) &&
      Boolean(element.closest(SPORT_CONTEXT));

    const translateNode = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || blocked(parent)) return;
      const value = node.nodeValue ?? '';
      const previous = cache.get(node);
      if (!inPersian) {
        if (previous && value === previous.persian) node.nodeValue = previous.english;
        cache.delete(node);
        return;
      }
      if (previous && value === previous.persian) return;
      // A translated t(key) string must never be mistaken for English.
      if (!/[A-Za-z]/.test(value) || /[\u0600-\u06FF]/.test(value)) return;
      const localized = translateVisibleText(value, isSportName(parent, value));
      if (localized !== value) {
        cache.set(node, { english: value, persian: localized });
        node.nodeValue = localized;
      } else cache.delete(node);
    };

    const translateAttributes = (element: Element) => {
      if (blocked(element)) return;
      let tracked = attrs.get(element);
      if (!tracked) {
        tracked = new Map();
        attrs.set(element, tracked);
      }
      for (const name of ATTRIBUTES) {
        if (!element.hasAttribute(name)) continue;
        const value = element.getAttribute(name) ?? '';
        const previous = tracked.get(name);
        if (!inPersian) {
          if (previous && value === previous.persian) element.setAttribute(name, previous.english);
          tracked.delete(name);
          continue;
        }
        if (previous && value === previous.persian) continue;
        if (!/[A-Za-z]/.test(value) || /[\u0600-\u06FF]/.test(value)) continue;
        const translated = translateVisibleText(value, isSportName(element, value));
        if (translated !== value) {
          tracked.set(name, { english: value, persian: translated });
          element.setAttribute(name, translated);
        } else tracked.delete(name);
      }
    };

    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        translateNode(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as Element;
      if (blocked(element)) return;
      translateAttributes(element);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const current = walker.currentNode;
        if (current.nodeType === Node.TEXT_NODE) translateNode(current as Text);
        else translateAttributes(current as Element);
      }
    };

    if (!document.body) return;
    visit(document.body);
    if (!inPersian) return;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') translateNode(record.target as Text);
        else if (record.type === 'attributes') translateAttributes(record.target as Element);
        else for (const added of Array.from(record.addedNodes)) visit(added);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
