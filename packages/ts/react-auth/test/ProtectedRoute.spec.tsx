import { expect } from '@esm-bundle/chai';
import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthContext, type AuthUser, protectRoutes, type RouteObjectWithAuth, useAuth } from '../src';

function TestView({ route }: { route: string }) {
  return <div>{`route: ${route}`}</div>;
}

const testRoutes: RouteObjectWithAuth[] = [
  {
    path: '/login',
    element: <TestView route="/login" />,
  },
  {
    path: '/public',
    element: <TestView route="/public" />,
  },
  {
    path: '/protected/login',
    element: <TestView route="/protected/login" />,
    handle: {
      requiresLogin: true,
    },
  },
  {
    path: '/protected/role/user',
    element: <TestView route="/protected/role/user" />,
    handle: {
      requiresLogin: true,
      rolesAllowed: ['user'],
    },
  },
  {
    path: '/protected/role/admin',
    element: <TestView route="/protected/role/admin" />,
    handle: {
      requiresLogin: true,
      rolesAllowed: ['admin'],
    },
  },
];

function TestApp({ user, initialRoute }: { user?: AuthUser; initialRoute: string }) {
  const auth = useAuth(async () => Promise.resolve(user));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (auth.state as any).user = user;
  const protectedRoutes = protectRoutes(testRoutes);
  const router = createMemoryRouter(protectedRoutes, {
    initialEntries: [initialRoute],
  });

  return (
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  );
}

describe('@hilla/react-auth', () => {
  describe('protectRoutes', () => {
    async function testRoute(route: string, user: AuthUser | undefined, canAccess: boolean) {
      const result = render(<TestApp initialRoute={route} user={user} />);
      const expectedText = canAccess ? `route: ${route}` : 'route: /login';
      await waitFor(() => expect(result.getByText(expectedText)).to.exist);
      result.unmount();
    }

    it('should protect routes when no user is authenticated', async () => {
      await testRoute('/public', undefined, true);
      await testRoute('/protected/login', undefined, false);
      await testRoute('/protected/role/user', undefined, false);
      await testRoute('/protected/role/admin', undefined, false);
    });

    it('should protect routes when user without roles is authenticated', async () => {
      const user = { name: 'John' };
      await testRoute('/public', user, true);
      await testRoute('/protected/login', user, true);
      await testRoute('/protected/role/user', user, false);
      await testRoute('/protected/role/admin', user, false);
    });

    it('should protect routes when user with user role is authenticated', async () => {
      const user = { name: 'John', roles: ['user'] };
      await testRoute('/public', user, true);
      await testRoute('/protected/login', user, true);
      await testRoute('/protected/role/user', user, true);
      await testRoute('/protected/role/admin', user, false);
    });

    it('should protect routes when user with all roles is authenticated', async () => {
      const user = { name: 'John', roles: ['user', 'admin'] };
      await testRoute('/public', user, true);
      await testRoute('/protected/login', user, true);
      await testRoute('/protected/role/user', user, true);
      await testRoute('/protected/role/admin', user, true);
    });
  });
});
