import { AutoGrid } from '@vaadin/hilla-react-crud';
import { TextField } from '@vaadin/react-components/TextField.js';
import { useState } from 'react';
import type FilterUnion from 'Frontend/generated/com/vaadin/flow/spring/data/filter/FilterUnion';
import Matcher from 'Frontend/generated/com/vaadin/flow/spring/data/filter/PropertyStringFilter/Matcher';
import PersonModel from 'Frontend/generated/com/vaadin/hilla/test/reactgrid/PersonModel.js';
import { PersonService } from 'Frontend/generated/endpoints.js';

export function ReadOnlyGridSinglePropertyFilter(): React.JSX.Element {
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
      <AutoGrid service={PersonService} experimentalFilter={filter} model={PersonModel} noHeaderFilters />
    </div>
    /* page size is defined only to make testing easier */
  );
}
