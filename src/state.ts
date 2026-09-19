import { createFeltDB } from '@feltdb/core';
import type { GitHubConnection, GitHubEvidenceRecord, GitHubInstallation, GitHubOperationRecord, GitHubRepository, GitHubWebhookEventRecord } from './types.js';

export interface CollectionLike<T> {
  get(id: string): Promise<T | null>;
  insert(value: T, id?: string): Promise<string>;
  update(id: string, value: Partial<T>): Promise<void>;
  find(query?: Partial<T>): Promise<T[]>;
  list(): Promise<T[]>;
}

export interface GitHubIntegrationState {
  db: ReturnType<typeof createFeltDB>;
  connections: CollectionLike<GitHubConnection>;
  installations: CollectionLike<GitHubInstallation>;
  repositories: CollectionLike<GitHubRepository>;
  operations: CollectionLike<GitHubOperationRecord>;
  evidence: CollectionLike<GitHubEvidenceRecord>;
  webhooks: CollectionLike<GitHubWebhookEventRecord>;
}

export function createGitHubIntegrationState(options: Parameters<typeof createFeltDB>[0] = { memory: true, namespace: 'github-integration' }): GitHubIntegrationState {
  const db = createFeltDB(options);
  return {
    db,
    connections: db.collection<GitHubConnection>('GitHubConnection'),
    installations: db.collection<GitHubInstallation>('GitHubInstallation'),
    repositories: db.collection<GitHubRepository>('GitHubRepository'),
    operations: db.collection<GitHubOperationRecord>('GitHubOperation'),
    evidence: db.collection<GitHubEvidenceRecord>('GitHubEvidence'),
    webhooks: db.collection<GitHubWebhookEventRecord>('GitHubWebhookEvent'),
  };
}
