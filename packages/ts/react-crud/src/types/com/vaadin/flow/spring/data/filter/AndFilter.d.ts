import type Filter_1 from "./Filter.js";
interface AndFilter extends Filter_1 {
    children: Array<Filter_1>;
    "@type": "and";
}
export default AndFilter;
