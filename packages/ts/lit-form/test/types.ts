export interface VaadinRegistration {
  readonly is: string;
  readonly version?: string;
}

export interface Vaadin {
  registrations?: VaadinRegistration[];
}

export interface VaadinWindow extends Window {
  Vaadin?: Vaadin;
}
