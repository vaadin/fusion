import { useComboBoxDataProvider } from '@vaadin/hilla-react-crud';
import { useSignal } from '@vaadin/hilla-react-signals';
import { Button, ComboBox } from '@vaadin/react-components';
import { useState } from 'react';
import { PersonCustomService } from 'Frontend/generated/endpoints';
import Direction from 'Frontend/generated/org/springframework/data/domain/Sort/Direction';
import NullHandling from 'Frontend/generated/org/springframework/data/domain/Sort/NullHandling';

export default function ComboBoxUseComboBoxDataProviderHook(): React.JSX.Element {
  const [sort] = useState({
    orders: [{ property: 'lastName', direction: Direction.ASC, ignoreCase: true, nullHandling: NullHandling.NATIVE }],
  });
  const dataProvider = useComboBoxDataProvider(PersonCustomService.listPersonsLazyWithFilter);
  const dataProviderLastName = useComboBoxDataProvider(PersonCustomService.listPersonsLazyWithFilter, { sort });

  const filterSignal = useSignal('');
  const dataProviderLastNameFiltered = useComboBoxDataProvider(
    async (pageable, filter) => PersonCustomService.listPersonsLazyWithFilter(pageable, filterSignal.value + filter),
    { sort },
    [filterSignal.value],
  );

  return (
    <div className="p-m flex flex-col gap-m">
      <ComboBox id="defaultSort" label="Default sort" dataProvider={dataProvider} itemLabelPath="lastName" />
      <ComboBox
        id="sortLastName"
        label="Sorted using last name"
        dataProvider={dataProviderLastName}
        itemLabelPath="lastName"
      />
      <input
        id="filter"
        type="text"
        onInput={(e) => {
          filterSignal.value = (e.target as HTMLInputElement).value;
        }}
      />
      <ComboBox
        id="prependFilter"
        label="Prepending filter with"
        dataProvider={dataProviderLastNameFiltered}
        itemLabelPath="lastName"
      />
      <Button
        onClick={() => {
          dataProvider.refresh();
          dataProviderLastName.refresh();
        }}
      >
        Refresh
      </Button>
    </div>
  );
}
