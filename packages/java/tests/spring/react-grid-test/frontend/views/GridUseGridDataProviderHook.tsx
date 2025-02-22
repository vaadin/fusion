import { useGridDataProvider } from '@vaadin/hilla-react-crud';
import { useSignal } from '@vaadin/hilla-react-signals';
import { Button } from '@vaadin/react-components';
import { Grid } from '@vaadin/react-components/Grid';
import { GridSortColumn } from '@vaadin/react-components/GridSortColumn';
import { useState } from 'react';
import type Pageable from 'Frontend/generated/com/vaadin/hilla/mappedtypes/Pageable';
import { PersonCustomService } from 'Frontend/generated/endpoints';

export default function GridUseGridDataProviderHook(): React.JSX.Element {
  const filterSignal = useSignal('');
  const fetch = async (pageable: Pageable) =>
    PersonCustomService.listPersonsLazyWithFilter(pageable, filterSignal.value);
  const dataProviderWithFilter = useGridDataProvider(fetch, [filterSignal.value]);

  const [state, setState] = useState(0);

  return (
    <>
      <div className="p-m flex flex-col gap-m"></div>
      <div>
        <input
          type="text"
          onInput={(e) => {
            const filterString = (e.target as HTMLInputElement).value;
            setState(state + 1);
            filterSignal.value = filterString;
          }}
        />
        <div>Filter length useState is {state}</div>
        <div>Filter value is {filterSignal.value}</div>
        <Grid pageSize={10} dataProvider={dataProviderWithFilter}>
          <GridSortColumn path="firstName" />
          <GridSortColumn path="lastName" />
          <GridSortColumn path="gender" />
        </Grid>
        <Button onClick={() => dataProviderWithFilter.refresh()}>Refresh</Button>
      </div>
    </>
  );
}
