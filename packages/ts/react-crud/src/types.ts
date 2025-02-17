/* eslint-disable import/unambiguous */

declare module '*.obj.css' {
  const css: CSSStyleSheet;
  export default css;
}

declare module 'csstype' {
  interface Properties {
    '--auto-crud-text-align'?: string;
  }
}
