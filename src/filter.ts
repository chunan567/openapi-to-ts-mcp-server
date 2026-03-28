import type { OpenAPIV3 } from 'openapi-types';
import type { FilteredPath } from './types.js';
import { pathsMap, getUrlKey } from './gen/tools.js';

type FilterOptions = {
  spec: OpenAPIV3.Document;
  tags?: string[];
  interfaces?: string[];
};

type FilterResult = {
  paths: FilteredPath[];
  warnings: string[];
};

export function filterInterfaces(options: FilterOptions): FilterResult {
  const { spec, tags, interfaces } = options;
  const result = new Map<string, FilteredPath>();
  const warnings: string[] = [];

  // Collect all available tags for error messages
  const availableTags = new Set<string>();
  pathsMap(spec.paths ?? {}, (op) => {
    if (op.tags?.[0]) availableTags.add(op.tags[0]);
  });

  // Match by tags
  if (tags?.length) {
    for (const tag of tags) {
      if (!availableTags.has(tag)) {
        warnings.push(`Tag "${tag}" not found. Available tags: ${[...availableTags].join(', ')}`);
        continue;
      }
      pathsMap(spec.paths ?? {}, (op) => {
        if (op.tags?.[0] === tag) {
          const key = getUrlKey(op.method, op.url);
          if (!result.has(key)) {
            result.set(key, op);
          }
        }
      });
    }
  }

  // Match by specific interfaces
  if (interfaces?.length) {
    const allOps = new Map<string, FilteredPath>();
    pathsMap(spec.paths ?? {}, (op) => {
      allOps.set(getUrlKey(op.method, op.url), op);
    });

    for (const iface of interfaces) {
      if (allOps.has(iface)) {
        if (!result.has(iface)) {
          result.set(iface, allOps.get(iface)!);
        }
      } else {
        warnings.push(`Interface "${iface}" not found in spec`);
      }
    }
  }

  return { paths: [...result.values()], warnings };
}
