import type AndFilter_1 from "./AndFilter.js";
import type OrFilter_1 from "./OrFilter.js";
import type PropertyStringFilter_1 from "./PropertyStringFilter.js";
type FilterUnion = (OrFilter_1 | AndFilter_1 | PropertyStringFilter_1) & { key?: string }
export default FilterUnion;
