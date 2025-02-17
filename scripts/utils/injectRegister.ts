import type { PackageJson } from 'type-fest';

export default function injectRegister(contents: string, { name, version }: PackageJson): string {
  return contents.replaceAll(
    /__REGISTER__/gu,
    `((feature, vaadinObj = (window.Vaadin ??= {})) => {
  vaadinObj.registrations ??= [];
  vaadinObj.registrations.push({
    is: feature ? \`${name}/\${feature}\` : '${name}',
    version: '${version}',
  });
})`,
  );
}
