import { TextField } from '@vaadin/react-components/TextField.js';
import { AutoGrid } from '@vaadin/hilla-react-crud';
import { useState } from 'react';
import type FilterUnion from 'Frontend/generated/com/vaadin/hilla/crud/filter/FilterUnion.js';
import Matcher from 'Frontend/generated/com/vaadin/hilla/crud/filter/PropertyStringFilter/Matcher.js';
import PersonModel from 'Frontend/generated/com/vaadin/hilla/test/reactgrid/PersonModel.js';
import { PersonService } from 'Frontend/generated/endpoints.js';

export default function ReadOnlyGridSinglePropertyFilter(): React.JSX.Element {
  const [filter, setFilter] = useState<FilterUnion | undefined>(undefined);
  return (
    <div>
      <TextField
        id="filter"
        label="Search for first name"
        onValueChanged={({ detail: { value } }) => {
          setFilter({
            '@type': 'propertyString',
            propertyId: 'firstName',
            matcher: Matcher.CONTAINS,
            filterValue: value,
          });
        }}
      ></TextField>
      <AutoGrid service={PersonService} experimentalFilter={filter} model={PersonModel} headerFilters={false} />
    </div>
    /* page size is defined only to make testing easier */
  );
}
