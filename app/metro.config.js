/**
 * Metro config for npm workspaces monorepo.
 *
 * Locally Metro can usually walk up the tree to find the hoisted
 * node_modules at workspace root. EAS Build can't — it uploads the
 * project directory and runs Metro from there without inheriting the
 * workspace context. This config explicitly tells Metro to:
 *   1. WATCH the workspace root (so changes outside app/ trigger reloads in dev)
 *   2. RESOLVE modules from both app/node_modules AND <root>/node_modules
 *   3. DISABLE hierarchical lookup (deterministic resolution — no walking up)
 *
 * Reference: https://docs.expo.dev/guides/monorepos/
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Note: do NOT set disableHierarchicalLookup — some deps (e.g. regenerator-runtime
// nested under react-native/node_modules) need hierarchical lookup to be found.

module.exports = config;
