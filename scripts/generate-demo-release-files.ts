import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

function sanitizeText(str: string): string {
  return str
    .replace(/[—–]/g, '-')
    .replace(/[•·]/g, '*')
    .replace(/[➔→]/g, '->')
    .replace(/[°]/g, ' deg')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[^\x20-\x7E]/g, ' ')
}

async function createSamplePdf(
  title: string,
  subtitle: string,
  sections: { heading: string; lines: string[] }[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792]) // Standard US Letter
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontMono = await doc.embedFont(StandardFonts.Courier)

  // Header Banner
  page.drawRectangle({
    x: 36,
    y: 720,
    width: 540,
    height: 44,
    color: rgb(0.08, 0.13, 0.24), // #14213d Navy
  })

  page.drawText(
    sanitizeText('ELLWOOD SYSTEMS -- OPERATIONAL CONTROLLED DOCUMENT'),
    {
      x: 48,
      y: 742,
      size: 9,
      font: fontBold,
      color: rgb(0.85, 0.88, 0.95),
    },
  )

  page.drawText(sanitizeText(title.toUpperCase()), {
    x: 48,
    y: 728,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  // Subtitle / Metadata bar
  page.drawText(
    sanitizeText(
      `JOB: 25036  |  RELEASE: 1  |  REV: A  |  DATE: ${new Date().toISOString().split('T')[0]}  |  ${subtitle}`,
    ),
    {
      x: 36,
      y: 702,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.35, 0.45),
    },
  )

  page.drawLine({
    start: { x: 36, y: 694 },
    end: { x: 576, y: 694 },
    thickness: 1,
    color: rgb(0.8, 0.85, 0.9),
  })

  let y = 670
  for (const section of sections) {
    if (y < 80) break
    page.drawText(sanitizeText(section.heading), {
      x: 36,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.12, 0.18, 0.3),
    })
    y -= 16

    for (const line of section.lines) {
      if (y < 60) break
      page.drawText(sanitizeText(line), {
        x: 44,
        y,
        size: 8.5,
        font:
          line.includes('|') || line.startsWith('  ') ? fontMono : fontRegular,
        color: rgb(0.2, 0.25, 0.3),
      })
      y -= 13
    }
    y -= 10
  }

  // Footer
  page.drawRectangle({
    x: 36,
    y: 30,
    width: 540,
    height: 18,
    color: rgb(0.95, 0.96, 0.98),
  })

  page.drawText(
    sanitizeText(
      'CONFIDENTIAL & PROPRIETARY -- ELLWOOD SYSTEMS CORPORATION -- SHOP FLOOR RELEASE CONTROL',
    ),
    {
      x: 48,
      y: 35,
      size: 6.5,
      font: fontBold,
      color: rgb(0.4, 0.45, 0.55),
    },
  )

  return await doc.save()
}

export async function generateDemoReleaseFiles() {
  console.log(
    '--- Generating Controlled Release Documents & Demo Package for Job 25036 ---',
  )
  const fixturesDir = path.resolve(process.cwd(), 'fixtures')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  const zip = new JSZip()

  // 1. Takeoff Schedule CSV
  const takeoffCsvContent = [
    'Mark,Qty,Width,Height,Material,Color,Finish,AreaSqFt,WeightLbs,Elevation,Notes',
    'P-101,4,48.00,96.00,ACM,Charcoal Grey,Solid 2-Coat PVDF,32.00,38.40,North Elevation,Standard Field Panel w/ perimeter return flanges',
    'P-102,4,48.00,96.00,ACM,Charcoal Grey,Solid 2-Coat PVDF,32.00,38.40,North Elevation,Standard Field Panel w/ perimeter return flanges',
    'P-103,4,48.00,120.00,ACM,Bright Silver,Metallic 3-Coat PVDF,40.00,48.00,North Elevation,Full Height Spandrel Panel',
    'P-104,2,48.00,120.00,ACM,Bright Silver,Metallic 3-Coat PVDF,40.00,48.00,East Elevation,Parapet Coping Transition Panel',
    'P-105,3,36.00,96.00,ACM,Charcoal Grey,Solid 2-Coat PVDF,24.00,28.80,East Elevation,Window Return Infill Panel',
    'P-106,3,36.00,96.00,ACM,Charcoal Grey,Solid 2-Coat PVDF,24.00,28.80,South Elevation,Window Return Infill Panel',
    'P-107,2,60.00,120.00,ACM,Bone White,Solid 2-Coat PVDF,50.00,60.00,South Elevation,Main Entrance Soffit Cladding',
    'P-108,2,60.00,120.00,ACM,Bone White,Solid 2-Coat PVDF,50.00,60.00,West Elevation,Main Entrance Soffit Cladding',
    'C-201,4,24.00,96.00,ACM,Charcoal Grey,Solid 2-Coat PVDF,16.00,19.20,North Elevation,Outside 90-Degree Corner Column Panel',
    'C-202,2,24.00,120.00,ACM,Bright Silver,Metallic 3-Coat PVDF,20.00,24.00,East Elevation,Outside 90-Degree Corner Column Panel',
    'S-301,6,30.00,72.00,ACM,Classic Bronze,Mica 2-Coat PVDF,15.00,18.00,Canopy,Underside Canopy Soffit Panel w/ weep holes',
    'S-302,4,30.00,72.00,ACM,Classic Bronze,Mica 2-Coat PVDF,15.00,18.00,Canopy,Underside Canopy Soffit Panel w/ weep holes',
  ].join('\n')

  zip.file('25036_TAKEOFF_R1.csv', takeoffCsvContent)
  fs.writeFileSync(
    path.join(fixturesDir, '25036_TAKEOFF_R1.csv'),
    takeoffCsvContent,
  )

  // 2. Table Layouts (CNC Bed Optimization)
  const tableLayoutPdf = await createSamplePdf(
    'CNC Table Nesting Layout — Bed 1 & 2',
    'Routing Bed 5ft x 12ft Vacuum Table',
    [
      {
        heading: '1. Nesting Summary & Sheet Allocation',
        lines: [
          'Table Bed: CNC-01 (Thermwood Model 70 5x12 Bed)',
          'Raw Sheet: 4mm Mitsubishi ACM Charcoal Grey (48" x 96")',
          'Yield Efficiency: 94.2%  |  Tool: 1/4" Spiral O-Flute + 90° V-Groove',
          '---------------------------------------------------------------------------------',
          'Nesting Position | Mark  | Dimensions      | Flanges (L/R/T/B) | Toolpath File',
          'Pos 1 (X:0, Y:0) | P-101 | 48.00" x 48.00" | 1.0" / 1.0" / 1.0" / 1.0" | 25036_1_P101.tap',
          'Pos 2 (X:0, Y:48)| P-102 | 48.00" x 48.00" | 1.0" / 1.0" / 1.0" / 1.0" | 25036_1_P102.tap',
          'Pos 3 (X:48, Y:0)| C-201 | 24.00" x 96.00" | 1.0" / 1.0" / 1.0" / 1.0" | 25036_1_C201.tap',
        ],
      },
      {
        heading: '2. Operator Instructions',
        lines: [
          '• Verify protective masking film orientation and grain direction arrow prior to vacuum pull-down.',
          '• Set Z-Zero to spoilboard face. V-groove skin retention target: 0.030" +/- 0.005".',
          '• Verify perimeter tabs (4 per panel) prior to final perimeter cut-out cycle.',
        ],
      },
    ],
  )
  zip.file('25036-R1 Table Layout Bed 1.pdf', tableLayoutPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Table Layout Bed 1.pdf'),
    tableLayoutPdf,
  )

  // 3. CNC Cut Drawings
  const cutDrawingsPdf = await createSamplePdf(
    'CNC Routing & Cut Profile Drawings',
    'Sheet Profiles, Kerf Allowances & V-Groove Details',
    [
      {
        heading: '1. Panel Mark Geometry & Flange Profiles',
        lines: [
          'Mark P-101 (Qty 4): Finished Face 46.00" x 94.00" (Stretch-Out 48.00" x 96.00")',
          '  - Flange North: 1.000" return w/ #12 screw pilot holes @ 12.0" O.C.',
          '  - Flange South: 1.000" return w/ slot-drain weeping weep notch @ quarter-points',
          '  - Flange East / West: 1.000" perimeter return for ALU-EXT-4001 insertion',
          '  - V-Groove: 90-degree 0.090" depth leaving 0.030" aluminum skin',
          '---------------------------------------------------------------------------------',
          'Mark C-201 (Qty 4 Outside Corner): Finished Face (12.00"+12.00") x 96.00"',
          '  - Center bend groove: Single continuous V-groove at X=24.000"',
          '  - Flange returns: 1.000" left/right return for structural clip attachment',
        ],
      },
      {
        heading: '2. Machine Parameters',
        lines: [
          '• Spindle Speed: 18,000 RPM  |  Feed Rate: 250 IPM  |  Ramp Entry: 45° smooth spiral',
          '• Coolant / Air Blast: Continuous vortex cold air gun on cutter flute.',
        ],
      },
    ],
  )
  zip.file('25036-R1 Cut Drawings CNC.pdf', cutDrawingsPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Cut Drawings CNC.pdf'),
    cutDrawingsPdf,
  )

  // 4. Extrusion Cut List (ELU Saw)
  const extrusionCutListPdf = await createSamplePdf(
    'ELU Saw Extrusion Cut List',
    'Saw Station Cut Schedule — 24ft Mill Stock Bars',
    [
      {
        heading: '1. Extrusion Profile 4001 (Perimeter Frame Track)',
        lines: [
          'Stock Length: 288.0" (24 ft)  |  Miter Angles: 45° / 45° and 90° Square',
          'Cut Item | Mark Ref | Length (Inches) | Angle Left | Angle Right | Qty | Bar Allocation',
          'EXT-01   | P-101    | 94.000"         | 45° Miter  | 45° Miter   | 8   | Stock Bar 1-3',
          'EXT-02   | P-101    | 46.000"         | 45° Miter  | 45° Miter   | 8   | Stock Bar 4-5',
          'EXT-03   | P-103    | 118.000"        | 45° Miter  | 45° Miter   | 8   | Stock Bar 6-9',
          'EXT-04   | P-103    | 46.000"         | 45° Miter  | 45° Miter   | 8   | Stock Bar 10-11',
          'EXT-05   | C-201    | 94.000"         | 90° Square | 90° Square  | 8   | Stock Bar 12-14',
        ],
      },
      {
        heading: '2. Extrusion Profile 4002 (Intermediate Stiffener)',
        lines: [
          'Stock Length: 288.0" (24 ft)  |  Cut: 90° Square Cut',
          'STF-01   | P-103    | 44.250"         | 90° Square | 90° Square  | 12  | Stock Bar 15-16',
          'STF-02   | P-107    | 58.250"         | 90° Square | 90° Square  | 6   | Stock Bar 17',
        ],
      },
    ],
  )
  zip.file('25036-R1 Extrusion Cut List.pdf', extrusionCutListPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Extrusion Cut List.pdf'),
    extrusionCutListPdf,
  )

  // 5. Assembly Drawings (Parts Prep & Assembly)
  const assemblyDrawingsPdf = await createSamplePdf(
    'Mechanical Assembly Drawings',
    'Parts Prep & 3-Row Assembly Workstations',
    [
      {
        heading: '1. Frame Assembly & Stiffener Placement',
        lines: [
          '• Panel Sub-Assembly Sequence: Perimeter Frame ➔ Structural Clips ➔ Intermediate Stiffener ➔ Gasket',
          '• Rivet Pattern: 3/16" 316 Stainless Steel blind rivets @ 12.0" maximum center-to-center.',
          '• Corner Joints: Stake corner keys with pneumatic crimper or fasten with #10-16 SS screws.',
          '• Structural Adhesive: Apply continuous structural silicone bead (Dow Corning 983 / Sika 205) along 4002 stiffeners.',
        ],
      },
      {
        heading: '2. Quality Checkpoint Checklist',
        lines: [
          '[ ] Squareness Tolerance: Diagonal check within +/- 1/16" across opposite corners.',
          '[ ] Flange Depth: Uniform 1.00" return without oil canning or waviness.',
          '[ ] Rivet Seating: Flush mandrel break with no protruding burrs or loose heads.',
          '[ ] Gasket Insertion: Fully seated continuous EPDM gasket without stretching or bunching.',
        ],
      },
    ],
  )
  zip.file('25036-R1 Assembly Drawings.pdf', assemblyDrawingsPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Assembly Drawings.pdf'),
    assemblyDrawingsPdf,
  )

  // 6. Shop Drawings & Elevation Matrix
  const shopDrawingsPdf = await createSamplePdf(
    'Architectural Shop Drawings & Elevation Plan',
    'Tempe Gateway Commercial Center — Phase II',
    [
      {
        heading: '1. Elevation Reference Grid',
        lines: [
          'North Elevation (Grid Lines A1 - A8): Marks P-101, P-102, P-103, C-201',
          'East Elevation  (Grid Lines B1 - B6): Marks P-104, P-105, C-202',
          'South Elevation (Grid Lines C1 - C8): Marks P-106, P-107',
          'West Elevation  (Grid Lines D1 - D6): Marks P-108',
          'Canopy Soffit   (Entrance Canopies): Marks S-301, S-302',
        ],
      },
      {
        heading: '2. Cladding Specifications',
        lines: [
          'Primary Cladding: 4mm ACM Charcoal Grey PVDF & Bright Silver Metallic',
          'Joint System: Dry-Joint Pressure-Equalized Rainscreen w/ 1/2" reveal',
          'Substructure: Aluminum Hat-Channels on 16GA Studs w/ continuous exterior insulation',
        ],
      },
    ],
  )
  zip.file('25036-R1 Shop Drawings.pdf', shopDrawingsPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Shop Drawings.pdf'),
    shopDrawingsPdf,
  )

  // 7. Elevation Matrix
  const elevationMatrixPdf = await createSamplePdf(
    'Elevation Matrix & Installation Sequencing',
    'Department Routing & Elevation Bundling Matrix',
    [
      {
        heading: '1. Staging & Elevation Order',
        lines: [
          'Stage 1 — North Elevation (Phase 1 Priority): 12 Panels (Marks P-101..103, C-201) -> Pallet PAL-25036-R1-001',
          'Stage 2 — East & South Elevations: 10 Panels (Marks P-104..107, C-202) -> Pallet PAL-25036-R1-002',
          'Stage 3 — Canopy Soffits: 10 Panels (Marks S-301..302) -> Pallet PAL-25036-R1-003',
        ],
      },
    ],
  )
  zip.file('25036-R1 Elevation Matrix.pdf', elevationMatrixPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Elevation Matrix.pdf'),
    elevationMatrixPdf,
  )

  // 8. Packing List & Shipping Matrix
  const packingListPdf = await createSamplePdf(
    'Master Packing List & Pallet Matrix',
    'Shipping Department Staging & Bill of Lading Manifest',
    [
      {
        heading: '1. Pallet Manifests',
        lines: [
          'Pallet PAL-25036-R1-001 (Size: 52" x 102" x 48", Weight: 640 lbs):',
          '  - P-101 (Qty 4) | P-102 (Qty 4) | C-201 (Qty 4)',
          '---------------------------------------------------------------------------------',
          'Pallet PAL-25036-R1-002 (Size: 52" x 126" x 48", Weight: 720 lbs):',
          '  - P-103 (Qty 4) | P-104 (Qty 2) | P-105 (Qty 3) | C-202 (Qty 2)',
        ],
      },
    ],
  )
  zip.file('25036-R1 Packing List.pdf', packingListPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Packing List.pdf'),
    packingListPdf,
  )

  // 9. Priority & Accessory List
  const priorityListPdf = await createSamplePdf(
    'Priority & Hardware Accessory List',
    'Fasteners, Joint Splices, Starter Tracks & Weep Inserts',
    [
      {
        heading: '1. Accessory Hardware Schedules',
        lines: [
          'ACC-01: Extruded Aluminum Joint Splice Track (200 LF)',
          'ACC-02: Heavy Duty Panel Attachment Clips (CLIP-ALU-25) — Qty 850 pcs',
          'ACC-03: 316 Stainless Fasteners & Rivets — Qty 2,500 pcs',
          'ACC-04: Bug Screen Weep Baffles — Qty 48 pcs',
        ],
      },
    ],
  )
  zip.file('25036-R1 Priority Accessory List.pdf', priorityListPdf)
  fs.writeFileSync(
    path.join(fixturesDir, '25036-R1 Priority Accessory List.pdf'),
    priorityListPdf,
  )

  // Write out master zip package for testing upload wizard
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const zipPath = path.join(fixturesDir, '25036_RELEASE_1_PACKAGE.zip')
  fs.writeFileSync(zipPath, zipBuffer)

  console.log(
    `✓ Master Release ZIP Package generated: ${zipPath} (${zipBuffer.length} bytes)`,
  )
  console.log(
    '✓ Individual controlled PDF and CSV files written to fixtures/ directory.',
  )
}

if (
  (import.meta as { main?: boolean }).main ||
  process.argv[1]?.includes('generate-demo-release-files')
) {
  generateDemoReleaseFiles().catch((err) => {
    console.error('Error generating demo release files:', err)
    process.exit(1)
  })
}
