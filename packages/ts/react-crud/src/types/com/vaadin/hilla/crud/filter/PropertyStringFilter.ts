import type Filter from "./Filter.js";
import type Matcher from "./PropertyStringFilter/Matcher.js";
export default interface PropertyStringFilter extends Filter {
    propertyId: string;
    filterValue: string;
    matcher: Matcher;
    "@type": "propertyString";
}
