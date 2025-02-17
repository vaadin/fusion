export default function dir(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}
