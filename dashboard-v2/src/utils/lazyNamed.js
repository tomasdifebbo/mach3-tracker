import { lazy } from 'react';

/**
 * Helper para Lazy Loading de componentes exportados como named exports via React.lazy.
 */
export function lazyNamed(loader, exportName) {
  return lazy(() =>
    loader().then((module) => ({
      default: module[exportName],
    }))
  );
}
