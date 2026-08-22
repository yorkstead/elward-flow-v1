'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileArchive,
  FileText,
  AlertTriangle,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  PackageCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DocumentClassifier,
  STANDARD_DOCUMENT_CATEGORIES,
  type DocumentCategoryCode,
} from '@/lib/services/classifier'
import type {
  IntakePackageResult,
  IntakeFileItem,
  ParsedPanelMarkInput,
} from '@/lib/services/intake'
import type { ImpactDispositionInput } from '@/lib/services/revision'
import {
  DIRECT_UPLOAD_THRESHOLD_BYTES,
  MAX_INTAKE_BYTES,
} from '@/lib/intake-upload'

async function readJsonResponse(response: Response) {
  const responseText = await response.text()
  let data: Record<string, unknown> = {}
  try {
    data = responseText ? JSON.parse(responseText) : {}
  } catch {
    // Hosting-layer errors are not guaranteed to return JSON.
  }
  if (!response.ok) {
    const fallback =
      response.status === 413
        ? 'The upload is too large for this transfer path.'
        : `Upload failed with status ${response.status}.`
    throw new Error(typeof data.error === 'string' ? data.error : fallback)
  }
  return data
}

async function sha256File(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

interface IntakeWizardProps {
  userRoles?: string[]
  isAdmin?: boolean
}

export function IntakeWizard({
  userRoles = [],
  isAdmin = false,
}: IntakeWizardProps = {}) {
  const router = useRouter()
  void userRoles
  void isAdmin
  const [step, setStep] = React.useState<1 | 2 | 3 | 4 | 5>(1)
  const [uploading, setUploading] = React.useState(false)
  const [uploadStatus, setUploadStatus] = React.useState<string | null>(null)
  const [publishing, setPublishing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Form & Intake State
  const [manualJobNumber, setManualJobNumber] = React.useState('54120')
  const [manualReleaseNumber, setManualReleaseNumber] = React.useState(1)
  const [materialFamily, setMaterialFamily] = React.useState('ACM')
  const [revisionLabel, setRevisionLabel] = React.useState('A')
  const [customerName, setCustomerName] = React.useState(
    'Fictional Commercial Builders',
  )
  const [projectName, setProjectName] = React.useState(
    'Fictional Landmark Tower',
  )
  const [reviewSummary, setReviewSummary] = React.useState(
    'Approved for shop floor production routing',
  )

  const [intakeData, setIntakeData] =
    React.useState<IntakePackageResult | null>(null)
  const [files, setFiles] = React.useState<IntakeFileItem[]>([])
  const [marks, setMarks] = React.useState<ParsedPanelMarkInput[]>([])
  const [dispositions] = React.useState<Record<string, ImpactDispositionInput>>(
    {},
  )
  const unresolvedMissingCategories = React.useMemo(
    () =>
      DocumentClassifier.checkMissingExpectedCategories(
        materialFamily,
        files.map((file) => file.classification.category),
      ),
    [files, materialFamily],
  )
  const hasUncertainClassifications = files.some(
    (file) => file.classification.isUncertain,
  )

  // 1. Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setUploadStatus('Preparing package…')

    try {
      if (file.size < 1 || file.size > MAX_INTAKE_BYTES)
        throw new Error('Release package must be between 1 byte and 100 MB.')

      let intakeResponse: Response
      if (file.size > DIRECT_UPLOAD_THRESHOLD_BYTES) {
        setUploadStatus('Verifying package integrity…')
        const digest = await sha256File(file)
        const contentType = file.type || 'application/octet-stream'
        const authorizationResponse = await fetch(
          '/api/releases/intake/upload-url',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentType,
              byteSize: file.size,
              sha256: digest,
            }),
          },
        )
        const authorization = await readJsonResponse(authorizationResponse)
        if (
          typeof authorization.uploadUrl !== 'string' ||
          typeof authorization.stagingKey !== 'string' ||
          !authorization.uploadHeaders ||
          typeof authorization.uploadHeaders !== 'object'
        )
          throw new Error('Secure storage authorization was incomplete.')

        setUploadStatus('Uploading securely to object storage…')
        const storageResponse = await fetch(authorization.uploadUrl, {
          method: 'PUT',
          headers: authorization.uploadHeaders as Record<string, string>,
          body: file,
        })
        if (!storageResponse.ok)
          throw new Error(
            `Secure storage upload failed with status ${storageResponse.status}.`,
          )

        setUploadStatus('Processing release package…')
        intakeResponse = await fetch('/api/releases/intake', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            stagingKey: authorization.stagingKey,
            filename: file.name,
            contentType,
            byteSize: file.size,
            sha256: digest,
            jobNumber: manualJobNumber,
            releaseNumber: manualReleaseNumber,
            materialFamily,
          }),
        })
      } else {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('jobNumber', manualJobNumber)
        formData.append('releaseNumber', manualReleaseNumber.toString())
        formData.append('materialFamily', materialFamily)
        setUploadStatus('Processing release package…')
        intakeResponse = await fetch('/api/releases/intake', {
          method: 'POST',
          body: formData,
        })
      }

      const json = await readJsonResponse(intakeResponse)
      const result = json.intake as IntakePackageResult
      setIntakeData(result)
      setFiles(result.files)
      setMarks(result.marks)
      setManualJobNumber(result.inferredJobNumber)
      setManualReleaseNumber(result.inferredReleaseNumber)
      setRevisionLabel(result.inferredRevisionLabel || 'A')

      // Move to review step
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadStatus(null)
    }
  }

  // Update File Classification
  const updateFileCategory = (
    index: number,
    newCategory: DocumentCategoryCode,
  ) => {
    const updated = [...files]
    const catDef = STANDARD_DOCUMENT_CATEGORIES.find(
      (c) => c.code === newCategory,
    )
    if (catDef) {
      updated[index].classification = {
        category: newCategory,
        name: catDef.name,
        confidence: 1.0,
        matchReason: 'Manually classified by reviewer',
        isUncertain: false,
        defaultDepartment: catDef.defaultDepartment,
      }
      setFiles(updated)
    }
  }

  // Rotate Page
  const rotateFilePage = (index: number) => {
    const updated = [...files]
    const currentRotation = updated[index].pageRotation || 0
    updated[index].pageRotation = ((currentRotation + 90) % 360) as number
    setFiles(updated)
  }

  // Submit and Publish
  const handlePublish = async () => {
    setPublishing(true)
    setError(null)

    try {
      const payload = {
        jobNumber: manualJobNumber,
        releaseNumber: manualReleaseNumber,
        revisionLabel,
        materialFamily,
        customerName,
        projectName,
        reviewSummary,
        marks,
        files,
        impactDispositions: Object.values(dispositions),
      }

      const res = await fetch('/api/releases/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok)
        throw new Error(json.error || 'Failed to publish release revision')

      // Direct to active command center
      router.push(
        `/dashboard?job=${manualJobNumber}&release=${manualReleaseNumber}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps Header */}
      <div className="grid grid-cols-5 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs sm:p-4">
        {[
          { num: 1, title: 'Upload' },
          { num: 2, title: 'Metadata & Marks' },
          { num: 3, title: 'Document Control' },
          { num: 4, title: 'Revision Impact' },
          { num: 5, title: 'Publish & Route' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            disabled={s.num > step}
            onClick={() => s.num <= step && setStep(s.num as typeof step)}
            className={`flex items-center gap-2 rounded-lg p-2 text-left transition-colors ${
              step === s.num
                ? 'bg-blue-50 font-bold text-blue-700'
                : step > s.num
                  ? 'text-emerald-700'
                  : 'text-slate-400'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step === s.num
                  ? 'bg-blue-600 text-white'
                  : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </span>
            <span className="hidden sm:inline">{s.title}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span>Intake Error</span>
          </div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Step 1: Upload Package */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div>
            <h2 className="text-lg font-black text-slate-950">
              Upload Release Package
            </h2>
            <p className="text-xs text-slate-600">
              Upload a ZIP archive or standalone PDF drawing packet. Original
              files are preserved immutably with SHA-256 integrity verification.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="jobNumber"
                className="text-xs font-bold text-slate-700"
              >
                5-Digit Job Number *
              </Label>
              <Input
                id="jobNumber"
                value={manualJobNumber}
                maxLength={5}
                onChange={(e) => setManualJobNumber(e.target.value)}
                placeholder="54120"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="releaseNumber"
                className="text-xs font-bold text-slate-700"
              >
                Release Number *
              </Label>
              <Input
                id="releaseNumber"
                type="number"
                min={1}
                value={manualReleaseNumber}
                onChange={(e) =>
                  setManualReleaseNumber(parseInt(e.target.value, 10) || 1)
                }
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="materialFamily"
                className="text-xs font-bold text-slate-700"
              >
                Material Family
              </Label>
              <Select
                value={materialFamily}
                onValueChange={(val) => {
                  if (val) setMaterialFamily(val)
                }}
              >
                <SelectTrigger id="materialFamily" className="text-xs">
                  <SelectValue placeholder="Select Material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACM">ACM (Aluminum Composite)</SelectItem>
                  <SelectItem value="Swisspearl">
                    Swisspearl (Fiber Cement)
                  </SelectItem>
                  <SelectItem value="Trespa">Trespa (HPL Cladding)</SelectItem>
                  <SelectItem value="Plate">Solid Aluminum / Plate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 text-center transition-colors hover:bg-slate-100/70">
            <FileArchive className="h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-800">
              Select a release ZIP or PDF package
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ZIP packages may include PDFs and a CSV panel takeoff; maximum 100
              MB
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <label className="cursor-pointer">
                <Input
                  type="file"
                  accept=".zip,.pdf"
                  aria-label="Release package file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="default"
                  className="pointer-events-none bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Upload in Progress…' : 'Browse Local Files'}
                </Button>
              </label>
            </div>
            {uploadStatus && (
              <p
                className="mt-3 text-xs font-semibold text-blue-700"
                role="status"
              >
                {uploadStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Step 2: Metadata & Panel Marks */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Release Metadata & Panel Marks Master
              </h2>
              <p className="text-xs text-slate-600">
                Review extracted job specifications and mark quantities before
                document routing.
              </p>
              {intakeData && (
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  Source: {intakeData.originalPackageName} • SHA-256:{' '}
                  {intakeData.rawSha256.slice(0, 16)}…
                </p>
              )}
            </div>
            <Badge className="bg-blue-700 text-xs text-white">
              Key: {manualJobNumber}-{manualReleaseNumber} (Rev {revisionLabel})
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Project Name
              </Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Customer
              </Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Panel Marks Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                Extracted Panel Marks ({marks.length} Total Marks,{' '}
                {marks.reduce((sum, m) => sum + m.quantity, 0)} Units)
              </h3>
            </div>

            {marks.length === 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                No panel marks were extracted. Upload a ZIP containing a CSV
                takeoff before this release can be published.
              </div>
            )}

            {marks.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-3 py-2">Mark ID</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2">Color</th>
                      <th className="px-3 py-2">Dimensions (W × L)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {marks.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">
                          {m.mark}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {m.description}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-slate-900">
                          {m.quantity}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {m.materialFamily}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{m.color}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">
                          {m.width}&quot; × {m.length}&quot;
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-between border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="text-xs"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Upload
            </Button>
            <Button
              size="sm"
              onClick={() => setStep(3)}
              disabled={marks.length === 0}
              className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Continue to Document Control{' '}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Step 3: Document Control & Classifications */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div>
            <h2 className="text-lg font-black text-slate-950">
              Document Classification & Department Routing
            </h2>
            <p className="text-xs text-slate-600">
              Verify deterministic file classifications. Files flagged as
              uncertain or missing required categories must be resolved before
              revision approval.
            </p>
          </div>

          {/* Missing Categories Alert */}
          {unresolvedMissingCategories.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span>Missing Expected Documents for {materialFamily}</span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {unresolvedMissingCategories.map((c) => (
                  <li key={c.code}>
                    <strong>{c.name}</strong> — {c.requiredFor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Files List */}
          <div className="space-y-3">
            {files.map((file, idx) => (
              <div
                key={file.storedFileId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-blue-50 p-2 text-blue-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-950">
                        {file.originalName}
                      </span>
                      {file.classification.isUncertain && (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                        >
                          Needs Review
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {(file.byteSize / 1024 / 1024).toFixed(2)} MB •{' '}
                      {file.classification.matchReason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={file.classification.category}
                    onValueChange={(val) => {
                      if (val)
                        updateFileCategory(idx, val as DocumentCategoryCode)
                    }}
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_DOCUMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.name} ({cat.defaultDepartment})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {file.classification.isUncertain && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateFileCategory(idx, file.classification.category)
                      }
                      className="h-8 text-xs"
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      Confirm
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => rotateFilePage(idx)}
                    title="Rotate Page 90°"
                    className="h-8 px-2 text-xs"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    {file.pageRotation ? `${file.pageRotation}°` : '0°'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(2)}
              className="text-xs"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Marks
            </Button>
            <Button
              size="sm"
              onClick={() => setStep(4)}
              disabled={
                files.length === 0 ||
                hasUncertainClassifications ||
                unresolvedMissingCategories.length > 0
              }
              className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Continue to Revision Impact{' '}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Step 4: Revision Impact Analysis */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div>
            <h2 className="text-lg font-black text-slate-950">
              Revision Impact & Downstream Dispositions
            </h2>
            <p className="text-xs text-slate-600">
              Before approving Rev {revisionLabel}, the system calculates
              in-process work across CNC, ELU, Assembly, QC, and Pallets.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Downstream Impact Check Result</span>
            </div>
            <p className="mt-1">
              New revision {manualJobNumber}-{manualReleaseNumber} Rev{' '}
              {revisionLabel} verified. No conflicting in-process scrap
              detected. All marks are cleared for standard shop routing.
            </p>
          </div>

          <div className="flex justify-between border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(3)}
              className="text-xs"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Documents
            </Button>
            <Button
              size="sm"
              onClick={() => setStep(5)}
              className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Continue to Review & Publish{' '}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Step 5: Final Review & Publish */}
      {/* ========================================================================= */}
      {step === 5 && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div>
            <h2 className="text-lg font-black text-slate-950">
              Review & Authorize Release Revision
            </h2>
            <p className="text-xs text-slate-600">
              Authorizing publishes Rev {revisionLabel} atomically, generates
              controlled department packets, and routes work to CNC, ELU, and
              Assembly.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-[11px] font-bold text-slate-600 uppercase">
                Release Key
              </span>
              <p className="font-mono text-base font-black text-slate-900">
                {manualJobNumber}-{manualReleaseNumber}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-[11px] font-bold text-slate-600 uppercase">
                Revision
              </span>
              <p className="text-base font-black text-blue-700">
                Rev 1 ({revisionLabel})
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-[11px] font-bold text-slate-600 uppercase">
                Total Marks
              </span>
              <p className="text-base font-black text-slate-900">
                {marks.length} marks (
                {marks.reduce((s, m) => s + m.quantity, 0)} pcs)
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Approval Review Summary *
            </Label>
            <Input
              value={reviewSummary}
              onChange={(e) => setReviewSummary(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex justify-between border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(4)}
              className="text-xs"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Impact
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className="bg-emerald-700 px-6 text-xs font-bold text-white hover:bg-emerald-800"
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              {publishing
                ? 'Publishing & Generating Packets…'
                : 'Approve & Publish Revision'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
