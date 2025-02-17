import type Filter from "./Filter.js";
export default interface AndFilter extends Filter {
    children: Array<Filter>;
    "@type": "and";
}
