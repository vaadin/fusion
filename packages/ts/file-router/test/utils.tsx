import { appendFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { JSX } from 'react';
import sinon from 'sinon';
import type { Logger } from 'vite';
import type { RouteModule } from '../src/types.js';
import type { RouteMeta } from '../src/vite-plugin/collectRoutesFromFS.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Chai {
    interface PromisedAssertion {
      like(expected: unknown): Promise<void>;
    }
  }
}

export async function createTmpDir(): Promise<URL> {
  return pathToFileURL(`${await mkdtemp(join(tmpdir(), 'file-router-'))}/`);
}

export async function createTestingRouteFiles(dir: URL): Promise<void> {
  // Generates the following directory structure:
  // root
  // ├── profile
  // │   ├── account
  // │   │   ├── layout.tsx
  // │   │   └── security
  // │   │       ├── password.jsx
  // │   │       ├── two-factor-auth.tsx
  // │   │       └── two-factor-auth-ignored.ts
  // │   ├── friends
  // │   │   ├── layout.tsx
  // │   │   ├── list.jsx
  // │   │   ├── list-ignored.js
  // │   │   └── {user}.tsx
  // │   ├── index.tsx
  // │   └── index.css
  // ├── empty-dir
  // │   ├── empty-subdir
  // │   │       └── empty-dir-ignored.ts
  // │   ├── empty-file-subdir
  // │   │       └── empty.tsx
  // ├── test
  // │   ├── {{optional}}.tsx
  // │   ├── {...wildcard}.tsx
  // │   ├── config-after-default-export.tsx
  // │   ├── empty.tsx
  // │   ├── _ignored.tsx
  // │   └── no-default-export.tsx
  // └── nameToReplace.tsx

  await Promise.all([
    mkdir(new URL('profile/account/security/', dir), { recursive: true }),
    mkdir(new URL('profile/friends/', dir), { recursive: true }),
    mkdir(new URL('empty-dir/empty-subdir/', dir), { recursive: true }),
    mkdir(new URL('empty-dir/empty-file-subdir/', dir), { recursive: true }),
    mkdir(new URL('test', dir), { recursive: true }),
    mkdir(new URL('test/issue-002378/{requiredParam}', dir), { recursive: true }),
    mkdir(new URL('test/issue-002571-empty-layout/', dir), { recursive: true }),
  ]);
  await Promise.all([
    appendFile(
      new URL('profile/account/@layout.tsx', dir),
      "export const config = { title: 'Account' };\nexport default function AccountLayout() {};",
    ),
    appendFile(new URL('profile/account/security/password.jsx', dir), 'export default function Password() {};'),
    appendFile(new URL('profile/account/security/password.scss', dir), ''),
    appendFile(
      new URL('profile/account/security/two-factor-auth.tsx', dir),
      'export default function TwoFactorAuth() {};',
    ),
    appendFile(
      new URL('profile/account/security/two-factor-auth-ignored.ts', dir),
      'export default function TwoFactorAuthIgnored() {};',
    ),
    appendFile(new URL('profile/friends/@layout.tsx', dir), 'export default function FriendsLayout() {};'),
    // this file has no title configured, so it must be derived from its file name
    appendFile(new URL('profile/friends/list.jsx', dir), 'export default function List() {};'),
    appendFile(
      new URL('profile/friends/list-ignored.js', dir),
      "export const config = { title: 'List' };\nexport default function ListIgnored() {};",
    ),
    appendFile(new URL('profile/friends/{user}.tsx', dir), 'const User = function() {};\nexport default User;'),
    appendFile(
      new URL('profile/@index.tsx', dir),
      "export const config = { title: 'Profile' };\nexport default function Profile() {};",
    ),
    appendFile(new URL('profile/index.css', dir), ''),
    appendFile(
      new URL('nameToReplace.tsx', dir),
      "export const config = { route: 'about', title: 'About' };\nexport default function About() {};",
    ),
    appendFile(
      new URL('empty-dir/empty-subdir/empty-dir-ignored.ts', dir),
      'export default function EmptyDirIgnored() {};',
    ),
    appendFile(new URL('empty-dir/empty-file-subdir/empty.tsx', dir), ''),
    appendFile(
      new URL('test/{...wildcard}.tsx', dir),
      "export const config = { title: 'Wildcard' };\nexport default function Wildcard() {};",
    ),
    appendFile(
      new URL('test/{{optional}}.tsx', dir),
      "export const config = { title: 'Optional' };\nexport default function Optional() {};",
    ),
    appendFile(
      new URL('test/issue-002378/{requiredParam}/edit.tsx', dir),
      'export default function Issue002378RequiredParam() {};',
    ),
    appendFile(
      new URL('test/issue-002571-empty-layout/@layout.tsx', dir),
      'export default function Issue002571EmptyLayout() {};',
    ),
    // this file has no title configured, so it must be derived from its file name
    appendFile(
      new URL('test/issue-002879-config-below.tsx', dir),
      'export default function Issue002879ConfigBelow() {};\nexport const config = { title: "Config Below" };',
    ),
    appendFile(new URL('test/empty.tsx', dir), ''),
    appendFile(new URL('test/_ignored.tsx', dir), 'export default function Ignored() {};'),
    appendFile(new URL('test/no-default-export.tsx', dir), 'export const config = { title: "No Default Export" };'),
  ]);
}

export function createTestingRouteMeta(dir: URL): readonly RouteMeta[] {
  return [
    {
      path: 'nameToReplace',
      file: new URL('nameToReplace.tsx', dir),
    },
    {
      path: 'profile',
      children: [
        { path: '', file: new URL('profile/@index.tsx', dir) },
        {
          path: 'account',
          layout: new URL('profile/account/@layout.tsx', dir),
          children: [
            {
              path: 'security',
              children: [
                {
                  path: 'password',
                  file: new URL('profile/account/security/password.jsx', dir),
                },
                {
                  path: 'two-factor-auth',
                  file: new URL('profile/account/security/two-factor-auth.tsx', dir),
                },
              ],
            },
          ],
        },
        {
          path: 'friends',
          layout: new URL('profile/friends/@layout.tsx', dir),
          children: [
            {
              path: 'list',
              file: new URL('profile/friends/list.jsx', dir),
            },
            {
              path: '{user}',
              file: new URL('profile/friends/{user}.tsx', dir),
            },
          ],
        },
      ],
    },
    // Directories where all files are ignored are also ignored (`empty-dir`)
    {
      path: 'test',
      children: [
        // Ignored route that has the name `_ignored.tsx` is not included in the route meta.
        // Also empty files or files without default export are not included.
        {
          path: '{{optional}}',
          file: new URL('test/{{optional}}.tsx', dir),
        },
        {
          path: '{...wildcard}',
          file: new URL('test/{...wildcard}.tsx', dir),
        },
        {
          path: 'issue-002378',
          children: [
            {
              path: '{requiredParam}',
              children: [
                {
                  path: 'edit',
                  file: new URL('test/issue-002378/{requiredParam}/edit.tsx', dir),
                },
              ],
            },
          ],
        },
        {
          path: 'issue-002571-empty-layout',
          layout: new URL('test/issue-002571-empty-layout/@layout.tsx', dir),
          children: [],
        },
        {
          path: 'issue-002879-config-below',
          file: new URL('test/issue-002879-config-below.tsx', dir),
        },
      ],
    },
  ];
}

export const components: Record<string, RouteModule> = {
  about: {
    // eslint-disable-next-line func-name-matching
    default: function About(): JSX.Element {
      return <></>;
    },
    config: { title: 'About', route: 'about', menu: { order: 1 } },
  },
  friends: {
    // eslint-disable-next-line func-name-matching
    default: function Friends(): JSX.Element {
      return <></>;
    },
    config: { title: 'Friends' },
  },
  friendsList: {
    // eslint-disable-next-line func-name-matching
    default: function FriendsList(): JSX.Element {
      return <></>;
    },
    config: { title: 'Friends List', route: 'friends-list' },
  },
  friend: {
    // eslint-disable-next-line func-name-matching
    default: function Friend(): JSX.Element {
      return <></>;
    },
    config: { title: 'Friend' },
  },
  hidden: {
    // eslint-disable-next-line func-name-matching
    default: function Hidden(): JSX.Element {
      return <></>;
    },
    config: { menu: { exclude: true } },
  },
  wildcard: {
    // eslint-disable-next-line func-name-matching
    default: function Wildcard(): JSX.Element {
      return <></>;
    },
    config: { title: 'Wildcard' },
  },
  optional: {
    // eslint-disable-next-line func-name-matching
    default: function Optional(): JSX.Element {
      return <></>;
    },
    config: { title: 'Optional' },
  },
  server: {
    // eslint-disable-next-line func-name-matching
    default: function Server(): JSX.Element {
      return <></>;
    },
    config: { title: 'Server' },
  },
  index: {
    // eslint-disable-next-line func-name-matching
    default: function Index(): JSX.Element {
      return <></>;
    },
    config: { title: 'Index' },
  },
};

export function createLogger(): Logger {
  return {
    info: sinon.stub(),
    warn: sinon.stub(),
    warnOnce: sinon.stub(),
    error: sinon.stub(),
    clearScreen: sinon.stub(),
    hasErrorLogged: sinon.stub(),
    hasWarned: false,
  };
}
