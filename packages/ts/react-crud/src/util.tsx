import React, { type CSSProperties, forwardRef } from 'react';
import type FilterUnion from './types/com/vaadin/flow/spring/data/filter/FilterUnion';

export type ComponentStyleProps = Readonly<{
  id?: string;
  style?: CSSProperties;
  className?: string;
}>;

export function convertToTitleCase(inputString: string): string {
  // Convert underscores to spaces
  const stringWithSpaces = inputString.replace(/_/gu, ' ');

  // Convert to title case
  const words = stringWithSpaces.split(' ');
  const titleCaseWords = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  // Join the title case words with spaces
  return titleCaseWords.join(' ');
}

export function registerStylesheet(stylesheet: CSSStyleSheet): void {
  const css = Array.from(stylesheet.cssRules)
    .map((rule) => rule.cssText)
    .join('\n');

  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.prepend(styleTag);
}

const registeredFeatures = new Set<string>();
function useFeatureRegistration(feature: string): void {
  if (registeredFeatures.has(feature)) {
    return;
  }

  registeredFeatures.add(feature);
  // @ts-expect-error: esbuild injection
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  __REGISTER__(feature);
}

export function featureRegistration<C extends (...args: any[]) => any>(Component: C, feature: string): C {
  return forwardRef<unknown, React.JSX.LibraryManagedAttributes<C, NonNullable<unknown>>>((props, ref) => {
    useFeatureRegistration(feature);
    return <Component {...(props as any)} ref={ref} />;
  }) as unknown as C;
}

export function isFilterEmpty(filter: FilterUnion): boolean {
  if (filter['@type'] === 'and' || filter['@type'] === 'or') {
    if (filter.children.length === 0) {
      return true;
    }
    return filter.children.every((child) => isFilterEmpty(child as FilterUnion));
  }
  if ('filterValue' in filter) {
    return filter.filterValue === '';
  }
  throw new Error(`Unknown filter type: ${'@type' in filter ? filter['@type'] : JSON.stringify(filter)} `);
}
