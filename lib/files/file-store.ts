export type StoredObject = {
  key: string
  contentType: string
  byteSize: number
  sha256: string
}

export interface PutImmutableObjectInput {
  key: string
  body: Uint8Array
  contentType: string
  expectedSha256?: string
}

export interface FileStore {
  ensureReady(): Promise<void>
  putImmutable(input: PutImmutableObjectInput): Promise<StoredObject>
  get(
    key: string,
  ): Promise<{ body: Uint8Array; contentType: string; sha256: string }>
}
