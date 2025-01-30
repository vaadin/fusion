import { _enum as _enum_1, EnumModel as EnumModel_1, makeEnumEmptyValueCreator as makeEnumEmptyValueCreator_1 } from "@vaadin/hilla-lit-form";
import Matcher_1 from "./Matcher.js";
class MatcherModel extends EnumModel_1<typeof Matcher_1> {
    static override createEmptyValue = makeEnumEmptyValueCreator_1(MatcherModel);
    readonly [_enum_1] = Matcher_1;
}
export default MatcherModel;
