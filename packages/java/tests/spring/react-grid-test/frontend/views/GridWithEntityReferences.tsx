import { AutoGrid } from '@vaadin/hilla-react-crud';
import EmployeeModel from 'Frontend/generated/com/vaadin/hilla/test/reactgrid/entityreferences/EmployeeModel.js';
import { EmployeeService } from 'Frontend/generated/endpoints.js';

export default function GridWithEntityReferences(): React.JSX.Element {
  return <AutoGrid pageSize={10} service={EmployeeService} model={EmployeeModel} headerFilters={false} />;
  /* page size is defined only to make testing easier */
}
