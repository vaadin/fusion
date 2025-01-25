import { EndpointRequestInit as EndpointRequestInit_1 } from "@vaadin/hilla-frontend";
import client_1 from "./connect-client.default.js";
async function uploadFile_1(file: File | undefined, init?: EndpointRequestInit_1): Promise<void> { return client_1.call("MultipartFileEndpoint", "uploadFile", { file }, init); }
export { uploadFile_1 as uploadFile };
