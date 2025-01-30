import type Filter_1 from "./Filter.js";
import type Matcher_1 from "./PropertyStringFilter/Matcher.js";
interface PropertyStringFilter extends Filter_1 {
    propertyId: string;
    filterValue: string;
    matcher: Matcher_1;
    "@type": "propertyString";
}
export default PropertyStringFilter;
