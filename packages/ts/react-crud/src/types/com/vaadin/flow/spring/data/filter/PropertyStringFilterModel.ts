import { _getPropertyModel as _getPropertyModel_1, makeObjectEmptyValueCreator as makeObjectEmptyValueCreator_1, StringModel as StringModel_1 } from "@vaadin/hilla-lit-form";
import FilterModel_1 from "./FilterModel.js";
import type PropertyStringFilter_1 from "./PropertyStringFilter.js";
import MatcherModel_1 from "./PropertyStringFilter/MatcherModel.js";
class PropertyStringFilterModel<T extends PropertyStringFilter_1 = PropertyStringFilter_1> extends FilterModel_1<T> {
    static override createEmptyValue = makeObjectEmptyValueCreator_1(PropertyStringFilterModel);
    get propertyId(): StringModel_1 {
        return this[_getPropertyModel_1]("propertyId", (parent, key) => new StringModel_1(parent, key, false, { meta: { javaType: "java.lang.String" } }));
    }
    get filterValue(): StringModel_1 {
        return this[_getPropertyModel_1]("filterValue", (parent, key) => new StringModel_1(parent, key, false, { meta: { javaType: "java.lang.String" } }));
    }
    get matcher(): MatcherModel_1 {
        return this[_getPropertyModel_1]("matcher", (parent, key) => new MatcherModel_1(parent, key, false));
    }
}
export default PropertyStringFilterModel;
