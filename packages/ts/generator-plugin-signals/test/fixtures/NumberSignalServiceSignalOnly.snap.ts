import { NumberSignal as NumberSignal_1 } from "@vaadin/hilla-react-signals";
import client_1 from "./connect-client.default.js";
function counter_1() {
    return new NumberSignal_1(undefined, { client: client_1, method: "NumberSignalService.counter" });
}
function sharedValue_1() {
    return new NumberSignal_1(undefined, { client: client_1, method: "NumberSignalService.sharedValue" });
}
export { counter_1 as counter, sharedValue_1 as sharedValue };
