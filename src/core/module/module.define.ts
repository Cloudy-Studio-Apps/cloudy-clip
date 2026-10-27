import type { ModuleDefinition, ModuleRef } from "./module.types";

/** Creates the typed handle of a module. `Api` is what its `setup` returns as `api`. */
export function defineModuleRef<Api = void>(id: string): ModuleRef<Api> {
  return { id };
}

/** Defines a module. Identity function that checks `setup` returns the ref's API type. */
export function defineModule<Api = void>(definition: ModuleDefinition<Api>): ModuleDefinition<Api> {
  return definition;
}
