# Elward Flow: End-to-End Release Lifecycle Guide

This tutorial covers the complete journey of an architectural panel release through **Elward Flow**, from drafting engineering packets to flatbed shipping and Bill of Lading (BOL) dispatch.

```
Customer ➔ Project ➔ Job (5-Digit) ➔ Release ➔ Revision ➔ Panel Mark ➔ Work Step ➔ QC ➔ Pallet ➔ Shipment
```

---

## Stage 1: Release Intake & Document Ingestion (`/releases/intake`)

### Goal

Ingest engineering takeoff files, architectural drawings, and panel marks into an active revision.

1. **Navigate to Release Intake**:
   - Go to `/releases/intake` or click **New Release Intake** from `/releases`.
2. **Select Job & Release Number**:
   - Choose the 5-digit job (e.g. `54120 - Tempe Gateway Commercial Center`).
   - Specify the release sequence (e.g. `Release 1` creates unique business key `54120-1`).
3. **Upload Engineering Files**:
   - Upload a ZIP package up to 100 MB containing the controlled PDFs and a CSV panel takeoff. Packages above 4 MB upload directly to private object storage with a five-minute authorization; the application then verifies size and SHA-256 before processing.
   - The CSV columns are `mark`, `description`, `quantity`, `materialFamily`, `color`, `thickness`, `width`, and `length`.
   - A standalone PDF is preserved and classified, but publishing remains blocked until panel marks are supplied through a CSV takeoff package.
4. **Classification & Verification**:
   - The automated classifier reviews lines, detects material types (e.g. Reynobond 4mm ACM, Swisspearl, Trespa), and extracts panel marks.
5. **Publish Revision**:
   - Click **Publish Revision (Rev 1)**. This locks the engineering packet immutably with SHA-256 integrity and activates worksteps for production.

---

## Stage 2: Material Allocation & Inventory Readiness (`/inventory`)

### Goal

Ensure all sheet stock, extrusions, and hardware are allocated and available before starting shop floor routing.

1. **Check Release Demand (`/inventory` ➔ Release Demand)**:
   - View panel mark material requirements for `54120-1`.
   - Check status: _Available_, _Allocated_, _Short_, or _On Order_.
2. **Allocate Inventory**:
   - Click **Allocate Stock** for required raw sheets (e.g. 4mm FR Core Bone White) to prevent double-booking.
3. **Receive Inbound Purchase Orders (`/inventory` ➔ PO Receiving Dock)**:
   - When freight arrives, scan PO barcodes or select open lines.
   - Record good units vs. damaged quarantine units to update the perpetual inventory ledger.

---

## Stage 3: Shop-Floor Execution & Mobile Scanning (`/production` & `/scan`)

### Goal

Route panels through machines and assembly workcells with 2-3 tap mobile scanning.

1. **Dispatch Production Schedule (`/production` ➔ Schedule)**:
   - Supervisors dispatch workstep queues for **CNC Routing**, **ELU Cutting**, **Parts Prep**, **Assembly**, and **Packaging**.
2. **Perform First-Off Machine Inspection**:
   - At CNC/ELU stations, operators run the first panel and record Caliper/Squareness verification to unblock batch runs.
3. **Shop-Floor QR/Barcode Scanning (`/scan`)**:
   - Operator scans panel mark barcode (e.g. `54120-1-P101`).
   - The scanner resolves the active revision and presents only valid next operations.
   - Tap **Advance Station** (e.g. Move from _CNC_ to _Parts Prep_ to _Assembly_ to _Packaging_).
   - _Obsolete Revision Protection_: If an old revision tag is scanned, the app blocks the scan with an audible warning and points to the current active revision.
4. **Log Downtime (`/production` ➔ Downtime Tracker)**:
   - If a machine stops (tool change, maintenance, material wait), log the category and duration.

---

## Stage 4: Quality Control, Holds & Remake Management (`/quality`)

### Goal

Inspect finished panels against architectural tolerances and handle non-conformances.

1. **Record QC Inspection (`/quality` ➔ Inspection Ledger)**:
   - Enter caliper measurements, diagonal squareness, and visual finish checks.
   - Select disposition: **Pass**, **Pass with Note**, **Hold**, **Rework**, **Remake**, or **Scrap**.
2. **Manage Quality Holds (`/quality` ➔ Non-Conformance Issues)**:
   - Panels marked **Hold** immediately block downstream packaging.
   - When defects are corrected, a supervisor clicks **Release Hold**, enters a mandatory release reason, and signs off.
3. **Generate RMKs / RMEs (`/quality` ➔ Remake Console)**:
   - If a panel is scrapped or damaged:
     - **RMK**: Shop-floor internal remake.
     - **RME**: Engineering/takeoff error remake.
   - The system automatically assigns a remake identifier starting at configurable sequence **51** (e.g. `P-102-RME-51`), preserving parent lineage and material/labor cost tracking.

---

## Stage 5: Palletizing & Staging (`/pallets`)

### Goal

Stack inspected panels into elevation-specific pallet crates within safety limits.

1. **Initialize Pallet Container**:
   - Go to `/pallets` and click **Build New Pallet**.
   - Select Release `54120-1` and elevation zone (e.g. _North Elevation_).
2. **Stack Panel Marks**:
   - Click **Add Mark** to stack finished panel marks onto the pallet.
   - Live progress bars monitor height (max 60") and weight (max 2,500 lbs).
3. **Complete & Stage**:
   - Once strapped with corner protectors, click **Complete & Stage for Shipping**.
   - Download the official **Packing Slip CSV** with full panel sequences.

---

## Stage 6: Shipping & Flatbed Logistics (`/shipping`)

### Goal

Load staged pallets onto flatbed trailers, enforce axle weight limits, and dispatch.

1. **Plan Flatbed Load**:
   - Go to `/shipping` and click **Plan New Shipment**.
   - Enter carrier (e.g. _Flatbed Freight Express_), trailer number, driver name/phone, and job site address.
2. **Load Staged Pallets**:
   - Select staged pallets and assign truck positions (1 through 26).
   - Real-time gross weight checks ensure the load remains below the legal 45,000 lbs flatbed limit.
3. **Authorize & Dispatch (BOL)**:
   - Click **Authorize & Dispatch Shipment**.
   - Generates the official **Bill of Lading (BOL)** manifest CSV.
   - Transitions all loaded pallets and release panel marks to **Shipped**.

---

## Stage 7: Analytics & Forensic Audit (`/reports` & `/admin`)

1. **Yield & Efficiency Analytics (`/reports`)**:
   - Review overall yield %, scrap rates, department cycle efficiency, and logistics volume.
   - Export CSV reports for executive and customer reviews.
2. **Forensic Audit Ledger (`/admin` ➔ Audit Ledger)**:
   - Review the append-only ledger detailing every state change, timestamp (America/Denver), user, workstation, and reason.
