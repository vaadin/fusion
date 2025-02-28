import type { AbstractModel, DetachedModelConstructor } from '@vaadin/hilla-lit-form';
import { Button } from '@vaadin/react-components/Button.js';
import { AutoGrid, type CrudService } from '@vaadin/hilla-react-crud';
import { useState } from 'react';
import CompanyModel from 'Frontend/generated/com/vaadin/hilla/test/reactgrid/CompanyModel.js';
import PersonModel from 'Frontend/generated/com/vaadin/hilla/test/reactgrid/PersonModel.js';
import { CompanyService, PersonService } from 'Frontend/generated/endpoints.js';

export default function ReadOnlyGridWithHeaderFilters(): React.JSX.Element {
  const [model, setModel] = useState<Array<DetachedModelConstructor<AbstractModel>>>([PersonModel]);
  const [service, setService] = useState<CrudService<any>>(PersonService);
  const [headerFilters, setHeaderFilters] = useState(true);
  return (
    <>
      <Button
        onClick={(e) => {
          if (model[0] === PersonModel) {
            setModel([CompanyModel]);
            setService(CompanyService);
          } else {
            setModel([PersonModel]);
            setService(PersonService);
          }
        }}
      >
        Change bean type
      </Button>
      <Button
        onClick={(e) => {
          setHeaderFilters(!headerFilters);
        }}
      >
        Toggle header filters
      </Button>
      <AutoGrid service={service} model={model[0]} headerFilters={headerFilters} />
    </>
  );
  /* page size is defined only to make testing easier */
}
