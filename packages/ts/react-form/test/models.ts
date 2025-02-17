import {
  _getPropertyModel,
  ArrayModel,
  BooleanModel,
  makeObjectEmptyValueCreator,
  NumberModel,
  ObjectModel,
  Required,
  Size,
  StringModel,
} from '@vaadin/hilla-lit-form';

export interface FormUser {
  name: string;
  password: string;
  passwordHint?: string;
}

export interface User extends FormUser {
  id: number;
}

export class FormUserModel<T extends FormUser = FormUser> extends ObjectModel<T> {
  static override createEmptyValue: () => FormUser = makeObjectEmptyValueCreator(FormUserModel);

  get name(): StringModel {
    return this[_getPropertyModel](
      'name',
      (parent, key) => new StringModel(parent, key, false, { validators: [new Required(), new Size({ max: 10 })] }),
    );
  }

  get password(): StringModel {
    return this[_getPropertyModel](
      'password',
      (parent, key) => new StringModel(parent, key, false, { validators: [new Required(), new Size({ min: 6 })] }),
    );
  }

  get passwordHint(): StringModel {
    return this[_getPropertyModel](
      'passwordHint',
      (parent, key) =>
        new StringModel(parent, key, true /* should be optional */, { validators: [new Size({ max: 10 })] }),
    );
  }
}

export class UserModel<T extends User = User> extends FormUserModel<T> {
  static override createEmptyValue: () => User = makeObjectEmptyValueCreator(UserModel);

  get id(): NumberModel {
    return this[_getPropertyModel]('id', (parent, key) => new NumberModel(parent, key, false));
  }
}

export interface Login {
  user: User;
  rememberMe: boolean;
}

export class LoginModel<T extends Login = Login> extends ObjectModel<T> {
  static override createEmptyValue: () => Login = makeObjectEmptyValueCreator(LoginModel);

  get user(): FormUserModel {
    return this[_getPropertyModel]('user', (parent, key) => new FormUserModel(parent, key, false));
  }

  get rememberMe(): BooleanModel {
    return this[_getPropertyModel]('rememberMe', (parent, key) => new BooleanModel(parent, key, true));
  }
}

export interface Entity {
  projectId?: number;
  contractId?: number;
}

export class EntityModel<T extends Entity> extends ObjectModel<T> {
  static override createEmptyValue: () => Entity = makeObjectEmptyValueCreator(EntityModel);

  get projectId(): NumberModel {
    return this[_getPropertyModel](
      'projectId',
      (parent, key) => new NumberModel(parent, key, true, { meta: { javaType: 'java.lang.Long' } }),
    );
  }

  get contractId(): NumberModel {
    return this[_getPropertyModel](
      'contractId',
      (parent, key) => new NumberModel(parent, key, true, { meta: { javaType: 'java.lang.Long' } }),
    );
  }
}

export interface Project {
  id: number;
  name: string;
}

export interface Contract {
  id: number;
  name: string;
}

// Player and Team entities used to test array models
export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
}

export interface Team {
  id: number;
  name: string;
  players: Player[];
}

export class PlayerModel<T extends Player = Player> extends ObjectModel<T> {
  static override createEmptyValue: () => Player = makeObjectEmptyValueCreator(PlayerModel);

  get id(): NumberModel {
    return this[_getPropertyModel](
      'id',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'int' } }),
    );
  }

  get firstName(): StringModel {
    return this[_getPropertyModel](
      'firstName',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.lang.String' } }),
    );
  }

  get lastName(): StringModel {
    return this[_getPropertyModel](
      'lastName',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.lang.String' } }),
    );
  }

  get age(): NumberModel {
    return this[_getPropertyModel](
      'age',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'int' } }),
    );
  }
}

export class TeamModel<T extends Team = Team> extends ObjectModel<T> {
  static override createEmptyValue: () => Team = makeObjectEmptyValueCreator(TeamModel);

  get id(): NumberModel {
    return this[_getPropertyModel](
      'id',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'int' } }),
    );
  }

  get name(): StringModel {
    return this[_getPropertyModel](
      'name',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.lang.String' } }),
    );
  }

  get players(): ArrayModel<PlayerModel> {
    return this[_getPropertyModel](
      'players',
      (parent, key) =>
        new ArrayModel(parent, key, false, (p, k) => new PlayerModel(p, k, false), {
          meta: { javaType: 'java.util.List' },
        }),
    );
  }
}

export interface StreetAddress {
  number?: string;
  name?: string;
}
export interface PostalAddress {
  streetAddress?: StreetAddress;
}
export class StreetAddressModel<T extends StreetAddress = StreetAddress> extends ObjectModel<T> {
  static override createEmptyValue: () => StreetAddress = makeObjectEmptyValueCreator(StreetAddressModel);

  get number(): StringModel {
    return this[_getPropertyModel](
      'number',
      (parent, key) => new StringModel(parent, key, true, { meta: { javaType: 'java.lang.String' } }),
    );
  }

  get name(): StringModel {
    return this[_getPropertyModel](
      'name',
      (parent, key) => new StringModel(parent, key, true, { meta: { javaType: 'java.lang.String' } }),
    );
  }
}
export class PostalAddressModel<T extends PostalAddress = PostalAddress> extends ObjectModel<T> {
  static override createEmptyValue: () => PostalAddress = makeObjectEmptyValueCreator(PostalAddressModel);
  get streetAddress(): StreetAddressModel {
    return this[_getPropertyModel]('streetAddress', (parent, key) => new StreetAddressModel(parent, key, true));
  }
}
