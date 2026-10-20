import { writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { PORTABLE_PLUGIN_LAYOUT } from '../schema.js';

/** Portable metadata belongs to the package; client mechanics live in extensions. */
export interface PortablePackageMetadata {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: { readonly name: string; readonly email?: string; readonly url?: string };
  readonly homepage?: string;
  readonly repository?: string;
  readonly license?: string;
  readonly keywords?: readonly string[];
}

export interface PortableDeliveryContract {
  readonly format: 'agent-plugins-1.0';
  readonly metadata: PortablePackageMetadata;
  readonly extensions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** Emit only portable core fields; a host extension cannot override package identity. */
export function writePortableManifest(directory: string, contract: PortableDeliveryContract): void {
  const { metadata, extensions } = contract;
  const manifest = {
    $schema: PORTABLE_PLUGIN_LAYOUT.manifestSchema,
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author,
    homepage: metadata.homepage,
    repository: metadata.repository,
    license: metadata.license,
    keywords: metadata.keywords,
    extensions,
  };
  writeFileSync(
    nodePath.join(directory, PORTABLE_PLUGIN_LAYOUT.manifest),
    `${JSON.stringify(manifest, undefined, 2)}\n`,
  );
}
