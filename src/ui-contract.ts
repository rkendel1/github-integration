import { capabilityNames } from './capabilities.js';
import type { GitHubUiManifest } from './types.js';

export const APPPORT_UI_PROTOCOL = 'AppPort/ui/1' as const;
export const REQUIRED_COMPOSITION_CONTEXT = ['identity', 'tenant', 'application', 'environment', 'capabilities'] as const;

export function validateUiManifest(manifest: GitHubUiManifest, validCapabilities: readonly string[] = capabilityNames): void {
  if (manifest.protocol !== APPPORT_UI_PROTOCOL) {
    throw new Error(`Unsupported UI protocol: ${manifest.protocol}`);
  }

  const capabilitySet = new Set(validCapabilities);
  const validContext = new Set(REQUIRED_COMPOSITION_CONTEXT);
  const surfaceIds = new Set<string>();
  const actionIds = new Set<string>();

  for (const key of manifest.composition.context) {
    if (!validContext.has(key)) {
      throw new Error(`Invalid composition requirement: ${key}`);
    }
  }

  for (const surface of manifest.surfaces) {
    if (surfaceIds.has(surface.id)) {
      throw new Error(`Duplicate surface id: ${surface.id}`);
    }
    if (!surface.route.startsWith('/')) {
      throw new Error(`Invalid route for surface ${surface.id}: ${surface.route}`);
    }
    surfaceIds.add(surface.id);

    for (const action of surface.actions) {
      if (actionIds.has(action.id)) {
        throw new Error(`Duplicate action id: ${action.id}`);
      }
      if (!action.route.startsWith('/')) {
        throw new Error(`Invalid route for action ${action.id}: ${action.route}`);
      }
      if (!capabilitySet.has(action.capability)) {
        throw new Error(`Invalid capability reference: ${action.capability}`);
      }
      actionIds.add(action.id);
    }
  }
}

export function composeUi(manifests: GitHubUiManifest[], context: { principal?: string; tenant?: string; application?: string; environment?: string; capabilities?: string[] }) {
  const composed: GitHubUiManifest = {
    protocol: APPPORT_UI_PROTOCOL,
    application: { id: context.application ?? 'composed.ui', name: context.application ? `Composed UI (${context.application})` : 'Composed UI' },
    navigation: [],
    composition: { context: REQUIRED_COMPOSITION_CONTEXT },
    configuration: { applicationId: context.application ?? 'composed.ui', status: 'missing', requirements: [] },
    surfaces: [],
  };

  for (const manifest of manifests) {
    validateUiManifest(manifest);
    composed.navigation.push(...manifest.navigation.map((entry) => ({
      ...entry,
      id: `${manifest.application.id}:${entry.id}`,
      route: `/${manifest.application.id}${entry.route}`,
    })));
    composed.surfaces.push(...manifest.surfaces.map((surface) => ({
      ...surface,
      id: `${manifest.application.id}:${surface.id}`,
      route: `/${manifest.application.id}${surface.route}`,
      actions: surface.actions.map((action) => ({
        ...action,
        id: `${manifest.application.id}:${action.id}`,
        route: `/${manifest.application.id}${action.route}`,
      })),
    })));
  }

  const composedCapabilities = [...new Set([...capabilityNames, ...composed.surfaces.flatMap((surface) => surface.actions.map((action) => action.capability))])];
  validateUiManifest(composed, composedCapabilities);
  return composed;
}
