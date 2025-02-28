import { TextField } from '@vaadin/react-components/TextField.js';
import { AutoGrid } from '@vaadin/hilla-react-crud';
import { useState } from 'react';
import type FilterUnion from 'Frontend/generated/com/vaadin/hilla/crud/filter/FilterUnion.js';
import PersonModel from 'Frontend/generated/com/vaadin/hilla/test/reactgrid/PersonModel.js';
import { PersonService } from 'Frontend/generated/endpoints.js';

export default function ReadOnlyGridOrFilter(): React.JSX.Element {
  const [filter, setFilter] = useState<FilterUnion | undefined>(undefined);

  return (
    <div>
      <TextField
        id="filter"
        style={{ width: '20em' }}
        label="Search for first or last name"
        onValueChanged={({ detail: { value } }) => {
          const firstNameFilter = {
            '@type': 'propertyString',
            propertyId: 'firstName',
            matcher: 'CONTAINS',
            filterValue: value,
          };
          const lasttNameFilter = {
            '@type': 'propertyString',
            propertyId: 'lastName',
            matcher: 'CONTAINS',
            filterValue: value,
          };
          setFilter({ '@type': 'or', children: [firstNameFilter, lasttNameFilter]});
        }}
      ></TextField>
      <AutoGrid service={PersonService} model={PersonModel} experimentalFilter={filter} headerFilters={false} />
    </div>
    /* page size is defined only to make testing easier */
  );
}
