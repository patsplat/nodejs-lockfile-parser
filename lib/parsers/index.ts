import { PackageLock } from './package-lock-parser';
import { YarnLock } from './yarn-lock-parse';
import { InvalidUserInputError } from '../errors';
// import { Yarn2Lock } from './yarn2-lock-parse';

export interface Dep {
  name: string;
  version: string;
  dev?: boolean;
}

interface WorkspacesAlternateConfig {
  packages?: string[];
}

export interface ManifestFile {
  name: string;
  private?: string;
  engines?: {
    node?: string;
  };
  workspaces?: string[] | WorkspacesAlternateConfig;
  dependencies?: {
    [dep: string]: string;
  };
  devDependencies?: {
    [dep: string]: string;
  };
  version?: string;
}

// This is a copy/paste from https://github.com/snyk/dep-graph/blob/master/src/legacy/index.ts
// and should be removed in favour of depgraph library interface

export interface DepTreeDep {
  name?: string; // shouldn't, but might happen
  version?: string; // shouldn't, but might happen
  dependencies?: {
    [depName: string]: DepTreeDep;
  };
  labels?: {
    [key: string]: string | undefined;
    scope?: 'dev' | 'prod';
    pruned?: 'cyclic' | 'true';
    missingLockFileEntry?: 'true';
  };
}

export interface PkgTree extends DepTreeDep {
  type?: string;
  packageFormatVersion?: string;
  dependencies: {
    [depName: string]: DepTreeDep;
  };
  meta?: {
    nodeVersion: string;
    packageManagerVersion?: string;
  };
  hasDevDependencies?: boolean;
  cyclic?: boolean;
  size?: number;
}

export enum Scope {
  prod = 'prod',
  dev = 'dev',
}

export enum LockfileType {
  npm = 'npm',
  yarn = 'yarn',
  yarn2 = 'yarn2',
}

export interface LockfileParser {
  parseLockFile: (lockFileContents: string) => Lockfile;
  getDependencyTree: (
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev?: boolean,
    strict?: boolean,
  ) => Promise<PkgTree>;
}

export type Lockfile = PackageLock | YarnLock; // | Yarn2Lock;

export function parseManifestFile(manifestFileContents: string): ManifestFile {
  try {
    return JSON.parse(manifestFileContents);
  } catch (e) {
    throw new InvalidUserInputError(
      'package.json parsing failed with error ' + e.message,
    );
  }
}

export function getTopLevelDeps(
  targetFile: ManifestFile,
  includeDev: boolean,
): Dep[] {
  const dependencies: Dep[] = [];

  const dependenciesIterator = Object.entries({
    ...targetFile.dependencies,
    ...(includeDev ? targetFile.devDependencies : null),
  });

  for (const [name, version] of dependenciesIterator) {
    dependencies.push({
      dev:
        includeDev && targetFile.devDependencies
          ? !!targetFile.devDependencies[name]
          : false,
      name,
      version,
    });
  }

  return dependencies;
}

export function createDepTreeDepFromDep(dep: Dep): DepTreeDep {
  return {
    labels: {
      scope: dep.dev ? Scope.dev : Scope.prod,
    },
    name: dep.name,
    version: dep.version,
  };
}

export function getYarnWorkspaces(targetFile: string): string[] | false {
  try {
    const packageJson: ManifestFile = parseManifestFile(targetFile);
    if (!!packageJson.workspaces && !!packageJson.private) {
      const workspacesPackages = packageJson.workspaces as string[];
      const workspacesAlternateConfigPackages = (packageJson.workspaces as WorkspacesAlternateConfig)
        .packages;
      return [...(workspacesAlternateConfigPackages || workspacesPackages)];
    }
    return false;
  } catch (e) {
    throw new InvalidUserInputError(
      'package.json parsing failed with ' + `error ${e.message}`,
    );
  }
}
