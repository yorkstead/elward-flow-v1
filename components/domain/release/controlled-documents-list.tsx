import { FileText, Download, FileArchive, CheckCircle2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface ReleaseDocumentItem {
  id: string
  storedFileId: string
  classification: string
  name: string
  revisionLabel: string
  status: string
  fileSize?: string
  updatedAt: string
}

interface ControlledDocumentsListProps {
  documents: ReleaseDocumentItem[]
  releaseRevisionId: string | null
  jobNumber: string
  releaseNumber: number
}

export function ControlledDocumentsList({
  documents,
  releaseRevisionId,
  jobNumber,
  releaseNumber,
}: ControlledDocumentsListProps) {
  return (
    <div
      id="controlled-documents"
      aria-label={`Controlled Documents for Release ${jobNumber}-${releaseNumber}`}
      className="scroll-mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Controlled Documents & Packets
          </h2>
          <p className="text-xs text-slate-500">
            Department-ready fabrication and QC drawings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={
              releaseRevisionId
                ? `/api/releases/${releaseRevisionId}/packets/cnc?format=pdf`
                : undefined
            }
            target="_blank"
            rel="noreferrer"
            aria-disabled={!releaseRevisionId}
            className={buttonVariants({
              variant: 'outline',
              size: 'sm',
              className:
                'flex h-8 items-center gap-1.5 border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
            })}
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            Drawing PDFs
          </a>
          <a
            href={
              releaseRevisionId
                ? `/api/releases/${releaseRevisionId}/packets/complete?format=zip`
                : undefined
            }
            target="_blank"
            rel="noreferrer"
            aria-disabled={!releaseRevisionId}
            className={buttonVariants({
              variant: 'outline',
              size: 'sm',
              className:
                'flex h-8 items-center gap-1.5 border-blue-300 bg-blue-50 text-xs font-semibold text-blue-900 hover:bg-blue-100 aria-disabled:pointer-events-none aria-disabled:opacity-50',
            })}
          >
            <FileArchive className="h-3.5 w-3.5" />
            All release files ZIP
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition-all hover:border-blue-300 hover:bg-white hover:shadow-xs"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 shrink-0 rounded border border-slate-200 bg-white p-2 text-blue-600">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-bold text-slate-900">
                    {doc.classification}
                  </span>
                  <Badge
                    variant="outline"
                    className="px-1 py-0 font-mono text-[10px]"
                  >
                    Rev {doc.revisionLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {doc.name}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span>Approved & Controlled</span>
                </div>
              </div>
            </div>

            <a
              href={`/api/files/${doc.storedFileId}`}
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className:
                  'h-7 shrink-0 gap-1 px-2 text-[11px] text-slate-600 hover:bg-blue-50 hover:text-blue-700',
              })}
              title={`Download ${doc.name}`}
              aria-label={`Download ${doc.name}`}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
