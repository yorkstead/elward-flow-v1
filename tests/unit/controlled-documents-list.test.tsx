import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ControlledDocumentsList } from '@/components/domain/release/controlled-documents-list'

describe('ControlledDocumentsList', () => {
  it('labels packet formats and links each document to its stored file', () => {
    const html = renderToStaticMarkup(
      <ControlledDocumentsList
        jobNumber="12345"
        releaseNumber={2}
        releaseRevisionId="11111111-1111-4111-8111-111111111111"
        documents={[
          {
            id: 'document-1',
            storedFileId: 'stored-file-1',
            classification: 'Cut Drawing',
            name: 'Panel A.pdf',
            revisionLabel: 'A',
            status: 'current',
            updatedAt: '2026-08-22T00:00:00.000Z',
          },
        ]}
      />,
    )

    expect(html).toContain('Drawing PDFs')
    expect(html).toContain('All release files ZIP')
    expect(html).toContain('/packets/cnc?format=pdf')
    expect(html).toContain('href="/api/files/stored-file-1"')
    expect(html).toContain('aria-label="Download Panel A.pdf"')
    expect(html).not.toMatch(/<a[^>]*>\s*<button/)
  })
})
