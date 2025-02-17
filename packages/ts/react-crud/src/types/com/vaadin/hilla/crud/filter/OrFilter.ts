import type Filter from "./Filter.js";
export default interface OrFilter extends Filter {
    children: Array<Filter>;
    "@type": "or";
}
