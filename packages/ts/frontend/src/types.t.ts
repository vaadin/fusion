import type { ConnectionIndicator, ConnectionStateStore } from '@vaadin/common-frontend';

export interface VaadinRegistration {
  readonly is: string;
  readonly version?: string;
}

export interface VaadinFlow {
  readonly clients?: Record<string, unknown>;
}

export interface Vaadin {
  readonly Flow?: VaadinFlow;
  readonly connectionIndicator?: ConnectionIndicator;
  readonly connectionState?: ConnectionStateStore;
  registrations?: VaadinRegistration[];
}

export interface VaadinGlobal {
  Vaadin?: Vaadin;
}
